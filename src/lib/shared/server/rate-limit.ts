// Batas endpoint laporan foto: 8 laporan per perangkat dan 30 per IP setiap 10 menit.
export const REPORT_RATE_WINDOW_SECONDS = 10 * 60;
export const REPORT_TOKEN_LIMIT = 8;
export const REPORT_IP_LIMIT = 30;

export interface RateLimitResult {
	allowed: boolean;
	/** Sisa kuota pada jendela waktu berjalan. */
	remaining: number;
	/** Detik sampai jendela waktu berikutnya (untuk header Retry-After). */
	retryAfterSeconds: number;
}

const STALE_WINDOW_SECONDS = 24 * 60 * 60;

/**
 * Rate limit fixed-window berbasis D1: satu baris per key, tanpa menambah
 * request Read terpisah (INSERT ... ON CONFLICT ... RETURNING).
 *
 * Key lama dibersihkan saat jendela baru dimulai agar tabel tidak tumbuh
 * tanpa batas oleh token/IP yang sudah tidak aktif.
 */
export async function consumeRateLimit(
	db: D1Database,
	key: string,
	limit: number,
	windowSeconds: number,
	nowUnix = Math.floor(Date.now() / 1000)
): Promise<RateLimitResult> {
	const windowStart = nowUnix - (nowUnix % windowSeconds);
	const retryAfterSeconds = windowStart + windowSeconds - nowUnix;

	const row = await db
		.prepare(
			`INSERT INTO rate_limits (key, window_start, count)
			 VALUES (?, ?, 1)
			 ON CONFLICT(key) DO UPDATE SET
			   count = CASE
			     WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1
			     ELSE 1
			   END,
			   window_start = excluded.window_start
			 RETURNING count`
		)
		.bind(key, windowStart)
		.first<{ count: number }>();

	const count = row?.count ?? 1;

	if (count === 1) {
		await db
			.prepare(`DELETE FROM rate_limits WHERE window_start < ?`)
			.bind(windowStart - STALE_WINDOW_SECONDS)
			.run();
	}

	return {
		allowed: count <= limit,
		remaining: Math.max(0, limit - count),
		retryAfterSeconds
	};
}

/**
 * IP klien dari header Cloudflare, dengan fallback proxy standar.
 * Mengembalikan null bila tidak tersedia (mis. unit test / dev lokal).
 */
export function getClientIp(request: Request): string | null {
	const cfIp = request.headers.get('cf-connecting-ip')?.trim();
	if (cfIp) return cfIp;

	const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
	return forwarded || null;
}
