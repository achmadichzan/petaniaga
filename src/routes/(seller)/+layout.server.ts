import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	if (!locals.user.no_wa && url.pathname !== '/onboarding-wa') {
		throw redirect(303, '/onboarding-wa');
	}

	if (locals.user.no_wa && url.pathname === '/onboarding-wa') {
		throw redirect(303, '/dashboard');
	}

	return {
		user: locals.user
	};
};

