import { decodeIdToken, generateCodeVerifier, generateState, Google } from 'arctic';
import { UnauthorizedError } from '#shared/server/errors.ts';
import type { GoogleOAuthConfig } from '#shared/server/env.ts';
import type { GoogleProfile } from '../types';

export const OAUTH_STATE_COOKIE = 'temutani_oauth_state';
export const OAUTH_VERIFIER_COOKIE = 'temutani_oauth_verifier';

export function createGoogleOAuthClient(config: GoogleOAuthConfig): Google {
	return new Google(config.clientId, config.clientSecret, config.redirectUri);
}

export function createGoogleAuthorizationRedirect(config: GoogleOAuthConfig): {
	url: URL;
	state: string;
	codeVerifier: string;
} {
	const google = createGoogleOAuthClient(config);
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);

	return { url, state, codeVerifier };
}

interface GoogleIdTokenClaims {
	sub?: unknown;
	name?: unknown;
	email?: unknown;
}

export async function exchangeGoogleCallbackCode(
	config: GoogleOAuthConfig,
	code: string,
	codeVerifier: string
): Promise<GoogleProfile> {
	const google = createGoogleOAuthClient(config);
	const tokens = await google.validateAuthorizationCode(code, codeVerifier);
	const claims = decodeIdToken(tokens.idToken()) as GoogleIdTokenClaims;

	if (typeof claims.sub !== 'string' || !claims.sub) {
		throw new UnauthorizedError('Profil akun Google tidak memiliki ID pengguna.');
	}

	const email = typeof claims.email === 'string' && claims.email ? claims.email : '';
	const nama =
		typeof claims.name === 'string' && claims.name.trim()
			? claims.name.trim()
			: email.split('@')[0] || 'Penjual Petaniaga';

	return {
		id: claims.sub,
		nama,
		email
	};
}
