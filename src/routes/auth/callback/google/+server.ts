import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setSessionCookie } from '#modules/auth/server/jwt.ts';
import {
	exchangeGoogleCallbackCode,
	OAUTH_STATE_COOKIE,
	OAUTH_VERIFIER_COOKIE
} from '#modules/auth/server/oauth.ts';
import { loginWithGoogleProfile } from '#modules/auth/server/auth.service.ts';
import { getDb, getGoogleOAuthConfig, getJwtSecret } from '#shared/server/env.ts';

export const GET: RequestHandler = async ({ cookies, url }) => {
	if (url.searchParams.get('error')) {
		throw redirect(303, '/login?error=oauth_cancelled');
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get(OAUTH_STATE_COOKIE);
	const codeVerifier = cookies.get(OAUTH_VERIFIER_COOKIE);

	const isSecure = url.protocol === 'https:';
	cookies.delete(OAUTH_STATE_COOKIE, { path: '/', secure: isSecure });
	cookies.delete(OAUTH_VERIFIER_COOKIE, { path: '/', secure: isSecure });

	if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
		throw redirect(303, '/login?error=oauth_invalid');
	}

	let redirectPath = '/dashboard';

	try {
		const config = getGoogleOAuthConfig(url);
		const profile = await exchangeGoogleCallbackCode(config, code, codeVerifier);
		const { user, token } = await loginWithGoogleProfile(getDb(), profile, getJwtSecret());

		setSessionCookie(cookies, token, isSecure);
		redirectPath = user.no_wa ? '/dashboard' : '/onboarding-wa';
	} catch (err) {
		console.error('Google OAuth callback error:', err);
		throw redirect(303, '/login?error=oauth_failed');
	}

	throw redirect(303, redirectPath);
};
