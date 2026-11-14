import type { BoundingBox, MapProductItem } from '../types';

export const MAP_QUERY_LIMIT = 100;

export interface BoundingBoxQueryParams {
	bounds: BoundingBox;
	kategori?: string;
	nowUnix: number;
	limit?: number;
}

/**
 * Mengambil daftar hasil panen aktif di dalam kotak batas layar peta (Bounding Box).
 * Memanfaatkan indeks `idx_peta_produk (is_available, lat, lng, expired_at)` tanpa rumus Haversine di SQL.
 */
export async function findProductsInBoundingBox(
	db: D1Database,
	params: BoundingBoxQueryParams
): Promise<MapProductItem[]> {
	const limit = Math.min(params.limit ?? MAP_QUERY_LIMIT, MAP_QUERY_LIMIT);
	const bindings: unknown[] = [
		params.bounds.south,
		params.bounds.north,
		params.bounds.west,
		params.bounds.east,
		params.nowUnix
	];

	let kategoriFilterSql = '';
	if (params.kategori && params.kategori !== 'semua') {
		kategoriFilterSql = ' AND p.kategori = ?';
		bindings.push(params.kategori);
	}

	bindings.push(limit);

	const sql = `
		SELECT
			p.id,
			p.user_id,
			p.nama_produk,
			p.kategori,
			p.harga,
			p.satuan,
			p.stok_info,
			p.foto_url,
			p.lat,
			p.lng,
			p.expired_at,
			p.created_at,
			u.nama AS penjual_nama,
			u.no_wa,
			u.is_open,
			u.jam_buka,
			u.jam_tutup
		FROM products p
		INNER JOIN users u ON u.id = p.user_id
		WHERE p.is_available = 1
			AND p.lat BETWEEN ? AND ?
			AND p.lng BETWEEN ? AND ?
			AND p.expired_at > ?
			AND u.no_wa IS NOT NULL
			AND u.is_banned = 0
			${kategoriFilterSql}
		LIMIT ?
	`;

	const result = await db
		.prepare(sql)
		.bind(...bindings)
		.all<MapProductItem>();

	return result.results ?? [];
}

