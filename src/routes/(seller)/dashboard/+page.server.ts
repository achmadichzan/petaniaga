import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { findUserById } from '#modules/auth/server/auth.repo.ts';
import { SESSION_COOKIE_NAME, setSessionCookie } from '#modules/auth/server/jwt.ts';
import {
	completeWaOnboarding,
	resignSessionWithLocation,
	updateLapakSettings
} from '#modules/auth/server/auth.service.ts';
import {
	createHarvestProduct,
	getSellerProducts,
	removeHarvestProduct,
	renewHarvestProduct,
	toggleHarvestAvailability
} from '#modules/catalog/server/catalog.service.ts';
import { getAdminEmails, getAi, getDb, getJwtSecret, getR2Bucket } from '#shared/server/env.ts';
import { AppError, toUserMessage } from '#shared/server/errors.ts';

export const load: PageServerLoad = async ({ parent, cookies }) => {
	const { user } = await parent();
	const db = getDb();
	const [products, freshUser] = await Promise.all([
		getSellerProducts(db, user.id),
		findUserById(db, user.id)
	]);

	if (!freshUser) {
		cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
		throw redirect(303, '/login');
	}

	return {
		user: freshUser,
		products,
		isAdmin: getAdminEmails().includes(freshUser.email.trim().toLowerCase()),
		nowUnix: Math.floor(Date.now() / 1000)
	};
};

export const actions: Actions = {
	createProduct: async ({ request, locals, cookies, url }) => {
		if (!locals.user) throw redirect(303, '/login');
		if (!locals.user.no_wa) {
			return fail(400, {
				action: 'createProduct',
				error: 'Lengkapi nomor WhatsApp aktif Anda sebelum menayangkan hasil panen.'
			});
		}

		const formData = await request.formData();
		const foto = formData.get('foto');

		if (!(foto instanceof File)) {
			return fail(400, {
				action: 'createProduct',
				error: 'Foto hasil panen wajib diunggah.'
			});
		}

		const lat = Number(formData.get('lat'));
		const lng = Number(formData.get('lng'));
		const harga = Number(formData.get('harga'));

		try {
			await createHarvestProduct(getDb(), getR2Bucket(), getAi(), locals.user.id, {
				nama_produk: String(formData.get('nama_produk') ?? ''),
				kategori: String(formData.get('kategori') ?? ''),
				harga,
				satuan: String(formData.get('satuan') ?? ''),
				stok_info: formData.get('stok_info') ? String(formData.get('stok_info')) : null,
				lat,
				lng,
				photoFile: foto
			});

			const { sessionUser, token } = await resignSessionWithLocation(
				locals.user,
				lat,
				lng,
				getJwtSecret()
			);
			setSessionCookie(cookies, token, url.protocol === 'https:');
			locals.user = sessionUser;

			return {
				action: 'createProduct',
				message: 'Hasil panen Anda sekarang sudah tayang di peta pembeli!'
			};
		} catch (err) {
			if (!(err instanceof AppError)) {
				console.error('[createProduct]', err);
			}
			const status = err instanceof AppError ? err.statusCode : 500;
			return fail(status, {
				action: 'createProduct',
				error: toUserMessage(err, 'Gagal mengunggah hasil panen.')
			});
		}
	},

	toggleAvailability: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');

		const formData = await request.formData();
		const productId = String(formData.get('product_id') ?? '');
		const nextAvailable = formData.get('next_available') === '1';

		try {
			await toggleHarvestAvailability(getDb(), locals.user.id, productId, nextAvailable);
			return {
				action: 'manageProduct',
				message: nextAvailable
					? 'Produk kembali ditayangkan di peta.'
					: 'Produk ditandai stok habis (disembunyikan dari peta).'
			};
		} catch (err) {
			if (!(err instanceof AppError)) {
				console.error('[createProduct]', err);
			}
			const status = err instanceof AppError ? err.statusCode : 500;
			return fail(status, {
				action: 'manageProduct',
				error: toUserMessage(err)
			});
		}
	},

	renewProduct: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');

		const formData = await request.formData();
		const productId = String(formData.get('product_id') ?? '');

		try {
			await renewHarvestProduct(getDb(), locals.user.id, productId);
			return {
				action: 'manageProduct',
				message: 'Masa tayang produk diperpanjang 14 hari ke depan.'
			};
		} catch (err) {
			if (!(err instanceof AppError)) {
				console.error('[createProduct]', err);
			}
			const status = err instanceof AppError ? err.statusCode : 500;
			return fail(status, {
				action: 'manageProduct',
				error: toUserMessage(err)
			});
		}
	},

	deleteProduct: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');

		const formData = await request.formData();
		const productId = String(formData.get('product_id') ?? '');

		try {
			await removeHarvestProduct(getDb(), getR2Bucket(), locals.user.id, productId);
			return {
				action: 'manageProduct',
				message: 'Produk beserta fotonya berhasil dihapus.'
			};
		} catch (err) {
			if (!(err instanceof AppError)) {
				console.error('[createProduct]', err);
			}
			const status = err instanceof AppError ? err.statusCode : 500;
			return fail(status, {
				action: 'manageProduct',
				error: toUserMessage(err)
			});
		}
	},

	updateWa: async ({ request, locals, cookies, url }) => {
		if (!locals.user) throw redirect(303, '/login');

		const formData = await request.formData();
		const rawWa = String(formData.get('no_wa') ?? '');

		try {
			const { sessionUser, token } = await completeWaOnboarding(
				getDb(),
				locals.user.id,
				rawWa,
				getJwtSecret()
			);
			setSessionCookie(cookies, token, url.protocol === 'https:');
			locals.user = sessionUser;

			return {
				action: 'updateWa',
				message: 'Nomor WhatsApp berhasil diperbarui.'
			};
		} catch (err) {
			if (!(err instanceof AppError)) {
				console.error('[createProduct]', err);
			}
			const status = err instanceof AppError ? err.statusCode : 500;
			return fail(status, {
				action: 'updateWa',
				error: toUserMessage(err, 'Gagal memperbarui nomor WhatsApp.')
			});
		}
	},

	updateLapak: async ({ request, locals, cookies, url }) => {
		if (!locals.user) throw redirect(303, '/login');

		const formData = await request.formData();
		const isOpen = formData.get('is_open') !== '0';
		const jamBuka = String(formData.get('jam_buka') ?? '');
		const jamTutup = String(formData.get('jam_tutup') ?? '');

		try {
			const { sessionUser, token } = await updateLapakSettings(
				getDb(),
				locals.user.id,
				{ isOpen, jamBuka, jamTutup },
				getJwtSecret()
			);
			setSessionCookie(cookies, token, url.protocol === 'https:');
			locals.user = sessionUser;

			return {
				action: 'updateLapak',
				message: isOpen ? 'Pengaturan buka/tutup lapak disimpan.' : 'Lapak ditandai tutup sementara.'
			};
		} catch (err) {
			if (!(err instanceof AppError)) {
				console.error('[createProduct]', err);
			}
			const status = err instanceof AppError ? err.statusCode : 500;
			return fail(status, {
				action: 'updateLapak',
				error: toUserMessage(err, 'Gagal menyimpan jam buka lapak.')
			});
		}
	}
};
