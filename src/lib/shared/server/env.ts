import { dev } from '$app/env';
import { env } from 'cloudflare:workers';
import { ConfigError } from './errors.ts';

const DEV_FALLBACK_JWT_SECRET = 'temutani-dev-only-jwt-secret-jangan-dipakai-di-produksi';

export interface GoogleOAuthConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}

export function getDb(): D1Database {
	if (!env?.DB) {
		throw new ConfigError('Binding Cloudflare D1 (DB) belum tersedia.');
	}
	return env.DB;
}

export function getR2Bucket(): R2Bucket {
	if (!env?.R2_BUCKET) {
		throw new ConfigError('Binding Cloudflare R2 (R2_BUCKET) belum tersedia.');
	}
	return env.R2_BUCKET;
}

/**
 * Daftar email admin dari environment variable `ADMIN_EMAILS` (dipisah koma).
 * Kosong berarti tidak ada akun yang bisa membuka panel admin.
 */
export function getAdminEmails(): string[] {
	return (env?.ADMIN_EMAILS ?? '')
		.split(',')
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
}

export function getAi(): Ai | null {
	return env?.AI ?? null;
}

export function getJwtSecret(): string {
	const secret = env?.JWT_SECRET?.trim();
	if (secret && secret.length >= 16) {
		return secret;
	}
	if (dev) {
		return DEV_FALLBACK_JWT_SECRET;
	}
	throw new ConfigError('Environment variable JWT_SECRET wajib diisi minimal 16 karakter.');
}

export function getGoogleOAuthConfig(requestUrl: URL): GoogleOAuthConfig {
	const clientId = env?.GOOGLE_CLIENT_ID?.trim();
	const clientSecret = env?.GOOGLE_CLIENT_SECRET?.trim();

	if (!clientId || !clientSecret) {
		throw new ConfigError(
			'GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum diisi di .dev.vars atau Cloudflare Pages Environment Variables.'
		);
	}

	const appUrl = env?.APP_URL?.trim().replace(/\/+$/, '') || requestUrl.origin;
	return {
		clientId,
		clientSecret,
		redirectUri: `${appUrl}/auth/callback/google`
	};
}

export function isGoogleOAuthConfigured(): boolean {
	return Boolean(env?.GOOGLE_CLIENT_ID?.trim() && env?.GOOGLE_CLIENT_SECRET?.trim());
}

export function isDevLoginEnabled(): boolean {
	return dev && env?.ENABLE_DEV_LOGIN?.trim() === 'true';
}
