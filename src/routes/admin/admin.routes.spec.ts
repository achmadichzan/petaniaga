import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { workerEnv } = vi.hoisted(() => {
	const env = {
		DB: undefined as unknown as D1Database,
		R2_BUCKET: undefined as unknown as R2Bucket,
		JWT_SECRET: 'test-jwt-secret-key-at-least-32-chars',
		ADMIN_EMAILS: 'admin@example.com'
	};
	(globalThis as Record<string, unknown>).__sveltekit_cloudflare_platform = { env };
	return { workerEnv: env };
});

vi.mock('$app/env', () => ({ dev: true }));

import { findUserById, upsertGoogleUser } from '#modules/auth/server/auth.repo.ts';
import {
	createHarvestProduct,
	listModerationReports,
	reportHarvestProduct
} from '#modules/catalog/server/catalog.service.ts';
import { actions, load } from './+page.server';

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

function createMockBucket() {
	const store = new Map<string, ArrayBuffer>();
	const bucket = {
		async put(key: string, value: ArrayBuffer) {
			store.set(key, value);
		},
		async delete(key: string) {
			store.delete(key);
		}
	} as unknown as R2Bucket;

	return { bucket, store };
}

const adminUser = {
	id: 'admin-1',
	nama: 'Admin Petaniaga',
	no_wa: null,
	default_lat: null,
	default_lng: null
};

const sellerUser = {
	id: 'seller-9',
	nama: 'Pak Sukarman',
	no_wa: null,
	default_lat: null,
	default_lng: null
};

describe('admin moderation panel', () => {
	let productId: string;
	let r2Store: Map<string, ArrayBuffer>;

	beforeEach(async () => {
		workerEnv.DB = createSqliteD1();
		workerEnv.ADMIN_EMAILS = 'admin@example.com';
		const r2 = createMockBucket();
		workerEnv.R2_BUCKET = r2.bucket;
		r2Store = r2.store;

		await upsertGoogleUser(workerEnv.DB, {
			id: 'admin-1',
			nama: 'Admin Petaniaga',
			email: 'admin@example.com'
		});
		await upsertGoogleUser(workerEnv.DB, {
			id: 'seller-9',
			nama: 'Pak Sukarman',
			email: 'sukarman@example.com'
		});

		const product = await createHarvestProduct(workerEnv.DB, r2.bucket, null, 'seller-9', {
			nama_produk: 'Mangga Harum Manis',
			kategori: 'buah',
			harga: 15000,
			satuan: 'kg',
			lat: -7.1,
			lng: 110.4,
			photoFile: new File([WEBP_BYTES], 'mangga.webp', { type: 'image/webp' })
		});
		productId = product.id;

		for (const token of ['device-a', 'device-b', 'device-c']) {
			await reportHarvestProduct(workerEnv.DB, productId, token, null);
		}
	});

	it('menampilkan laporan terkelompok dan memblokir akses non-admin', async () => {
		const loaded = (await load({
			locals: { user: adminUser }
		} as unknown as Parameters<typeof load>[0])) as {
			groups: Array<{
				userId: string;
				isBanned: boolean;
				reporterCount: number;
				products: Array<{ namaProduk: string; reportCount: number; isAvailable: boolean }>;
			}>;
		};

		expect(loaded.groups).toHaveLength(1);
		expect(loaded.groups[0]).toMatchObject({
			userId: 'seller-9',
			isBanned: true,
			reporterCount: 3
		});
		expect(loaded.groups[0].products[0]).toMatchObject({
			namaProduk: 'Mangga Harum Manis',
			reportCount: 3,
			isAvailable: false
		});

		await expect(
			load({
				locals: { user: sellerUser }
			} as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 403 });

		await expect(
			load({ locals: { user: null } } as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/login' });
	});

	it('membuka blokir akun, mereset peringatan, dan menghapus laporan yang ditinjau', async () => {
		expect((await findUserById(workerEnv.DB, 'seller-9'))?.is_banned).toBe(1);

		const formData = new FormData();
		formData.set('user_id', 'seller-9');

		const result = await actions.unban({
			request: new Request('http://localhost:5173/admin?/unban', {
				method: 'POST',
				body: formData
			}),
			locals: { user: adminUser }
		} as unknown as Parameters<typeof actions.unban>[0]);

		expect(result).toMatchObject({ action: 'unban' });
		expect((result as { message: string }).message).toMatch(/dibuka/);

		const seller = await findUserById(workerEnv.DB, 'seller-9');
		expect(seller?.is_banned).toBe(0);
		expect(seller?.strike_count).toBe(0);
		expect(await listModerationReports(workerEnv.DB)).toHaveLength(0);
	});

	it('menolak aksi unban dari akun non-admin', async () => {
		const formData = new FormData();
		formData.set('user_id', 'seller-9');

		await expect(
			actions.unban({
				request: new Request('http://localhost:5173/admin?/unban', {
					method: 'POST',
					body: formData
				}),
				locals: { user: sellerUser }
			} as unknown as Parameters<typeof actions.unban>[0])
		).rejects.toMatchObject({ status: 403 });

		expect((await findUserById(workerEnv.DB, 'seller-9'))?.is_banned).toBe(1);
	});

	it('menyembunyikan produk yang dilaporkan dari peta', async () => {
		// Blokir otomatis dari 3 laporan sudah menyembunyikan produk; tayangkan
		// kembali dulu agar aksi sembunyikan admin benar-benar teruji.
		await workerEnv.DB.prepare(`UPDATE products SET is_available = 1 WHERE id = ?`)
			.bind(productId)
			.run();

		const formData = new FormData();
		formData.set('product_id', productId);

		const result = await actions.hideProduct({
			request: new Request('http://localhost:5173/admin?/hideProduct', {
				method: 'POST',
				body: formData
			}),
			locals: { user: adminUser }
		} as unknown as Parameters<typeof actions.hideProduct>[0]);

		expect(result).toMatchObject({ action: 'hideProduct' });

		const row = await workerEnv.DB.prepare(`SELECT is_available FROM products WHERE id = ?`)
			.bind(productId)
			.first<{ is_available: number }>();
		expect(row?.is_available).toBe(0);
	});

	it('menghapus produk yang dilaporkan beserta laporan dan foto R2', async () => {
		expect(r2Store.size).toBe(1);

		const formData = new FormData();
		formData.set('product_id', productId);

		const result = await actions.deleteProduct({
			request: new Request('http://localhost:5173/admin?/deleteProduct', {
				method: 'POST',
				body: formData
			}),
			locals: { user: adminUser }
		} as unknown as Parameters<typeof actions.deleteProduct>[0]);

		expect(result).toMatchObject({ action: 'deleteProduct' });
		expect(
			await workerEnv.DB.prepare(`SELECT COUNT(*) AS total FROM products`).first<{
				total: number;
			}>()
		).toEqual({ total: 0 });
		expect(await listModerationReports(workerEnv.DB)).toHaveLength(0);
		expect(r2Store.size).toBe(0);
	});
});
