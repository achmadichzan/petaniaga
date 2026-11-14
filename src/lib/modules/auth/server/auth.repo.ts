import type { SellerUser, GoogleProfile } from '../types';

export async function upsertGoogleUser(db: D1Database, profile: GoogleProfile): Promise<SellerUser> {
	const row = await db
		.prepare(
			`INSERT INTO users (id, nama, email)
			 VALUES (?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
			   nama = excluded.nama,
			   email = excluded.email
			 RETURNING id, nama, email, no_wa, default_lat, default_lng, is_open, jam_buka, jam_tutup, strike_count, is_banned, created_at`
		)
		.bind(profile.id, profile.nama, profile.email)
		.first<SellerUser>();

	if (!row) {
		throw new Error('Gagal menyimpan data akun penjual ke database.');
	}

	return row;
}

export async function findUserById(db: D1Database, userId: string): Promise<SellerUser | null> {
	return db
		.prepare(
			`SELECT id, nama, email, no_wa, default_lat, default_lng, is_open, jam_buka, jam_tutup, strike_count, is_banned, created_at
			 FROM users
			 WHERE id = ?`
		)
		.bind(userId)
		.first<SellerUser>();
}

export async function findUserByWa(db: D1Database, noWa: string): Promise<{ id: string } | null> {
	return db.prepare(`SELECT id FROM users WHERE no_wa = ?`).bind(noWa).first<{ id: string }>();
}

export async function updateUserWa(
	db: D1Database,
	userId: string,
	noWa: string
): Promise<SellerUser | null> {
	return db
		.prepare(
			`UPDATE users
			 SET no_wa = ?
			 WHERE id = ?
			 RETURNING id, nama, email, no_wa, default_lat, default_lng, is_open, jam_buka, jam_tutup, strike_count, is_banned, created_at`
		)
		.bind(noWa, userId)
		.first<SellerUser>();
}

export async function updateUserLapak(
	db: D1Database,
	userId: string,
	isOpen: boolean,
	jamBuka: string | null,
	jamTutup: string | null
): Promise<SellerUser | null> {
	return db
		.prepare(
			`UPDATE users
			 SET is_open = ?, jam_buka = ?, jam_tutup = ?
			 WHERE id = ?
			 RETURNING id, nama, email, no_wa, default_lat, default_lng, is_open, jam_buka, jam_tutup, strike_count, is_banned, created_at`
		)
		.bind(isOpen ? 1 : 0, jamBuka, jamTutup, userId)
		.first<SellerUser>();
}

/**
 * Mencatat satu pelanggaran foto. Pada pelanggaran ke-3 akun otomatis
 * dinonaktifkan dan seluruh produknya disembunyikan dari peta.
 */
export async function recordModerationStrike(
	db: D1Database,
	userId: string
): Promise<{ strike_count: number; is_banned: number }> {
	const row = await db
		.prepare(
			`UPDATE users
			 SET strike_count = strike_count + 1,
			     is_banned = CASE WHEN strike_count + 1 >= 3 THEN 1 ELSE is_banned END
			 WHERE id = ?
			 RETURNING strike_count, is_banned`
		)
		.bind(userId)
		.first<{ strike_count: number; is_banned: number }>();

	if (row?.is_banned === 1) {
		await db.prepare(`UPDATE products SET is_available = 0 WHERE user_id = ?`).bind(userId).run();
	}

	return row ?? { strike_count: 1, is_banned: 0 };
}

/**
 * Menonaktifkan akun penjual dan menyembunyikan seluruh lapaknya dari peta.
 */
export async function banSeller(db: D1Database, userId: string): Promise<void> {
	await db.prepare(`UPDATE users SET is_banned = 1 WHERE id = ?`).bind(userId).run();
	await db.prepare(`UPDATE products SET is_available = 0 WHERE user_id = ?`).bind(userId).run();
}

/**
 * Membuka blokir akun dan mengosongkan kembali hitungan pelanggaran AI.
 */
export async function unbanSeller(db: D1Database, userId: string): Promise<void> {
	await db
		.prepare(`UPDATE users SET is_banned = 0, strike_count = 0 WHERE id = ?`)
		.bind(userId)
		.run();
}

export async function updateUserDefaultLocation(
	db: D1Database,
	userId: string,
	lat: number,
	lng: number
): Promise<void> {
	await db
		.prepare(
			`UPDATE users
			 SET default_lat = ?, default_lng = ?
			 WHERE id = ?`
		)
		.bind(lat, lng, userId)
		.run();
}

