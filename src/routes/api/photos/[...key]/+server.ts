import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getR2Bucket } from '#shared/server/env.ts';
import { getProductPhoto } from '#shared/server/r2.ts';

export const GET: RequestHandler = async ({ params }) => {
	const key = params.key;
	if (!key) {
		throw error(404, 'Foto tidak ditemukan.');
	}

	const object = await getProductPhoto(getR2Bucket(), key);
	if (!object) {
		throw error(404, 'Foto tidak ditemukan.');
	}

	const headers = new Headers();
	headers.set('Content-Type', object.httpMetadata?.contentType || 'image/webp');
	headers.set('Cache-Control', 'public, max-age=31536000, immutable');
	headers.set('X-Content-Type-Options', 'nosniff');
	if (object.httpEtag) {
		headers.set('ETag', object.httpEtag);
	}

	return new Response(object.body, { headers });
};
