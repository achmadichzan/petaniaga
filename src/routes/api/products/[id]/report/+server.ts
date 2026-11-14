import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reportHarvestProduct } from '#modules/catalog/server/catalog.service.ts';
import { getDb } from '#shared/server/env.ts';
import { AppError, toUserMessage } from '#shared/server/errors.ts';
import {
	consumeRateLimit,
	getClientIp,
	REPORT_IP_LIMIT,
	REPORT_RATE_WINDOW_SECONDS,
	REPORT_TOKEN_LIMIT
} from '#shared/server/rate-limit.ts';

const REPORTER_COOKIE = 'petaniaga_reporter';
const REPORTER_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECEIVED_MESSAGE =
	'Laporan diterima. Terima kasih, foto ini akan segera ditinjau oleh tim kami.';
const RATE_LIMIT_MESSAGE =
	'Terlalu banyak laporan dalam waktu singkat. Silakan coba lagi beberapa menit lagi.';


function rateLimited(retryAfterSeconds: number) {
	return json(
		{ message: RATE_LIMIT_MESSAGE },
		{
			status: 429,
			headers: { 'Retry-After': String(Math.max(1, retryAfterSeconds)) }
		}
	);
}

/**
 * Menerima laporan foto produk dari pembeli (tanpa perlu login).
 * Identitas pelapor unik disimpan sebagai token anonim di cookie HttpOnly,
 * sehingga satu perangkat hanya dihitung sekali per produk. Request dibatasi
 * per perangkat dan per IP agar endpoint tidak bisa dibanjiri.
 */
export const POST: RequestHandler = async ({ params, locals, cookies, url, request }) => {
	try {
		const db = getDb();
		const existingToken = cookies.get(REPORTER_COOKIE);
		let token = existingToken && TOKEN_RE.test(existingToken) ? existingToken : null;
		if (!token) {
			token = crypto.randomUUID();
			cookies.set(REPORTER_COOKIE, token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: url.protocol === 'https:',
				maxAge: REPORTER_COOKIE_MAX_AGE
			});
		}

		const tokenLimit = await consumeRateLimit(
			db,
			`report:token:${token}`,
			REPORT_TOKEN_LIMIT,
			REPORT_RATE_WINDOW_SECONDS
		);
		if (!tokenLimit.allowed) {
			return rateLimited(tokenLimit.retryAfterSeconds);
		}

		const ip = getClientIp(request);
		if (ip) {
			const ipLimit = await consumeRateLimit(
				db,
				`report:ip:${ip.slice(0, 64)}`,
				REPORT_IP_LIMIT,
				REPORT_RATE_WINDOW_SECONDS
			);
			if (!ipLimit.allowed) {
				return rateLimited(ipLimit.retryAfterSeconds);
			}
		}

		await reportHarvestProduct(db, params.id ?? '', token, locals.user?.id ?? null);
		return json({ message: RECEIVED_MESSAGE });
	} catch (err) {
		const status = err instanceof AppError ? err.statusCode : 500;
		if (!(err instanceof AppError)) {
			console.error('[reportProduct]', err);
		}
		return json({ message: toUserMessage(err, 'Gagal mengirim laporan.') }, { status });
	}
};
