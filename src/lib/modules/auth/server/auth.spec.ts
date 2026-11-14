import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { signSessionJwt, verifySessionJwt } from './jwt';
import {
	completeWaOnboarding,
	loginWithGoogleProfile,
	resignSessionWithLocation
} from './auth.service';

const SECRET = 'test-secret-key-at-least-32-characters-long';

function createSqliteD1(): D1Database {
	const sqlite = new DatabaseSync(':memory:');
	const schemaPath = path.resolve(process.cwd(), 'migrations/0001_initial_schema.sql');
	sqlite.exec(fs.readFileSync(schemaPath, 'utf-8'));

	return {
		prepare(sql: string) {
			const stmt = sqlite.prepare(sql);
			let bindings: unknown[] = [];
			const bound = {
				bind(...args: unknown[]) {
					bindings = args;
					return bound;
				},
				async first<T = unknown>() {
					return (stmt.get(...(bindings as never[])) as T | undefined) ?? null;
				},
				async all<T = unknown>() {
					return { results: stmt.all(...(bindings as never[])) as T[] };
				},
				async run() {
					stmt.run(...(bindings as never[]));
					return { success: true };
				}
			};
			return bound;
		}
	} as unknown as D1Database;
}

describe('auth module', () => {
	it('menandatangani dan memverifikasi Stateless JWT dengan benar', async () => {
		const token = await signSessionJwt(
			{
				id: 'google-sub-1',
				nama: 'Pak Budi',
				no_wa: '6281234567890',
				default_lat: -6.82,
				default_lng: 107.61
			},
			SECRET
		);

		const decoded = await verifySessionJwt(token, SECRET);
		expect(decoded).toEqual({
			id: 'google-sub-1',
			nama: 'Pak Budi',
			no_wa: '6281234567890',
			default_lat: -6.82,
			default_lng: 107.61
		});

		expect(await verifySessionJwt(token, 'wrong-secret-key-at-least-32-chars')).toBeNull();
		expect(await verifySessionJwt('invalid.jwt.token', SECRET)).toBeNull();
	});

	it('melakukan login Google dan menyimpan nomor WA sekaligus re-sign JWT', async () => {
		const db = createSqliteD1();

		const loginResult = await loginWithGoogleProfile(
			db,
			{ id: 'g-100', nama: 'Bu Ani', email: 'ani@example.com' },
			SECRET
		);
		expect(loginResult.user.no_wa).toBeNull();

		const jwtBeforeWa = await verifySessionJwt(loginResult.token, SECRET);
		expect(jwtBeforeWa?.no_wa).toBeNull();

		const onboardResult = await completeWaOnboarding(db, 'g-100', '0812-3456-7890', SECRET);
		expect(onboardResult.user.no_wa).toBe('6281234567890');

		// Pastikan token JWT baru langsung memuat no_wa terbaru tanpa perlu query D1 lagi
		const jwtAfterWa = await verifySessionJwt(onboardResult.token, SECRET);
		expect(jwtAfterWa?.no_wa).toBe('6281234567890');

		// Login ulang tidak menimpa nomor WA yang sudah disimpan
		const secondLogin = await loginWithGoogleProfile(
			db,
			{ id: 'g-100', nama: 'Bu Ani Terbaru', email: 'ani@example.com' },
			SECRET
		);
		expect(secondLogin.user.nama).toBe('Bu Ani Terbaru');
		expect(secondLogin.user.no_wa).toBe('6281234567890');
	});

	it('menolak nomor WhatsApp yang tidak valid', async () => {
		const db = createSqliteD1();
		await loginWithGoogleProfile(
			db,
			{ id: 'g-200', nama: 'Pak Joko', email: 'joko@example.com' },
			SECRET
		);

		await expect(completeWaOnboarding(db, 'g-200', '021999', SECRET)).rejects.toThrow(
			/Nomor WhatsApp tidak valid/
		);
	});

	it('me-re-sign JWT dengan koordinat lokasi default terbaru', async () => {
		const { sessionUser, token } = await resignSessionWithLocation(
			{ id: 'g-1', nama: 'Pak Slamet', no_wa: '628111111111', default_lat: null, default_lng: null },
			-7.55,
			110.82,
			SECRET
		);

		expect(sessionUser.default_lat).toBe(-7.55);
		const verified = await verifySessionJwt(token, SECRET);
		expect(verified?.default_lng).toBe(110.82);
	});
});

