export interface CompressedImageResult {
	file: File;
	mimeType: string;
	originalSize: number;
	compressedSize: number;
	width: number;
	height: number;
}

const TARGET_MAX_BYTES = 80 * 1024; // ~80 KB agar cepat di sinyal kebun & hemat R2
const MAX_DIMENSION = 1024;
const MIN_STEP_DIMENSION = 320;
const QUALITY_STEPS = [0.82, 0.68, 0.56, 0.44, 0.34];
const PASSTHROUGH_MIMES = new Set(['image/webp', 'image/jpeg', 'image/png']);

interface LoadedImageSource {
	width: number;
	height: number;
	draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
	cleanup: () => void;
}

function isHeicFile(file: File): boolean {
	return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

function unreadableImageError(file: File): Error {
	if (isHeicFile(file)) {
		return new Error(
			'Format foto HEIC/HEIF belum didukung browser ini. Gunakan foto JPG/PNG atau aktifkan "Most Compatible" di pengaturan kamera HP.'
		);
	}
	return new Error('Gagal membaca file gambar. Pastikan file tidak rusak.');
}

/**
 * Matte used to flatten transparent pixels before encoding. The colour lives in
 * tokens.css as `--color-photo-matte`; `white` is only a safety net for a
 * document without tokens (canvas would otherwise keep its black default).
 */
let matteCache: string | null = null;
function photoMatte(): string {
	if (matteCache) return matteCache;
	if (typeof document === 'undefined' || !document.documentElement || typeof getComputedStyle !== 'function') {
		return 'white';
	}
	const fromTokens = getComputedStyle(document.documentElement)
		.getPropertyValue('--color-photo-matte')
		.trim();
	if (fromTokens) matteCache = fromTokens;
	return fromTokens || 'white';
}

function canvasToBlob(
	canvas: HTMLCanvasElement,
	mimeType: string,
	quality: number
): Promise<Blob | null> {
	return new Promise((resolve) => {
		canvas.toBlob((blob) => resolve(blob), mimeType, quality);
	});
}

async function loadImageElement(file: File): Promise<LoadedImageSource> {
	if (typeof createImageBitmap === 'function') {
		try {
			const bitmap = await createImageBitmap(file);
			return {
				width: bitmap.width,
				height: bitmap.height,
				draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
				cleanup: () => bitmap.close()
			};
		} catch {
			// Browser tertentu gagal mem-parse lewat createImageBitmap meski <img> bisa; coba fallback hanya non-HEIC
			if (isHeicFile(file) || typeof Image === 'undefined') {
				throw unreadableImageError(file);
			}
		}
	}

	if (typeof Image === 'undefined') {
		throw unreadableImageError(file);
	}

	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			resolve({
				width: img.naturalWidth,
				height: img.naturalHeight,
				draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
				cleanup: () => URL.revokeObjectURL(url)
			});
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(unreadableImageError(file));
		};
		img.src = url;
	});
}

/**
 * Mengompres foto kamera HP langsung di browser ke format WebP (~50-80 KB)
 * menggunakan HTML5 <canvas>. Menurunkan dimensi bertahap bila ukuran masih
 * melebihi target, dan fallback ke JPEG bila encoding WebP tidak didukung.
 */
export async function compressImageToWebP(
	file: File,
	options?: {
		maxDimension?: number;
		targetMaxBytes?: number;
	}
): Promise<CompressedImageResult> {
	if (!file || file.size === 0) {
		throw new Error('File gambar kosong atau tidak valid.');
	}
	if (file.type && !file.type.startsWith('image/')) {
		throw new Error('File yang dipilih harus berupa gambar.');
	}

	const maxDimension = options?.maxDimension ?? MAX_DIMENSION;
	const targetMaxBytes = options?.targetMaxBytes ?? TARGET_MAX_BYTES;

	const source = await loadImageElement(file);
	try {
		if (source.width <= 0 || source.height <= 0) {
			throw new Error('Dimensi gambar tidak valid.');
		}

		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Browser tidak mendukung pemrosesan gambar Canvas.');
		}

		const sourceMaxSide = Math.max(source.width, source.height);
		let currentMaxSide = Math.min(sourceMaxSide, maxDimension);
		let preferredMime = 'image/webp';
		let bestCandidate: { blob: Blob; width: number; height: number } | null = null;
		let reachedTarget = false;

		for (let pass = 0; pass < 3; pass++) {
			const scale = Math.min(1, currentMaxSide / sourceMaxSide);
			const width = Math.max(1, Math.round(source.width * scale));
			const height = Math.max(1, Math.round(source.height * scale));

			canvas.width = width;
			canvas.height = height;

			// Latar matte mencegah area transparan PNG berubah hitam saat fallback JPEG
			ctx.fillStyle = photoMatte();
			ctx.fillRect(0, 0, width, height);
			source.draw(ctx, width, height);

			for (const quality of QUALITY_STEPS) {
				let blob = await canvasToBlob(canvas, preferredMime, quality);
				// Safari lama mengembalikan image/png saat image/webp tidak didukung
				if (!blob || (preferredMime === 'image/webp' && blob.type !== 'image/webp')) {
					preferredMime = 'image/jpeg';
					blob = await canvasToBlob(canvas, preferredMime, quality);
				}
				if (!blob) continue;

				if (!bestCandidate || blob.size < bestCandidate.blob.size) {
					bestCandidate = { blob, width, height };
				}
				if (blob.size <= targetMaxBytes) {
					bestCandidate = { blob, width, height };
					reachedTarget = true;
					break;
				}
			}

			if (reachedTarget) break;

			const nextMaxSide = Math.max(MIN_STEP_DIMENSION, Math.round(currentMaxSide * 0.75));
			if (nextMaxSide >= currentMaxSide) break;
			currentMaxSide = nextMaxSide;
		}

		if (!bestCandidate) {
			throw new Error('Gagal mengompres foto.');
		}

		const canPassthrough =
			PASSTHROUGH_MIMES.has(file.type) &&
			sourceMaxSide <= maxDimension &&
			file.size <= targetMaxBytes &&
			bestCandidate.blob.size >= file.size;

		if (canPassthrough) {
			return {
				file,
				mimeType: file.type,
				originalSize: file.size,
				compressedSize: file.size,
				width: source.width,
				height: source.height
			};
		}

		const ext = bestCandidate.blob.type === 'image/webp' ? 'webp' : 'jpg';
		const baseName = file.name.replace(/\.[^.]+$/, '') || 'panen';
		const compressedFile = new File([bestCandidate.blob], `${baseName}.${ext}`, {
			type: bestCandidate.blob.type,
			lastModified: Date.now()
		});

		return {
			file: compressedFile,
			mimeType: bestCandidate.blob.type,
			originalSize: file.size,
			compressedSize: bestCandidate.blob.size,
			width: bestCandidate.width,
			height: bestCandidate.height
		};
	} finally {
		source.cleanup();
	}
}

export function formatBytesCompact(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${Math.round(kb)} KB`;
	return `${(kb / 1024).toFixed(1)} MB`;
}
