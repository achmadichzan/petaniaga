import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { setSessionCookie } from '#modules/auth/server/jwt.ts';
import { loginWithGoogleProfile } from '#modules/auth/server/auth.service.ts';
import {
	getDb,
	getJwtSecret,
	isDevLoginEnabled,
	isGoogleOAuthConfigured
} from '#shared/server/env.ts';
import { toUserMessage } from '#shared/server/errors.ts';

const ERROR_MESSAGES: Record<string, string> = {
	oauth_cancelled: 'Login Google dibatalkan.',
	oauth_invalid: 'Sesi login Google kedaluwarsa atau tidak valid. Silakan coba lagi.',
	oauth_config:
		'Konfigurasi Google OAuth belum diisi di server (.dev.vars / Cloudflare Environment Variables).',
	oauth_failed: 'Terjadi gangguan saat memverifikasi akun Google Anda. Coba beberapa saat lagi.'
};

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		throw redirect(303, locals.user.no_wa ? '/dashboard' : '/onboarding-wa');
	}

	const errorCode = url.searchParams.get('error');
	return {
		oauthConfigured: isGoogleOAuthConfigured(),
		devLoginEnabled: isDevLoginEnabled(),
		errorMessage: errorCode ? ERROR_MESSAGES[errorCode] ?? 'Gagal masuk.' : null
	};
};

export const actions: Actions = {
	devLogin: async ({ cookies, url }) => {
		if (!isDevLoginEnabled()) {
			return fail(403, { error: 'Login uji coba lokal tidak diaktifkan.' });
		}

		try {
			const { user, token } = await loginWithGoogleProfile(
				getDb(),
				{
					id: 'dev-seller-local',
					nama: 'Penjual Uji Coba Lokal',
					email: 'penjual.lokal@petaniaga.test'
				},
				getJwtSecret()
			);

			setSessionCookie(cookies, token, url.protocol === 'https:');
			throw redirect(303, user.no_wa ? '/dashboard' : '/onboarding-wa');
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
				throw err;
			}
			return fail(500, { error: toUserMessage(err) });
		}
	}
};
