import type { Handle } from '@sveltejs/kit/hooks';
import { SESSION_COOKIE_NAME, verifySessionJwt } from '#modules/auth/server/jwt.ts';
import { getJwtSecret } from '#shared/server/env.ts';

export const handle: Handle = async ({ event, resolve }) => {
	const country = event.request?.headers.get('cf-ipcountry');
	if (country && country.toUpperCase() !== 'ID') {
		return new Response('Akses dibatasi hanya untuk wilayah Indonesia.', { status: 403 });
	}

	const token = event.cookies.get(SESSION_COOKIE_NAME);
	if (token) {
		event.locals.user = await verifySessionJwt(token, getJwtSecret());
	} else {
		event.locals.user = null;
	}

	const response = await resolve(event);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()');
	return response;
};
