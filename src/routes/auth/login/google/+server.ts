import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createGoogleAuthorizationRedirect,
	OAUTH_STATE_COOKIE,
	OAUTH_VERIFIER_COOKIE
} from '#modules/auth/server/oauth.ts';
import { getGoogleOAuthConfig } from '#shared/server/env.ts';

export const GET: RequestHandler = async ({ cookies, url }) => {
	let config;
	try {
		config = getGoogleOAuthConfig(url);
	} catch {
		throw redirect(303, '/login?error=oauth_config');
	}

	const { url: authUrl, state, codeVerifier } = createGoogleAuthorizationRedirect(config);
	const isSecure = url.protocol === 'https:';

	cookies.set(OAUTH_STATE_COOKIE, state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecure,
		maxAge: 600
	});

	cookies.set(OAUTH_VERIFIER_COOKIE, codeVerifier, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecure,
		maxAge: 600
	});

	throw redirect(302, authUrl.toString(), {
		external: ['https://accounts.google.com']
	});
};
