import {
	banSeller,
	findUserById,
	recordModerationStrike,
	unbanSeller,
	updateUserDefaultLocation
} from '#modules/auth/server/auth.repo.ts';
import {
	isValidCategory,
	isValidUnit,
	PRODUCT_EXPIRY_SECONDS
} from '#shared/constants/harvest.ts';
import { NotFoundError, ValidationError } from '#shared/server/errors.ts';
import { isUnsafeImage } from '#shared/server/moderation.ts';
import { deleteProductPhotoByUrl, uploadProductPhoto } from '#shared/server/r2.ts';
import type { CreateProductInput, ProductRecord } from '../types';
import {
	countDistinctReporters,
	countProductsBySeller,
	deleteProductAsModerator,
	deleteProductById,
	deleteReportsByProduct,
	deleteReportsByUser,
	extendProductExpiry,
	findProductOwner,
	insertProduct,
	insertProductReport,
	listProductReports,
	listProductsBySeller,
	setProductAvailabilityAsModerator,
	updateProductAvailability
} from './catalog.repo';

const ALLOWED_PHOTO_MIME = new Map<string, string>([
	['image/webp', 'webp'],
	['image/jpeg', 'jpg'],
	['image/png', 'png']
]);

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // Safety guard 2 MB (kompresi client ~50-80 KB)
const MAX_PRODUCTS_PER_SELLER = 30;
const REPORT_BAN_THRESHOLD = 3;
const BANNED_ACCOUNT_MESSAGE =
	'Akun Anda telah dinonaktifkan karena pelanggaran berulang terhadap pedoman foto produk.';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeSingleLineText(raw: string): string {
	return raw.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasValidImageMagicBytes(bytes: ArrayBuffer, mime: string): boolean {
	const view = new Uint8Array(bytes);
	if (view.length < 12) return false;
	if (mime === 'image/jpeg') {
		return view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff;
	}
	if (mime === 'image/png') {
		return view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47;
	}
	if (mime === 'image/webp') {
		return (
			view[0] === 0x52 &&
			view[1] === 0x49 &&
			view[2] === 0x46 &&
			view[3] === 0x46 &&
			view[8] === 0x57 &&
			view[9] === 0x45 &&
			view[10] === 0x42 &&
			view[11] === 0x50
		);
	}
	return false;
}

function assertValidProductId(productId: string): void {
	if (!UUID_RE.test(productId)) {
		throw new ValidationError('ID produk tidak valid.');
	}
}

async function assertSellerActive(db: D1Database, userId: string): Promise<void> {
	const seller = await findUserById(db, userId);
	if (!seller) {
		throw new NotFoundError(
			'Sesi akun tidak ditemukan di database. Silakan keluar lalu masuk kembali.'
		);
	}
	if (seller.is_banned === 1) {
		throw new ValidationError(BANNED_ACCOUNT_MESSAGE);
	}
}

export async function getSellerProducts(
	db: D1Database,
	userId: string
): Promise<ProductRecord[]> {
	return listProductsBySeller(db, userId);
}

export async function createHarvestProduct(
	db: D1Database,
	bucket: R2Bucket,
	ai: Ai | null,
	userId: string,
	input: CreateProductInput,
	nowUnix = Math.floor(Date.now() / 1000)
): Promise<ProductRecord> {
	const namaProduk = sanitizeSingleLineText(input.nama_produk);
	if (namaProduk.length < 2 || namaProduk.length > 80) {
		throw new ValidationError('Nama hasil panen harus diisi (2-80 karakter).');
	}

	const kategori = input.kategori.trim().toLowerCase();
	if (!isValidCategory(kategori)) {
		throw new ValidationError('Kategori hasil panen tidak valid.');
	}

	const harga = Math.round(input.harga);
	if (!Number.isFinite(harga) || harga <= 0 || harga > 1_000_000_000) {
		throw new ValidationError('Harga harus berupa angka lebih dari Rp 0.');
	}

	const satuan = input.satuan.trim().toLowerCase();
	if (!isValidUnit(satuan)) {
		throw new ValidationError('Satuan hasil panen tidak valid.');
	}

	const cleanedStok = input.stok_info ? sanitizeSingleLineText(input.stok_info) : '';
	if (cleanedStok.length > 160) {
		throw new ValidationError('Keterangan stok maksimal 160 karakter.');
	}
	const stokInfo = cleanedStok || null;

	if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) {
		throw new ValidationError('Koordinat latitude lokasi tidak valid.');
	}
	if (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) {
		throw new ValidationError('Koordinat longitude lokasi tidak valid.');
	}

	if (!input.photoFile || input.photoFile.size === 0) {
		throw new ValidationError('Foto hasil panen wajib diunggah.');
	}
	if (input.photoFile.size > MAX_PHOTO_BYTES) {
		throw new ValidationError('Ukuran foto terlalu besar (maksimal 2 MB).');
	}

	const ext = ALLOWED_PHOTO_MIME.get(input.photoFile.type);
	if (!ext) {
		throw new ValidationError('Format foto harus WebP, JPG, atau PNG.');
	}

	await assertSellerActive(db, userId);

	const existingCount = await countProductsBySeller(db, userId);
	if (existingCount >= MAX_PRODUCTS_PER_SELLER) {
		throw new ValidationError(
			`Maksimal ${MAX_PRODUCTS_PER_SELLER} produk aktif per akun. Hapus produk lama terlebih dahulu.`
		);
	}

	const bytes = await input.photoFile.arrayBuffer();
	if (!hasValidImageMagicBytes(bytes, input.photoFile.type)) {
		throw new ValidationError('File foto tidak valid atau rusak.');
	}

	if (await isUnsafeImage(ai, bytes)) {
		const { strike_count, is_banned } = await recordModerationStrike(db, userId);
		if (is_banned === 1) {
			throw new ValidationError(
				'Foto ditolak (Pelanggaran 3/3). Akun Anda dinonaktifkan dan seluruh lapak disembunyikan.'
			);
		}
		throw new ValidationError(
			`Foto ditolak karena terdeteksi mengandung konten tidak pantas (Peringatan ${strike_count}/3). Gunakan foto hasil panen yang wajar.`
		);
	}

	const productId = crypto.randomUUID();
	const r2Key = `products/${userId}/${productId}.${ext}`;
	const fotoUrl = await uploadProductPhoto(bucket, r2Key, bytes, input.photoFile.type);

	try {
		const created = await insertProduct(db, {
			id: productId,
			user_id: userId,
			nama_produk: namaProduk,
			kategori,
			harga,
			satuan,
			stok_info: stokInfo,
			foto_url: fotoUrl,
			lat: input.lat,
			lng: input.lng,
			expired_at: nowUnix + PRODUCT_EXPIRY_SECONDS
		});

		await updateUserDefaultLocation(db, userId, input.lat, input.lng);
		return created;
	} catch (error) {
		// Bersihkan objek R2 jika penulisan ke D1 gagal
		await deleteProductPhotoByUrl(bucket, fotoUrl).catch(() => undefined);
		throw error;
	}
}

export async function toggleHarvestAvailability(
	db: D1Database,
	userId: string,
	productId: string,
	isAvailable: boolean
): Promise<ProductRecord> {
	assertValidProductId(productId);
	await assertSellerActive(db, userId);
	const updated = await updateProductAvailability(db, productId, userId, isAvailable);
	if (!updated) {
		throw new NotFoundError('Produk tidak ditemukan atau bukan milik akun Anda.');
	}
	return updated;
}

export async function renewHarvestProduct(
	db: D1Database,
	userId: string,
	productId: string,
	nowUnix = Math.floor(Date.now() / 1000)
): Promise<ProductRecord> {
	assertValidProductId(productId);
	await assertSellerActive(db, userId);
	const updated = await extendProductExpiry(
		db,
		productId,
		userId,
		nowUnix + PRODUCT_EXPIRY_SECONDS
	);
	if (!updated) {
		throw new NotFoundError('Produk tidak ditemukan atau bukan milik akun Anda.');
	}
	return updated;
}

/**
 * Mencatat laporan foto dari pembeli. Bila pelapor unik mencapai 3 orang,
 * akun pemilik produk langsung dinonaktifkan dan lapaknya disembunyikan.
 */
export async function reportHarvestProduct(
	db: D1Database,
	productId: string,
	reporterToken: string,
	reporterUserId: string | null
): Promise<{ ownerBanned: boolean }> {
	assertValidProductId(productId);

	const product = await findProductOwner(db, productId);
	if (!product) {
		throw new NotFoundError('Produk tidak ditemukan.');
	}
	if (reporterUserId && reporterUserId === product.user_id) {
		throw new ValidationError('Anda tidak dapat melaporkan produk milik sendiri.');
	}

	await insertProductReport(db, {
		id: crypto.randomUUID(),
		productId,
		userId: product.user_id,
		reporterToken
	});

	const reporterCount = await countDistinctReporters(db, product.user_id);
	if (reporterCount < REPORT_BAN_THRESHOLD) {
		return { ownerBanned: false };
	}

	await banSeller(db, product.user_id);
	return { ownerBanned: true };
}

const REPORT_LIST_LIMIT = 200;

const reportDateFormatter = new Intl.DateTimeFormat('id-ID', {
	dateStyle: 'medium',
	timeStyle: 'short',
	timeZone: 'Asia/Jakarta'
});

export interface ModerationProduct {
	productId: string;
	namaProduk: string;
	fotoUrl: string;
	isAvailable: boolean;
	reportCount: number;
	latestReportedAt: number;
	latestReportedLabel: string;
}

export interface ModerationGroup {
	userId: string;
	nama: string;
	email: string;
	noWa: string | null;
	isBanned: boolean;
	strikeCount: number;
	reporterCount: number;
	latestReportedAt: number;
	products: ModerationProduct[];
}

/**
 * Mengelompokkan laporan foto per penjual untuk ditinjau admin.
 * Akun yang sedang diblokir ditampilkan lebih dulu, lalu laporan terbaru.
 */
export async function listModerationReports(db: D1Database): Promise<ModerationGroup[]> {
	const rows = await listProductReports(db, REPORT_LIST_LIMIT);
	const groups = new Map<string, ModerationGroup>();
	const reportersByUser = new Map<string, Set<string>>();

	for (const row of rows) {
		let group = groups.get(row.user_id);
		if (!group) {
			group = {
				userId: row.user_id,
				nama: row.penjual_nama,
				email: row.email,
				noWa: row.no_wa,
				isBanned: row.is_banned === 1,
				strikeCount: row.strike_count,
				reporterCount: 0,
				latestReportedAt: row.reported_at,
				products: []
			};
			groups.set(row.user_id, group);
		}

		// Baris terurut dari laporan terbaru, jadi kemunculan pertama adalah yang terakhir.
		let product = group.products.find((item) => item.productId === row.product_id);
		if (!product) {
			product = {
				productId: row.product_id,
				namaProduk: row.nama_produk,
				fotoUrl: row.foto_url,
				isAvailable: row.is_available === 1,
				reportCount: 0,
				latestReportedAt: row.reported_at,
				latestReportedLabel: reportDateFormatter.format(new Date(row.reported_at * 1000))
			};
			group.products.push(product);
		}
		product.reportCount += 1;

		const reporters = reportersByUser.get(row.user_id) ?? new Set<string>();
		reporters.add(row.reporter_token);
		reportersByUser.set(row.user_id, reporters);
	}

	for (const group of groups.values()) {
		group.reporterCount = reportersByUser.get(group.userId)?.size ?? 0;
	}

	return [...groups.values()].sort(
		(a, b) => Number(b.isBanned) - Number(a.isBanned) || b.latestReportedAt - a.latestReportedAt
	);
}

/**
 * Membuka blokir akun setelah admin meninjau laporan. Peringatan AI direset
 * dan laporan lama dihapus agar akun tidak langsung terblokir kembali.
 */
export async function unbanSellerAccount(
	db: D1Database,
	userId: string
): Promise<{ nama: string }> {
	if (!userId || userId.length > 128) {
		throw new ValidationError('ID akun tidak valid.');
	}

	const seller = await findUserById(db, userId);
	if (!seller) {
		throw new NotFoundError('Akun penjual tidak ditemukan.');
	}

	await unbanSeller(db, userId);
	await deleteReportsByUser(db, userId);

	return { nama: seller.nama };
}

/**
 * Menyembunyikan produk yang dilaporkan dari peta (bisa ditayangkan lagi oleh penjual).
 */
export async function hideReportedProduct(
	db: D1Database,
	productId: string
): Promise<{ namaProduk: string }> {
	assertValidProductId(productId);

	const updated = await setProductAvailabilityAsModerator(db, productId, false);
	if (!updated) {
		throw new NotFoundError('Produk tidak ditemukan.');
	}

	return { namaProduk: updated.nama_produk };
}

/**
 * Menghapus produk yang dilaporkan beserta laporannya dan file foto di R2.
 */
export async function removeReportedProduct(
	db: D1Database,
	bucket: R2Bucket,
	productId: string
): Promise<{ namaProduk: string }> {
	assertValidProductId(productId);

	await deleteReportsByProduct(db, productId);
	const deleted = await deleteProductAsModerator(db, productId);
	if (!deleted) {
		throw new NotFoundError('Produk tidak ditemukan.');
	}

	await deleteProductPhotoByUrl(bucket, deleted.foto_url).catch(() => undefined);
	return { namaProduk: deleted.nama_produk };
}

export async function removeHarvestProduct(
	db: D1Database,
	bucket: R2Bucket,
	userId: string,
	productId: string
): Promise<void> {
	assertValidProductId(productId);
	const deleted = await deleteProductById(db, productId, userId);
	if (!deleted) {
		throw new NotFoundError('Produk tidak ditemukan atau bukan milik akun Anda.');
	}
	await deleteProductPhotoByUrl(bucket, deleted.foto_url);
}
