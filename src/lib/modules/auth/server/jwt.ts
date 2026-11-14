import type { Cookies } from '@sveltejs/kit';
import { SignJWT, jwtVerify } from 'jose';
import type { SessionUser } from '../types';

export const SESSION_COOKIE_NAME = 'petaniaga_session';
export const SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 365 hari

function encodeSecret(secret: string): Uint8Array {
	return new TextEncoder().encode(secret);
}

/**
 * Menandatangani Stateless JWT berumur 1 tahun (365 hari) untuk sesi penjual.
 */
export async function signSessionJwt(user: SessionUser, secret: string): Promise<string> {
	return new SignJWT({
		nama: user.nama,
		no_wa: user.no_wa,
		default_lat: user.default_lat,
		default_lng: user.default_lng
	})
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(user.id)
		.setIssuedAt()
		.setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
		.sign(encodeSecret(secret));
}

/**
 * Memverifikasi JWT langsung di memory (0 kuota D1 read).
 */
export async function verifySessionJwt(token: string, secret: string): Promise<SessionUser | null> {
	if (!token) return null;

	try {
		const { payload } = await jwtVerify(token, encodeSecret(secret), {
			algorithms: ['HS256']
		});

		if (typeof payload.sub !== 'string' || !payload.sub) return null;
		if (typeof payload.nama !== 'string' || !payload.nama) return null;

		const noWa = typeof payload.no_wa === 'string' && payload.no_wa ? payload.no_wa : null;
		const defaultLat =
			typeof payload.default_lat === 'number' && Number.isFinite(payload.default_lat)
				? payload.default_lat
				: null;
		const defaultLng =
			typeof payload.default_lng === 'number' && Number.isFinite(payload.default_lng)
				? payload.default_lng
				: null;

		return {
			id: payload.sub,
			nama: payload.nama,
			no_wa: noWa,
			default_lat: defaultLat,
			default_lng: defaultLng
		};
	} catch {
		return null;
	}
}

export function setSessionCookie(cookies: Cookies, token: string, isSecure: boolean): void {
	cookies.set(SESSION_COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecure,
		maxAge: SESSION_MAX_AGE_SECONDS
	});
}

export function clearSessionCookie(cookies: Cookies, isSecure: boolean): void {
	cookies.delete(SESSION_COOKIE_NAME, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecure
	});
}

