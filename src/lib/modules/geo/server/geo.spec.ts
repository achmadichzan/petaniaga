import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { searchMapProducts } from './geo.service';

function createSeededSqliteD1(nowUnix: number): D1Database {
	const sqlite = new DatabaseSync(':memory:');
	const schemaPath = path.resolve(process.cwd(), 'migrations/0001_initial_schema.sql');
	sqlite.exec(fs.readFileSync(schemaPath, 'utf-8'));

	sqlite
		.prepare(`INSERT INTO users (id, nama, email, no_wa) VALUES (?, ?, ?, ?)`)
		.run('u1', 'Pak Budi', 'budi@example.com', '6281234567890');
	sqlite
		.prepare(`INSERT INTO users (id, nama, email, no_wa) VALUES (?, ?, ?, ?)`)
		.run('u-no-wa', 'Belum Ada WA', 'nowa@example.com', null);

	const insertProd = sqlite.prepare(`
		INSERT INTO products (
			id, user_id, nama_produk, kategori, harga, satuan, stok_info,
			foto_url, lat, lng, is_available, expired_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);

	// Produk aktif dalam area Lembang
	insertProd.run('p1', 'u1', 'Sawi Segar', 'sayur', 7000, 'ikat', 'Segar', '/seed-photos/sawi.svg', -6.81, 107.61, 1, nowUnix + 86400);
	// Produk aktif di area Lembang kategori beras
	insertProd.run('p2', 'u1', 'Beras Organik', 'beras', 15000, 'kg', null, '/seed-photos/beras.svg', -6.82, 107.62, 1, nowUnix + 86400);
	// Produk stok habis (tidak boleh muncul)
	insertProd.run('p3', 'u1', 'Tomat Habis', 'sayur', 9000, 'kg', null, '/seed-photos/tomat.svg', -6.815, 107.615, 0, nowUnix + 86400);
	// Produk kedaluwarsa (tidak boleh muncul)
	insertProd.run('p4', 'u1', 'Wortel Lama', 'sayur', 8000, 'kg', null, '/seed-photos/wortel.svg', -6.815, 107.615, 1, nowUnix - 100);
	// Produk penjual tanpa WA (tidak boleh muncul)
	insertProd.run('p5', 'u-no-wa', 'Jagung', 'umbi', 6000, 'kg', null, '/seed-photos/jagung.svg', -6.815, 107.615, 1, nowUnix + 86400);
	// Produk di luar bounding box (Malang)
	insertProd.run('p6', 'u1', 'Apel Batu', 'buah', 18000, 'kg', null, '/seed-photos/apel.svg', -7.87, 112.52, 1, nowUnix + 86400);

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

describe('geo module', () => {
	const NOW = 1_700_000_000;

	it('hanya mengembalikan produk aktif, belum kedaluwarsa, punya no WA, dan berada dalam bounding box', async () => {
		const db = createSeededSqliteD1(NOW);
		const res = await searchMapProducts(db, {
			north: -6.7,
			south: -6.95,
			east: 107.8,
			west: 107.5,
			zoom: 12,
			nowUnix: NOW
		});

		expect(res.zoomTooWide).toBe(false);
		expect(res.products.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
	});

	it('memfilter produk berdasarkan kategori', async () => {
		const db = createSeededSqliteD1(NOW);
		const res = await searchMapProducts(db, {
			north: -6.7,
			south: -6.95,
			east: 107.8,
			west: 107.5,
			kategori: 'beras',
			zoom: 12,
			nowUnix: NOW
		});

		expect(res.products).toHaveLength(1);
		expect(res.products[0].id).toBe('p2');
	});

	it('menahan query saat zoom terlalu jauh untuk menghemat kuota D1', async () => {
		const db = createSeededSqliteD1(NOW);
		const res = await searchMapProducts(db, {
			north: 10,
			south: -15,
			east: 145,
			west: 90,
			zoom: 4,
			nowUnix: NOW
		});

		expect(res.zoomTooWide).toBe(true);
		expect(res.products).toHaveLength(0);
	});
});
