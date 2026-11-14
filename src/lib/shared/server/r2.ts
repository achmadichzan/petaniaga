import { ValidationError } from './errors';

const ALLOWED_KEY_PREFIX = 'products/';

/**
 * Mengunggah foto hasil panen ke Cloudflare R2 dan mengembalikan path endpoint proxy.
 */
export async function uploadProductPhoto(
	bucket: R2Bucket,
	key: string,
	bytes: ArrayBuffer,
	contentType: string
): Promise<string> {
	if (!key.startsWith(ALLOWED_KEY_PREFIX) || key.includes('..')) {
		throw new ValidationError('Key penyimpanan foto tidak valid.');
	}

	await bucket.put(key, bytes, {
		httpMetadata: {
			contentType,
			cacheControl: 'public, max-age=31536000, immutable'
		}
	});

	return `/api/photos/${key}`;
}

/**
 * Mengambil objek foto dari Cloudflare R2 dengan validasi key aman.
 */
export async function getProductPhoto(bucket: R2Bucket, key: string): Promise<R2ObjectBody | null> {
	if (!key || !key.startsWith(ALLOWED_KEY_PREFIX) || key.includes('..')) {
		return null;
	}
	return bucket.get(key);
}

/**
 * Mengekstrak R2 key dari URL foto (`/api/photos/products/...` atau URL custom domain).
 */
export function extractR2KeyFromUrl(fotoUrl: string): string | null {
	const proxyPrefix = '/api/photos/';
	if (fotoUrl.startsWith(proxyPrefix)) {
		const key = fotoUrl.slice(proxyPrefix.length);
		return key.startsWith(ALLOWED_KEY_PREFIX) && !key.includes('..') ? key : null;
	}

	try {
		const parsed = new URL(fotoUrl);
		const idx = parsed.pathname.indexOf(ALLOWED_KEY_PREFIX);
		if (idx !== -1) {
			const key = parsed.pathname.slice(idx);
			return !key.includes('..') ? key : null;
		}
	} catch {
		return null;
	}

	return null;
}

/**
 * Menghapus file foto dari Cloudflare R2 jika URL berasal dari bucket R2.
 */
export async function deleteProductPhotoByUrl(bucket: R2Bucket, fotoUrl: string): Promise<void> {
	const key = extractR2KeyFromUrl(fotoUrl);
	if (!key) return;
	await bucket.delete(key);
}
