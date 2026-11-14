import { describe, expect, it } from 'vitest';
import { isUnsafeImage } from './moderation';

function createMockAi(run: () => Promise<unknown>): Ai {
	return { run } as unknown as Ai;
}

const BYTES = new Uint8Array([1, 2, 3]).buffer;

describe('moderation helper', () => {
	it('mendeteksi jawaban YES dari Workers AI', async () => {
		const ai = createMockAi(async () => ({ response: 'YES' }));
		expect(await isUnsafeImage(ai, BYTES)).toBe(true);
	});

	it('meloloskan foto hasil panen (jawaban NO)', async () => {
		const ai = createMockAi(async () => ({ response: 'NO' }));
		expect(await isUnsafeImage(ai, BYTES)).toBe(false);
	});

	it('fail-open saat binding AI tidak tersedia atau layanan gagal', async () => {
		expect(await isUnsafeImage(null, BYTES)).toBe(false);

		const brokenAi = createMockAi(async () => {
			throw new Error('neurons quota exceeded');
		});
		expect(await isUnsafeImage(brokenAi, BYTES)).toBe(false);
	});
});
