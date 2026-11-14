import type { ProductCategory } from '#shared/constants/harvest.ts';
import type { ProductRecord } from '../types';

export interface InsertProductRow {
	id: string;
	user_id: string;
	nama_produk: string;
	kategori: ProductCategory;
	harga: number;
	satuan: string;
	stok_info: string | null;
	foto_url: string;
	lat: number;
	lng: number;
	expired_at: number;
}

export async function listProductsBySeller(
	db: D1Database,
	userId: string
): Promise<ProductRecord[]> {
	const result = await db
		.prepare(
			`SELECT id, user_id, nama_produk, kategori, harga, satuan, stok_info,
			        foto_url, lat, lng, is_available, expired_at, created_at
			 FROM products
			 WHERE user_id = ?
			 ORDER BY created_at DESC`
		)
		.bind(userId)
		.all<ProductRecord>();

	return result.results ?? [];
}

export async function countProductsBySeller(db: D1Database, userId: string): Promise<number> {
	const row = await db
		.prepare(`SELECT COUNT(*) AS total FROM products WHERE user_id = ?`)
		.bind(userId)
		.first<{ total: number }>();

	return row?.total ?? 0;
}

export async function insertProduct(
	db: D1Database,
	input: InsertProductRow
): Promise<ProductRecord> {
	const row = await db
		.prepare(
			`INSERT INTO products (
				id, user_id, nama_produk, kategori, harga, satuan,
				stok_info, foto_url, lat, lng, is_available, expired_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
			RETURNING id, user_id, nama_produk, kategori, harga, satuan,
			          stok_info, foto_url, lat, lng, is_available, expired_at, created_at`
		)
		.bind(
			input.id,
			input.user_id,
			input.nama_produk,
			input.kategori,
			input.harga,
			input.satuan,
			input.stok_info,
			input.foto_url,
			input.lat,
			input.lng,
			input.expired_at
		)
		.first<ProductRecord>();

	if (!row) {
		throw new Error('Gagal menyimpan produk hasil panen.');
	}

	return row;
}

export async function updateProductAvailability(
	db: D1Database,
	productId: string,
	userId: string,
	isAvailable: boolean
): Promise<ProductRecord | null> {
	return db
		.prepare(
			`UPDATE products
			 SET is_available = ?
			 WHERE id = ? AND user_id = ?
			 RETURNING id, user_id, nama_produk, kategori, harga, satuan,
			           stok_info, foto_url, lat, lng, is_available, expired_at, created_at`
		)
		.bind(isAvailable ? 1 : 0, productId, userId)
		.first<ProductRecord>();
}

export async function extendProductExpiry(
	db: D1Database,
	productId: string,
	userId: string,
	newExpiredAt: number
): Promise<ProductRecord | null> {
	return db
		.prepare(
			`UPDATE products
			 SET expired_at = ?, is_available = 1
			 WHERE id = ? AND user_id = ?
			 RETURNING id, user_id, nama_produk, kategori, harga, satuan,
			           stok_info, foto_url, lat, lng, is_available, expired_at, created_at`
		)
		.bind(newExpiredAt, productId, userId)
		.first<ProductRecord>();
}

export async function findProductOwner(
	db: D1Database,
	productId: string
): Promise<{ user_id: string } | null> {
	return db
		.prepare(`SELECT user_id FROM products WHERE id = ?`)
		.bind(productId)
		.first<{ user_id: string }>();
}

/**
 * Menyimpan laporan foto. Laporan ganda dari perangkat yang sama diabaikan
 * berkat indeks unik (product_id, reporter_token).
 */
export async function insertProductReport(
	db: D1Database,
	input: { id: string; productId: string; userId: string; reporterToken: string }
): Promise<void> {
	await db
		.prepare(
			`INSERT OR IGNORE INTO product_reports (id, product_id, user_id, reporter_token)
			 VALUES (?, ?, ?, ?)`
		)
		.bind(input.id, input.productId, input.userId, input.reporterToken)
		.run();
}

/**
 * Menghitung jumlah pelapor unik (per perangkat) untuk seluruh produk penjual.
 */
export async function countDistinctReporters(db: D1Database, userId: string): Promise<number> {
	const row = await db
		.prepare(
			`SELECT COUNT(DISTINCT reporter_token) AS total FROM product_reports WHERE user_id = ?`
		)
		.bind(userId)
		.first<{ total: number }>();

	return row?.total ?? 0;
}

export interface ProductReportRow {
	id: string;
	reporter_token: string;
	reported_at: number;
	product_id: string;
	nama_produk: string;
	foto_url: string;
	is_available: number;
	user_id: string;
	penjual_nama: string;
	email: string;
	no_wa: string | null;
	is_banned: number;
	strike_count: number;
}

/**
 * Daftar laporan foto terbaru beserta produk dan pemiliknya (untuk panel admin).
 */
export async function listProductReports(
	db: D1Database,
	limit = 200
): Promise<ProductReportRow[]> {
	const result = await db
		.prepare(
			`SELECT
				r.id,
				r.reporter_token,
				r.created_at AS reported_at,
				p.id AS product_id,
				p.nama_produk,
				p.foto_url,
				p.is_available,
				u.id AS user_id,
				u.nama AS penjual_nama,
				u.email,
				u.no_wa,
				u.is_banned,
				u.strike_count
			 FROM product_reports r
			 INNER JOIN products p ON p.id = r.product_id
			 INNER JOIN users u ON u.id = r.user_id
			 ORDER BY r.created_at DESC
			 LIMIT ?`
		)
		.bind(limit)
		.all<ProductReportRow>();

	return result.results ?? [];
}

/**
 * Menandai laporan seorang penjual sudah ditinjau (dipakai saat membuka blokir).
 */
export async function deleteReportsByUser(db: D1Database, userId: string): Promise<void> {
	await db.prepare(`DELETE FROM product_reports WHERE user_id = ?`).bind(userId).run();
}

/**
 * Menyembunyikan atau menayangkan kembali produk dari panel admin.
 */
export async function setProductAvailabilityAsModerator(
	db: D1Database,
	productId: string,
	isAvailable: boolean
): Promise<{ nama_produk: string } | null> {
	return db
		.prepare(
			`UPDATE products
			 SET is_available = ?
			 WHERE id = ?
			 RETURNING nama_produk`
		)
		.bind(isAvailable ? 1 : 0, productId)
		.first<{ nama_produk: string }>();
}

/**
 * Menghapus produk dari panel admin tanpa cek kepemilikan.
 */
export async function deleteProductAsModerator(
	db: D1Database,
	productId: string
): Promise<{ nama_produk: string; foto_url: string } | null> {
	return db
		.prepare(`DELETE FROM products WHERE id = ? RETURNING nama_produk, foto_url`)
		.bind(productId)
		.first<{ nama_produk: string; foto_url: string }>();
}

/**
 * Menghapus semua laporan untuk satu produk (dipakai saat admin menghapus produk).
 */
export async function deleteReportsByProduct(db: D1Database, productId: string): Promise<void> {
	await db.prepare(`DELETE FROM product_reports WHERE product_id = ?`).bind(productId).run();
}

export async function deleteProductById(
	db: D1Database,
	productId: string,
	userId: string
): Promise<{ id: string; foto_url: string } | null> {
	return db
		.prepare(
			`DELETE FROM products
			 WHERE id = ? AND user_id = ?
			 RETURNING id, foto_url`
		)
		.bind(productId, userId)
		.first<{ id: string; foto_url: string }>();
}
