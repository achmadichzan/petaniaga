import { describe, expect, it } from 'vitest';
import {
	deleteProductPhotoByUrl,
	extractR2KeyFromUrl,
	getProductPhoto,
	uploadProductPhoto
} from './r2';

function createMockBucket() {
	const store = new Map<string, { body: ArrayBuffer; contentType: string }>();
	return {
		store,
		bucket: {
			async put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) {
				store.set(key, {
					body: value,
					contentType: opts?.httpMetadata?.contentType ?? 'application/octet-stream'
				});
			},
			async get(key: string) {
				const found = store.get(key);
				if (!found) return null;
				return {
					body: found.body,
					httpMetadata: { contentType: found.contentType },
					httpEtag: '"mock-etag"'
				};
			},
			async delete(key: string) {
				store.delete(key);
			}
		} as unknown as R2Bucket
	};
}

describe('r2 helper', () => {
	it('mengunggah, membaca, dan menghapus foto produk di R2', async () => {
		const { bucket, store } = createMockBucket();
		const bytes = new TextEncoder().encode('fake-webp').buffer;

		const url = await uploadProductPhoto(bucket, 'products/u1/p1.webp', bytes, 'image/webp');
		expect(url).toBe('/api/photos/products/u1/p1.webp');
		expect(store.has('products/u1/p1.webp')).toBe(true);

		const fetched = await getProductPhoto(bucket, 'products/u1/p1.webp');
		expect(fetched).not.toBeNull();

		await deleteProductPhotoByUrl(bucket, url);
		expect(store.has('products/u1/p1.webp')).toBe(false);
	});

	it('menolak key di luar prefix products/ atau mengandung path traversal', async () => {
		const { bucket } = createMockBucket();
		const bytes = new ArrayBuffer(4);

		await expect(uploadProductPhoto(bucket, '../secret.txt', bytes, 'image/webp')).rejects.toThrow();
		expect(await getProductPhoto(bucket, 'products/../secret')).toBeNull();
		expect(extractR2KeyFromUrl('/seed-photos/sayur.svg')).toBeNull();
		expect(extractR2KeyFromUrl('/api/photos/products/u1/p1.webp')).toBe('products/u1/p1.webp');
	});
});

