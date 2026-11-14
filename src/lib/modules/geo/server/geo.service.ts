import { isValidCategory, type ProductCategory } from '#shared/constants/harvest.ts';
import { ValidationError } from '#shared/server/errors.ts';
import type { BoundingBox, MapProductsResult } from '../types';
import { findProductsInBoundingBox, MAP_QUERY_LIMIT } from './geo.repo';

const MIN_MAP_ZOOM = 5;
const MAX_LAT_SPAN = 25;
const MAX_LNG_SPAN = 55;

export function parseAndValidateBounds(raw: {
	north: number;
	south: number;
	east: number;
	west: number;
}): BoundingBox {
	const { north, south, east, west } = raw;
	if (![north, south, east, west].every((n) => Number.isFinite(n))) {
		throw new ValidationError('Koordinat batas peta tidak valid.');
	}
	if (south < -90 || north > 90 || south > north) {
		throw new ValidationError('Rentang latitude peta tidak valid.');
	}
	if (west < -180 || east > 180 || west > east) {
		throw new ValidationError('Rentang longitude peta tidak valid.');
	}
	return { north, south, east, west };
}

export function isZoomTooWide(bounds: BoundingBox, zoom?: number): boolean {
	if (zoom !== undefined && Number.isFinite(zoom) && zoom < MIN_MAP_ZOOM) {
		return true;
	}
	return bounds.north - bounds.south > MAX_LAT_SPAN || bounds.east - bounds.west > MAX_LNG_SPAN;
}

export async function searchMapProducts(
	db: D1Database,
	input: {
		north: number;
		south: number;
		east: number;
		west: number;
		kategori?: string | null;
		zoom?: number;
		nowUnix?: number;
	}
): Promise<MapProductsResult> {
	const bounds = parseAndValidateBounds(input);
	const rawKategori = input.kategori?.trim().toLowerCase() ?? 'semua';

	let kategori: ProductCategory | 'semua' = 'semua';
	if (rawKategori && rawKategori !== 'semua') {
		if (!isValidCategory(rawKategori)) {
			throw new ValidationError('Kategori produk tidak dikenali.');
		}
		kategori = rawKategori;
	}

	if (isZoomTooWide(bounds, input.zoom)) {
		return {
			products: [],
			hasMore: false,
			zoomTooWide: true
		};
	}

	const nowUnix = input.nowUnix ?? Math.floor(Date.now() / 1000);
	const products = await findProductsInBoundingBox(db, {
		bounds,
		kategori,
		nowUnix,
		limit: MAP_QUERY_LIMIT
	});

	return {
		products,
		hasMore: products.length >= MAP_QUERY_LIMIT,
		zoomTooWide: false
	};
}
