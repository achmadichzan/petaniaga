import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImageToWebP, formatBytesCompact } from './image';

function stubCanvasEnvironment(options: {
	srcWidth: number;
	srcHeight: number;
	rejectDecode?: boolean;
	sizeForAttempt: (params: { width: number; height: number; mime: string; quality: number }) => {
		bytes: number;
		mime?: string;
	};
}) {
	const closeSpy = vi.fn();
	const fillRectSpy = vi.fn();
	const drawImageSpy = vi.fn();
	const attemptedSizes: Array<{ width: number; height: number; mime: string; quality: number }> = [];

	vi.stubGlobal('createImageBitmap', async () => {
		if (options.rejectDecode) {
			throw new Error('decode failed');
		}
		return {
			width: options.srcWidth,
			height: options.srcHeight,
			close: closeSpy
		};
	});

	const canvas = {
		width: 0,
		height: 0,
		getContext: () => ({
			fillStyle: '',
			fillRect: fillRectSpy,
			drawImage: drawImageSpy
		}),
		toBlob: (cb: (blob: Blob | null) => void, mime: string, quality: number) => {
			attemptedSizes.push({ width: canvas.width, height: canvas.height, mime, quality });
			const out = options.sizeForAttempt({
				width: canvas.width,
				height: canvas.height,
				mime,
				quality
			});
			cb(new Blob([new Uint8Array(out.bytes)], { type: out.mime ?? mime }));
		}
	};

	vi.stubGlobal('document', {
		createElement: () => canvas
	});

	return { closeSpy, fillRectSpy, drawImageSpy, attemptedSizes };
}

describe('image compression utils', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('memformat ukuran byte secara ringkas', () => {
		expect(formatBytesCompact(512)).toBe('512 B');
		expect(formatBytesCompact(45 * 1024)).toBe('45 KB');
		expect(formatBytesCompact(1.5 * 1024 * 1024)).toBe('1.5 MB');
	});

	it('menolak file kosong, non-gambar, dan memberi pesan jelas untuk HEIC', async () => {
		await expect(compressImageToWebP(new File([], 'kosong.jpg', { type: 'image/jpeg' }))).rejects.toThrow(
			/kosong/i
		);
		await expect(
			compressImageToWebP(new File(['abc'], 'doc.pdf', { type: 'application/pdf' }))
		).rejects.toThrow(/harus berupa gambar/i);

		stubCanvasEnvironment({
			srcWidth: 1000,
			srcHeight: 1000,
			rejectDecode: true,
			sizeForAttempt: () => ({ bytes: 1000 })
		});
		await expect(
			compressImageToWebP(new File(['heic'], 'IMG_001.heic', { type: 'image/heic' }))
		).rejects.toThrow(/HEIC/i);
	});

	it('mengecilkan dimensi ke 1024px, menggambar latar putih, dan menutup bitmap', async () => {
		const env = stubCanvasEnvironment({
			srcWidth: 3000,
			srcHeight: 2000,
			sizeForAttempt: () => ({ bytes: 52 * 1024 })
		});

		const raw = new File([new Uint8Array(900 * 1024)], 'cabai.jpg', { type: 'image/jpeg' });
		const res = await compressImageToWebP(raw);

		expect(res.width).toBe(1024);
		expect(res.height).toBe(683);
		expect(res.mimeType).toBe('image/webp');
		expect(res.file.name).toBe('cabai.webp');
		expect(res.compressedSize).toBe(52 * 1024);
		expect(env.fillRectSpy).toHaveBeenCalledWith(0, 0, 1024, 683);
		expect(env.closeSpy).toHaveBeenCalledTimes(1);
	});

	it('menurunkan dimensi bertahap bila di 1024px ukuran masih melebihi target 80 KB', async () => {
		stubCanvasEnvironment({
			srcWidth: 2048,
			srcHeight: 1024,
			sizeForAttempt: ({ width, quality }) => ({
				bytes: width > 800 || quality > 0.7 ? 110 * 1024 : 68 * 1024
			})
		});

		const raw = new File([new Uint8Array(500 * 1024)], 'daun.png', { type: 'image/png' });
		const res = await compressImageToWebP(raw);

		expect(res.width).toBe(768);
		expect(res.height).toBe(384);
		expect(res.compressedSize).toBe(68 * 1024);
	});

	it('fallback ke JPEG saat browser mengembalikan PNG untuk request WebP', async () => {
		stubCanvasEnvironment({
			srcWidth: 800,
			srcHeight: 600,
			sizeForAttempt: ({ mime }) =>
				mime === 'image/webp'
					? { bytes: 150 * 1024, mime: 'image/png' }
					: { bytes: 60 * 1024, mime: 'image/jpeg' }
		});

		const raw = new File([new Uint8Array(250 * 1024)], 'tomat.png', { type: 'image/png' });
		const res = await compressImageToWebP(raw);

		expect(res.mimeType).toBe('image/jpeg');
		expect(res.file.name).toBe('tomat.jpg');
	});

	it('tidak memperbesar file valid yang ukurannya sudah kecil di bawah batas', async () => {
		stubCanvasEnvironment({
			srcWidth: 800,
			srcHeight: 600,
			sizeForAttempt: () => ({ bytes: 48 * 1024 })
		});

		const small = new File([new Uint8Array(35 * 1024)], 'mini.webp', { type: 'image/webp' });
		const res = await compressImageToWebP(small);

		expect(res.file).toBe(small);
		expect(res.compressedSize).toBe(35 * 1024);
	});
});
