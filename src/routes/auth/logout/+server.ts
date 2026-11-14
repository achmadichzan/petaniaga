import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearSessionCookie } from '#modules/auth/server/jwt.ts';

export const POST: RequestHandler = async ({ cookies, url }) => {
	clearSessionCookie(cookies, url.protocol === 'https:');
	throw redirect(303, '/');
};
