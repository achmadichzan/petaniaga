import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { setSessionCookie } from '#modules/auth/server/jwt.ts';
import { completeWaOnboarding } from '#modules/auth/server/auth.service.ts';
import { getDb, getJwtSecret } from '#shared/server/env.ts';
import { AppError, toUserMessage } from '#shared/server/errors.ts';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();
	return { user };
};

export const actions: Actions = {
	default: async ({ request, locals, cookies, url }) => {
		if (!locals.user) {
			throw redirect(303, '/login');
		}

		const formData = await request.formData();
		const rawWa = String(formData.get('no_wa') ?? '');

		try {
			const { sessionUser, token } = await completeWaOnboarding(
				getDb(),
				locals.user.id,
				rawWa,
				getJwtSecret()
			);

			setSessionCookie(cookies, token, url.protocol === 'https:');
			locals.user = sessionUser;
		} catch (err) {
			const status = err instanceof AppError ? err.statusCode : 500;
			return fail(status, {
				error: toUserMessage(err, 'Gagal menyimpan nomor WhatsApp.')
			});
		}

		throw redirect(303, '/dashboard');
	}
};
