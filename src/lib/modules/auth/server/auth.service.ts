import { NotFoundError, ValidationError } from '#shared/server/errors.ts';
import { normalizeWaNumber } from '#shared/utils/format.ts';
import { isValidTimeHHMM } from '#shared/utils/lapak.ts';
import type { SellerUser, GoogleProfile, SessionUser } from '../types';
import {
	findUserById,
	findUserByWa,
	updateUserLapak,
	updateUserWa,
	upsertGoogleUser
} from './auth.repo';
import { signSessionJwt } from './jwt';

export function toSessionUser(user: SellerUser): SessionUser {
	return {
		id: user.id,
		nama: user.nama,
		no_wa: user.no_wa,
		default_lat: user.default_lat,
		default_lng: user.default_lng,
		is_open: user.is_open,
		jam_buka: user.jam_buka,
		jam_tutup: user.jam_tutup
	};
}

export async function loginWithGoogleProfile(
	db: D1Database,
	profile: GoogleProfile,
	jwtSecret: string
): Promise<{ user: SellerUser; sessionUser: SessionUser; token: string }> {
	const user = await upsertGoogleUser(db, profile);
	const sessionUser = toSessionUser(user);
	const token = await signSessionJwt(sessionUser, jwtSecret);
	return { user, sessionUser, token };
}

/**
 * Menyimpan nomor WA aktif penjual sekaligus me-re-sign Stateless JWT
 * agar cookie sesi langsung memuat `no_wa` terbaru tanpa perlu DB read.
 */
export async function completeWaOnboarding(
	db: D1Database,
	userId: string,
	rawWa: string,
	jwtSecret: string
): Promise<{ user: SellerUser; sessionUser: SessionUser; token: string }> {
	const normalizedWa = normalizeWaNumber(rawWa);
	if (!normalizedWa) {
		throw new ValidationError(
			'Nomor WhatsApp tidak valid. Masukkan nomor aktif Indonesia (contoh: 081234567890).'
		);
	}

	const existing = await findUserById(db, userId);
	if (!existing) {
		throw new NotFoundError('Akun penjual tidak ditemukan. Silakan masuk ulang.');
	}

	const owner = await findUserByWa(db, normalizedWa);
	if (owner && owner.id !== userId) {
		throw new ValidationError('Nomor WhatsApp ini sudah terdaftar pada akun lain.');
	}

	let updated: SellerUser | null;
	try {
		updated = await updateUserWa(db, userId, normalizedWa);
	} catch (err) {
		if (err instanceof Error && err.message.toLowerCase().includes('unique')) {
			throw new ValidationError('Nomor WhatsApp ini sudah terdaftar pada akun lain.');
		}
		throw err;
	}
	if (!updated) {
		throw new NotFoundError('Gagal memperbarui nomor WhatsApp.');
	}

	const sessionUser = toSessionUser(updated);
	const token = await signSessionJwt(sessionUser, jwtSecret);
	return { user: updated, sessionUser, token };
}

export async function resignSessionWithLocation(
	current: SessionUser,
	lat: number,
	lng: number,
	jwtSecret: string
): Promise<{ sessionUser: SessionUser; token: string }> {
	const sessionUser: SessionUser = {
		...current,
		default_lat: lat,
		default_lng: lng
	};
	const token = await signSessionJwt(sessionUser, jwtSecret);
	return { sessionUser, token };
}

export async function updateLapakSettings(
	db: D1Database,
	userId: string,
	input: { isOpen: boolean; jamBuka: string; jamTutup: string },
	jwtSecret: string
): Promise<{ user: SellerUser; sessionUser: SessionUser; token: string }> {
	const jamBuka = input.jamBuka.trim();
	const jamTutup = input.jamTutup.trim();

	if ((jamBuka && !jamTutup) || (!jamBuka && jamTutup)) {
		throw new ValidationError('Isi kedua jam buka dan jam tutup, atau kosongkan keduanya.');
	}
	if (jamBuka && (!isValidTimeHHMM(jamBuka) || !isValidTimeHHMM(jamTutup))) {
		throw new ValidationError('Format jam harus HH:MM (contoh: 06:00 dan 17:00).');
	}

	const updated = await updateUserLapak(
		db,
		userId,
		input.isOpen,
		jamBuka || null,
		jamTutup || null
	);
	if (!updated) {
		throw new NotFoundError('Akun penjual tidak ditemukan.');
	}

	const sessionUser = toSessionUser(updated);
	const token = await signSessionJwt(sessionUser, jwtSecret);
	return { user: updated, sessionUser, token };
}
