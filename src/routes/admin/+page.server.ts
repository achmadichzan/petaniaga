import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { findUserById } from '#modules/auth/server/auth.repo.ts';
import type { SessionUser } from '#modules/auth/types.ts';
import {
	hideReportedProduct,
	listModerationReports,
	removeReportedProduct,
	unbanSellerAccount
} from '#modules/catalog/server/catalog.service.ts';
import { getAdminEmails, getDb, getR2Bucket } from '#shared/server/env.ts';
import { AppError, toUserMessage } from '#shared/server/errors.ts';

/**
 * Panel admin hanya untuk email yang terdaftar di env `ADMIN_EMAILS`.
 * Email dibaca dari database (bukan JWT) agar perubahan allowlist langsung berlaku.
 */
async function requireAdmin(user: SessionUser | null): Promise<void> {
	if (!user) {
		throw redirect(303, '/login');
	}

	const db = getDb();
	const fresh = await findUserById(db, user.id);
	const email = fresh?.email.trim().toLowerCase() ?? '';

	if (!email || !getAdminEmails().includes(email)) {
		throw error(403, 'Halaman ini hanya dapat diakses oleh admin.');
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	await requireAdmin(locals.user);

	return {
		groups: await listModerationReports(getDb())
	};
};

function failModeration(err: unknown, action: string, fallback: string) {
	if (!(err instanceof AppError)) {
		console.error(`[admin:${action}]`, err);
	}
	const status = err instanceof AppError ? err.statusCode : 500;
	return fail(status, {
		action,
		error: toUserMessage(err, fallback)
	});
}

export const actions: Actions = {
	unban: async ({ request, locals }) => {
		await requireAdmin(locals.user);

		const formData = await request.formData();
		const userId = String(formData.get('user_id') ?? '').trim();

		try {
			const { nama } = await unbanSellerAccount(getDb(), userId);
			return {
				action: 'unban',
				message: `Blokir akun ${nama} dibuka. Peringatan AI direset dan laporan lama dihapus.`
			};
		} catch (err) {
			return failModeration(err, 'unban', 'Gagal membuka blokir akun.');
		}
	},

	hideProduct: async ({ request, locals }) => {
		await requireAdmin(locals.user);

		const formData = await request.formData();
		const productId = String(formData.get('product_id') ?? '').trim();

		try {
			const { namaProduk } = await hideReportedProduct(getDb(), productId);
			return {
				action: 'hideProduct',
				message: `Produk "${namaProduk}" disembunyikan dari peta.`
			};
		} catch (err) {
			return failModeration(err, 'hideProduct', 'Gagal menyembunyikan produk.');
		}
	},

	deleteProduct: async ({ request, locals }) => {
		await requireAdmin(locals.user);

		const formData = await request.formData();
		const productId = String(formData.get('product_id') ?? '').trim();

		try {
			const { namaProduk } = await removeReportedProduct(
				getDb(),
				getR2Bucket(),
				productId
			);
			return {
				action: 'deleteProduct',
				message: `Produk "${namaProduk}" beserta fotonya berhasil dihapus.`
			};
		} catch (err) {
			return failModeration(err, 'deleteProduct', 'Gagal menghapus produk.');
		}
	}
};
