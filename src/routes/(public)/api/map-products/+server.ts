import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchMapProducts } from '#modules/geo/server/geo.service.ts';
import { getDb } from '#shared/server/env.ts';
import { AppError, toUserMessage } from '#shared/server/errors.ts';

export const GET: RequestHandler = async ({ url }) => {
	const north = Number(url.searchParams.get('north'));
	const south = Number(url.searchParams.get('south'));
	const east = Number(url.searchParams.get('east'));
	const west = Number(url.searchParams.get('west'));
	const zoomParam = url.searchParams.get('zoom');
	const zoom = zoomParam !== null ? Number(zoomParam) : undefined;
	const kategori = url.searchParams.get('kategori');

	try {
		const result = await searchMapProducts(getDb(), {
			north,
			south,
			east,
			west,
			zoom,
			kategori
		});

		return json(result, {
			headers: {
				'Cache-Control': 'no-store'
			}
		});
	} catch (err) {
		const status = err instanceof AppError ? err.statusCode : 500;
		return json(
			{ message: toUserMessage(err, 'Gagal mengambil data hasil panen.') },
			{ status }
		);
	}
};
