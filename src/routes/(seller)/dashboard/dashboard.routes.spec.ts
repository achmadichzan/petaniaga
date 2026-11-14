import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isActionFailure, isHttpError, isRedirect, type Cookies } from '@sveltejs/kit';
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

// Header WebP minimal (RIFF + ukuran + WEBP): 12 byte yang dicek hasValidImageMagicBytes.
const WEBP_BYTES = new Uint8Array([
	0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
]);

import { upsertGoogleUser, findUserById } from '#modules/auth/server/auth.repo.ts';
import { SESSION_COOKIE_NAME, verifySessionJwt } from '#modules/auth/server/jwt.ts';
import { GET as mapProductsGet } from '../../(public)/api/map-products/+server';
import { GET as photoProxyGet } from '../../api/photos/[...key]/+server';
import { actions as dashboardActions, load as dashboardLoad } from './+page.server';

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

function createMockBucket() {
	const store = new Map<string, { body: Uint8Array; contentType: string }>();
	const bucket = {
		async put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) {
			store.set(key, {
				body: new Uint8Array(value),
				contentType: opts?.httpMetadata?.contentType ?? 'application/octet-stream'
			});
		},
		async get(key: string) {
			const found = store.get(key);
			if (!found) return null;
			return {
				body: found.body,
				httpMetadata: { contentType: found.contentType },
				httpEtag: '"etag-1"'
			};
		},
		async delete(key: string) {
			store.delete(key);
		}
	} as unknown as R2Bucket;

	return { bucket, store };
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

describe('public API & dashboard routes integration', () => {
	let r2Store: Map<string, { body: Uint8Array; contentType: string }>;

	beforeEach(async () => {
		workerEnv.DB = createSqliteD1();
		const r2 = createMockBucket();
		workerEnv.R2_BUCKET = r2.bucket;
		r2Store = r2.store;

		await upsertGoogleUser(workerEnv.DB, {
			id: 'seller-1',
			nama: 'Pak Slamet',
			email: 'slamet@example.com'
		});
		await workerEnv.DB
			.prepare(`UPDATE users SET no_wa = ? WHERE id = ?`)
			.bind('6281234567890', 'seller-1')
			.run();
	});

	it('dashboard actions mengelola siklus penuh create -> map API -> photo proxy -> toggle -> renew -> delete & updateWa', async () => {
		const { cookies, store: cookieStore } = createMockCookies();
		const locals = {
			user: {
				id: 'seller-1',
				nama: 'Pak Slamet',
				no_wa: '6281234567890',
				default_lat: null as number | null,
				default_lng: null as number | null
			}
		};

		// 1. Create product via FormData
		const createForm = new FormData();
		createForm.set('nama_produk', 'Tomat Cherry Segar');
		createForm.set('kategori', 'sayur');
		createForm.set('harga', '18000');
		createForm.set('satuan', 'kg');
		createForm.set('stok_info', 'Panen pagi 30 kg');
		createForm.set('lat', '-6.8174');
		createForm.set('lng', '107.6172');
		createForm.set(
			'foto',
			new File([WEBP_BYTES], 'tomat.webp', { type: 'image/webp' })
		);

		const createRes = await dashboardActions.createProduct({
			request: new Request('http://localhost:5173/dashboard?/createProduct', {
				method: 'POST',
				body: createForm
			}),
			locals,
			cookies,
			url: new URL('http://localhost:5173/dashboard')
		} as unknown as Parameters<typeof dashboardActions.createProduct>[0]);

		expect(createRes).toMatchObject({ action: 'createProduct' });
		expect(r2Store.size).toBe(1);
		expect(locals.user.default_lat).toBe(-6.8174);

		const updatedToken = cookieStore.get(SESSION_COOKIE_NAME);
		expect(updatedToken).toBeTruthy();
		const parsedJwt = await verifySessionJwt(updatedToken!, workerEnv.JWT_SECRET);
		expect(parsedJwt?.default_lat).toBe(-6.8174);

		// 2. Dashboard load mengembalikan produk baru
		const loaded = await dashboardLoad({
			parent: async () => ({ user: locals.user })
		} as unknown as Parameters<typeof dashboardLoad>[0]);
		const products = (loaded as { products: Array<{ id: string; foto_url: string; is_available: number }> }).products;
		expect(products).toHaveLength(1);
		const createdProduct = products[0];

		// 3. GET /api/map-products menemukan produk di bounding box
		const mapRes = await mapProductsGet({
			url: new URL(
				'http://localhost:5173/api/map-products?north=-6.7&south=-6.9&east=107.8&west=107.5&zoom=12&kategori=sayur'
			)
		} as unknown as Parameters<typeof mapProductsGet>[0]);
		expect(mapRes.status).toBe(200);
		expect(mapRes.headers.get('Cache-Control')).toBe('no-store');
		const mapBody = (await mapRes.json()) as { products: Array<{ id: string }>; zoomTooWide: boolean };
		expect(mapBody.zoomTooWide).toBe(false);
		expect(mapBody.products.map((p) => p.id)).toEqual([createdProduct.id]);

		// 4. GET /api/photos/[...key] menyajikan biner foto R2 dengan header cache
		const key = createdProduct.foto_url.replace('/api/photos/', '');
		const photoRes = await photoProxyGet({
			params: { key }
		} as unknown as Parameters<typeof photoProxyGet>[0]);
		expect(photoRes.status).toBe(200);
		expect(photoRes.headers.get('Content-Type')).toBe('image/webp');
		expect(photoRes.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
		expect(new Uint8Array(await photoRes.arrayBuffer())).toEqual(WEBP_BYTES);

		// 5. Toggle stok habis -> hilang dari map-products
		const toggleForm = new FormData();
		toggleForm.set('product_id', createdProduct.id);
		toggleForm.set('next_available', '0');
		await dashboardActions.toggleAvailability({
			request: new Request('http://localhost:5173/dashboard?/toggleAvailability', {
				method: 'POST',
				body: toggleForm
			}),
			locals
		} as unknown as Parameters<typeof dashboardActions.toggleAvailability>[0]);

		const mapAfterToggle = await (
			await mapProductsGet({
				url: new URL(
					'http://localhost:5173/api/map-products?north=-6.7&south=-6.9&east=107.8&west=107.5&zoom=12'
				)
			} as unknown as Parameters<typeof mapProductsGet>[0])
		).json();
		expect((mapAfterToggle as { products: unknown[] }).products).toHaveLength(0);

		// 6. Renew product mengaktifkan kembali & memperpanjang masa tayang
		const renewForm = new FormData();
		renewForm.set('product_id', createdProduct.id);
		await dashboardActions.renewProduct({
			request: new Request('http://localhost:5173/dashboard?/renewProduct', {
				method: 'POST',
				body: renewForm
			}),
			locals
		} as unknown as Parameters<typeof dashboardActions.renewProduct>[0]);

		// 7. Update nomor WA lewat dashboard action memperbarui D1 + cookie
		const waForm = new FormData();
		waForm.set('no_wa', '0856-9876-5432');
		const waRes = await dashboardActions.updateWa({
			request: new Request('http://localhost:5173/dashboard?/updateWa', {
				method: 'POST',
				body: waForm
			}),
			locals,
			cookies,
			url: new URL('http://localhost:5173/dashboard')
		} as unknown as Parameters<typeof dashboardActions.updateWa>[0]);
		expect(waRes).toMatchObject({ action: 'updateWa' });
		expect((await findUserById(workerEnv.DB, 'seller-1'))?.no_wa).toBe('6285698765432');

		// 8. Penjual lain tidak boleh bisa menghapus produk
		const stealForm = new FormData();
		stealForm.set('product_id', createdProduct.id);
		const stealRes = await dashboardActions.deleteProduct({
			request: new Request('http://localhost:5173/dashboard?/deleteProduct', {
				method: 'POST',
				body: stealForm
			}),
			locals: { user: { ...locals.user, id: 'seller-lain' } }
		} as unknown as Parameters<typeof dashboardActions.deleteProduct>[0]);
		expect(isActionFailure(stealRes)).toBe(true);
		expect(stealRes).toMatchObject({ status: 404 });
		expect(r2Store.size).toBe(1);

		// 9. Pemilik menghapus produk -> baris D1 dan objek R2 ikut terhapus
		const delForm = new FormData();
		delForm.set('product_id', createdProduct.id);
		const delRes = await dashboardActions.deleteProduct({
			request: new Request('http://localhost:5173/dashboard?/deleteProduct', {
				method: 'POST',
				body: delForm
			}),
			locals
		} as unknown as Parameters<typeof dashboardActions.deleteProduct>[0]);
		expect(delRes).toMatchObject({ action: 'manageProduct' });
		expect(r2Store.size).toBe(0);
	});

	it('menangani error HTTP: koordinat map invalid (400), foto tidak ada / traversal (404), dan action unauthenticated', async () => {
		const badMap = await mapProductsGet({
			url: new URL(
				'http://localhost:5173/api/map-products?north=bukan-angka&south=-7&east=108&west=107'
			)
		} as unknown as Parameters<typeof mapProductsGet>[0]);
		expect(badMap.status).toBe(400);
		expect(await badMap.json()).toHaveProperty('message');

		for (const badKey of ['', 'products/tidak-ada.webp', 'products/../secret.txt']) {
			try {
				await photoProxyGet({
					params: { key: badKey }
				} as unknown as Parameters<typeof photoProxyGet>[0]);
				expect.unreachable(`Expected 404 for key "${badKey}"`);
			} catch (err) {
				expect(isHttpError(err)).toBe(true);
				expect((err as { status: number }).status).toBe(404);
			}
		}

		// createProduct tanpa file foto -> fail(400)
		const { cookies } = createMockCookies();
		const missingPhotoForm = new FormData();
		missingPhotoForm.set('nama_produk', 'Jagung');
		const failPhotoRes = await dashboardActions.createProduct({
			request: new Request('http://localhost:5173/dashboard?/createProduct', {
				method: 'POST',
				body: missingPhotoForm
			}),
			locals: {
				user: {
					id: 'seller-1',
					nama: 'Pak Slamet',
					no_wa: '6281234567890',
					default_lat: null,
					default_lng: null
				}
			},
			cookies,
			url: new URL('http://localhost:5173/dashboard')
		} as unknown as Parameters<typeof dashboardActions.createProduct>[0]);
		expect(isActionFailure(failPhotoRes)).toBe(true);
		expect(failPhotoRes).toMatchObject({ status: 400 });

		// Unauthenticated action -> redirect 303 ke /login
		try {
			await dashboardActions.deleteProduct({
				request: new Request('http://localhost:5173/dashboard?/deleteProduct', {
					method: 'POST',
					body: new FormData()
				}),
				locals: { user: null }
			} as unknown as Parameters<typeof dashboardActions.deleteProduct>[0]);
			expect.unreachable('Expected redirect to /login');
		} catch (err) {
			expect(isRedirect(err)).toBe(true);
			expect(err).toMatchObject({ status: 303, location: '/login' });
		}
	});
});
