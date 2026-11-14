import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { upsertGoogleUser, findUserById } from '#modules/auth/server/auth.repo.ts';
import { recordModerationStrike } from '#modules/auth/server/auth.repo.ts';
import {
	createHarvestProduct,
	getSellerProducts,
	removeHarvestProduct,
	renewHarvestProduct,
	reportHarvestProduct,
	toggleHarvestAvailability
} from './catalog.service';

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
	return {
		store,
		bucket: {
			async put(key: string, value: ArrayBuffer) {
				store.set(key, value);
			},
			async delete(key: string) {
				store.delete(key);
			}
		} as unknown as R2Bucket
	};
}

describe('catalog module', () => {
	it('membuat produk baru, mengunggah ke R2, memperbarui lokasi default penjual, toggle stok, perpanjang, dan hapus', async () => {
		const db = createSqliteD1();
		const { bucket, store } = createMockBucket();

		await upsertGoogleUser(db, {
			id: 'seller-1',
			nama: 'Pak Karjo',
			email: 'karjo@example.com'
		});

		// Header WebP minimal (RIFF + ukuran + WEBP): 12 byte yang dicek hasValidImageMagicBytes.
		const webpBytes = new Uint8Array([
			0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
		]);
		const photoFile = new File([webpBytes], 'cabai.webp', {
			type: 'image/webp'
		});

		const created = await createHarvestProduct(
			db,
			bucket,
			null,
			'seller-1',
			{
				nama_produk: 'Cabai Rawit Merah',
				kategori: 'sayur',
				harga: 32000,
				satuan: 'kg',
				stok_info: 'Petik pagi, segar 25 kg',
				lat: -7.123456,
				lng: 110.654321,
				photoFile
			},
			1_700_000_000
		);

		expect(created.foto_url).toMatch(/^\/api\/photos\/products\/seller-1\/.*\.webp$/);
		expect(created.expired_at).toBe(1_700_000_000 + 14 * 86400);
		expect(store.size).toBe(1);

		const sellerAfterCreate = await findUserById(db, 'seller-1');
		expect(sellerAfterCreate?.default_lat).toBe(-7.123456);
		expect(sellerAfterCreate?.default_lng).toBe(110.654321);

		const toggledOut = await toggleHarvestAvailability(db, 'seller-1', created.id, false);
		expect(toggledOut.is_available).toBe(0);

		const renewed = await renewHarvestProduct(db, 'seller-1', created.id, 1_700_500_000);
		expect(renewed.is_available).toBe(1);
		expect(renewed.expired_at).toBe(1_700_500_000 + 14 * 86400);

		const list = await getSellerProducts(db, 'seller-1');
		expect(list).toHaveLength(1);

		// Penjual lain tidak boleh bisa menghapus produk ini
		await expect(removeHarvestProduct(db, bucket, 'seller-lain', created.id)).rejects.toThrow();
		expect(store.size).toBe(1);

		await removeHarvestProduct(db, bucket, 'seller-1', created.id);
		expect(store.size).toBe(0);
		expect(await getSellerProducts(db, 'seller-1')).toHaveLength(0);
	});

	it('memblokir akun setelah 3 pelanggaran foto dan menyembunyikan lapaknya', async () => {
		const db = createSqliteD1();
		const { bucket } = createMockBucket();
		await upsertGoogleUser(db, { id: 'f3', nama: 'Pak Rusdi', email: 'rusdi@example.com' });

		const webpBytes = new Uint8Array([
			0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
		]);
		const photoFile = new File([webpBytes], 'salah.webp', { type: 'image/webp' });
		const input = {
			nama_produk: 'Cabai',
			kategori: 'sayur',
			harga: 10000,
			satuan: 'kg',
			lat: -7,
			lng: 110,
			photoFile
		};

		// Foto lolos (AI null) -> produk pertama tayang
		await createHarvestProduct(db, bucket, null, 'f3', input);

		for (let i = 1; i <= 3; i++) {
			const strike = await recordModerationStrike(db, 'f3');
			expect(strike.strike_count).toBe(i);
		}

		expect((await findUserById(db, 'f3'))?.is_banned).toBe(1);
		expect((await getSellerProducts(db, 'f3'))[0].is_available).toBe(0);

		await expect(createHarvestProduct(db, bucket, null, 'f3', input)).rejects.toThrow(
			/dinonaktifkan/
		);
	});

	it('menonaktifkan akun setelah 3 pelapor unik dan mengabaikan laporan ganda', async () => {
		const db = createSqliteD1();
		const { bucket } = createMockBucket();
		await upsertGoogleUser(db, { id: 'f4', nama: 'Bu Rina', email: 'rina@example.com' });

		const webpBytes = new Uint8Array([
			0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
		]);
		const created = await createHarvestProduct(db, bucket, null, 'f4', {
			nama_produk: 'Bayam',
			kategori: 'sayur',
			harga: 5000,
			satuan: 'ikat',
			lat: -7,
			lng: 110,
			photoFile: new File([webpBytes], 'bayam.webp', { type: 'image/webp' })
		});

		await reportHarvestProduct(db, created.id, 'token-a', null);
		await reportHarvestProduct(db, created.id, 'token-a', null);
		await reportHarvestProduct(db, created.id, 'token-b', null);
		expect((await findUserById(db, 'f4'))?.is_banned).toBe(0);

		const third = await reportHarvestProduct(db, created.id, 'token-c', null);
		expect(third.ownerBanned).toBe(true);
		expect((await findUserById(db, 'f4'))?.is_banned).toBe(1);
		expect((await getSellerProducts(db, 'f4'))[0].is_available).toBe(0);
	});

	it('menolak tipe foto selain WebP/JPG/PNG atau input harga tidak valid', async () => {
		const db = createSqliteD1();
		const { bucket } = createMockBucket();
		await upsertGoogleUser(db, { id: 'f2', nama: 'Bu Tini', email: 'tini@example.com' });

		const pdfFile = new File([new Uint8Array([1, 2])], 'dok.pdf', { type: 'application/pdf' });

		await expect(
			createHarvestProduct(db, bucket, null, 'f2', {
				nama_produk: 'Beras',
				kategori: 'beras',
				harga: 14000,
				satuan: 'kg',
				lat: -7,
				lng: 110,
				photoFile: pdfFile
			})
		).rejects.toThrow(/Format foto/);

		const validFile = new File([new Uint8Array([1, 2])], 'ok.webp', { type: 'image/webp' });
		await expect(
			createHarvestProduct(db, bucket, null, 'f2', {
				nama_produk: 'Beras',
				kategori: 'beras',
				harga: 0,
				satuan: 'kg',
				lat: -7,
				lng: 110,
				photoFile: validFile
			})
		).rejects.toThrow(/Harga harus/);
	});
});
