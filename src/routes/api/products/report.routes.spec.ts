import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { workerEnv } = vi.hoisted(() => {
	const env = {
		DB: undefined as unknown as D1Database,
		R2_BUCKET: undefined as unknown as R2Bucket,
		JWT_SECRET: 'test-jwt-secret-key-at-least-32-chars'
	};
	(globalThis as Record<string, unknown>).__sveltekit_cloudflare_platform = { env };
	return { workerEnv: env };
});

vi.mock('$app/env', () => ({ dev: true }));

import { upsertGoogleUser } from '#modules/auth/server/auth.repo.ts';
import { createHarvestProduct } from '#modules/catalog/server/catalog.service.ts';
import {
	consumeRateLimit,
	REPORT_IP_LIMIT,
	REPORT_RATE_WINDOW_SECONDS,
	REPORT_TOKEN_LIMIT
} from '#shared/server/rate-limit.ts';
import { POST } from './[id]/report/+server';

const WEBP_BYTES = new Uint8Array([
	0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
]);

function createSqliteD1(): D1Database {
	const sqlite = new DatabaseSync(':memory:');
	const schemaPath = path.resolve(process.cwd(), 'migrations/0001_initial_schema.sql');
	sqlite.exec(fs.readFileSync(schemaPath, 'utf-8'));

	return {
		prepare(sql: string) {
			const stmt = sqlite.prepare(sql);
			let bindings: unknown[] = [];
			const bound = {
				bind(...args: unknown[]) {
					bindings = args;
					return bound;
				},
				async first<T = unknown>() {
					return (stmt.get(...(bindings as never[])) as T | undefined) ?? null;
				},
				async all<T = unknown>() {
					return { results: stmt.all(...(bindings as never[])) as T[] };
				},
				async run() {
					stmt.run(...(bindings as never[]));
					return { success: true };
				}
			};
			return bound;
		}
	} as unknown as D1Database;
}

function createMockCookies() {
	const store = new Map<string, string>();
	const cookies = {
		get(name: string) {
			return store.get(name);
		},
		set(name: string, value: string) {
			store.set(name, value);
		},
		delete(name: string) {
			store.delete(name);
		}
	} as unknown as Cookies;
	return { cookies, store };
}

const mockBucket = {
	async put() {},
	async delete() {}
} as unknown as R2Bucket;

function callReport(
	productId: string,
	cookies: Cookies,
	headers: Record<string, string> = {}
): ReturnType<typeof POST> {
	return POST({
		params: { id: productId },
		locals: { user: null },
		cookies,
		url: new URL('http://localhost:5173/api/products/x/report'),
		request: new Request('http://localhost:5173/api/products/x/report', {
			method: 'POST',
			headers
		})
	} as unknown as Parameters<typeof POST>[0]);
}

describe('report endpoint rate limit', () => {
	let productId: string;

	beforeEach(async () => {
		workerEnv.DB = createSqliteD1();
		workerEnv.R2_BUCKET = mockBucket;

		await upsertGoogleUser(workerEnv.DB, {
			id: 'seller-1',
			nama: 'Pak Tarno',
			email: 'tarno@example.com'
		});

		const product = await createHarvestProduct(workerEnv.DB, mockBucket, null, 'seller-1', {
			nama_produk: 'Jagung Manis',
			kategori: 'sayur',
			harga: 8000,
			satuan: 'kg',
			lat: -7,
			lng: 110,
			photoFile: new File([WEBP_BYTES], 'jagung.webp', { type: 'image/webp' })
		});
		productId = product.id;
	});

	it('membatasi laporan per perangkat dan mengembalikan 429 + Retry-After', async () => {
		const { cookies } = createMockCookies();

		const responses = [];
		for (let i = 0; i < REPORT_TOKEN_LIMIT + 1; i++) {
			responses.push(await callReport(productId, cookies));
		}

		const allowed = responses.slice(0, REPORT_TOKEN_LIMIT);
		expect(allowed.every((res) => res.status === 200)).toBe(true);

		const blocked = responses[REPORT_TOKEN_LIMIT];
		expect(blocked.status).toBe(429);
		expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
		expect(await blocked.json()).toMatchObject({ message: expect.stringMatching(/Terlalu banyak/) });
	});

	it('membatasi laporan per IP meskipun cookie perangkat selalu baru', async () => {
		let lastStatus = 0;
		for (let i = 0; i <= REPORT_IP_LIMIT; i++) {
			const { cookies } = createMockCookies();
			const res = await callReport(productId, cookies, {
				'cf-connecting-ip': '203.0.113.9'
			});
			lastStatus = res.status;
			if (i < REPORT_IP_LIMIT) {
				expect(res.status).toBe(200);
			}
		}

		expect(lastStatus).toBe(429);
	});

	it('mengizinkan kembali setelah jendela waktu berganti', async () => {
		const db = workerEnv.DB;
		const key = 'report:token:test-window';
		const start = 1_700_000_000;

		for (let i = 0; i < 3; i++) {
			await consumeRateLimit(db, key, 3, REPORT_RATE_WINDOW_SECONDS, start);
		}
		expect((await consumeRateLimit(db, key, 3, REPORT_RATE_WINDOW_SECONDS, start)).allowed).toBe(
			false
		);

		const nextWindow = start + REPORT_RATE_WINDOW_SECONDS;
		const afterReset = await consumeRateLimit(db, key, 3, REPORT_RATE_WINDOW_SECONDS, nextWindow);
		expect(afterReset.allowed).toBe(true);
		expect(afterReset.remaining).toBe(2);
	});
});
