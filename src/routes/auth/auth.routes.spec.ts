import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isActionFailure, isRedirect, type Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { workerEnv, mockExchangeCode } = vi.hoisted(() => {
	const env = {
		DB: undefined as unknown as D1Database,
		JWT_SECRET: 'test-jwt-secret-key-at-least-32-chars',
		GOOGLE_CLIENT_ID: 'client-id-123',
		GOOGLE_CLIENT_SECRET: 'client-secret-456',
		APP_URL: 'http://localhost:5173',
		ENABLE_DEV_LOGIN: 'false'
	};
	// adapter-cloudflare membaca globalThis.__sveltekit_cloudflare_platform saat load modul
	(globalThis as Record<string, unknown>).__sveltekit_cloudflare_platform = { env };
	return {
		workerEnv: env,
		mockExchangeCode: vi.fn()
	};
});

vi.mock('$app/env', () => ({ dev: true }));
vi.mock('#modules/auth/server/oauth.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#modules/auth/server/oauth.ts')>();
	return {
		...actual,
		exchangeGoogleCallbackCode: mockExchangeCode
	};
});

import { SESSION_COOKIE_NAME, signSessionJwt, verifySessionJwt } from '#modules/auth/server/jwt.ts';
import { OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from '#modules/auth/server/oauth.ts';
import { handle } from '../../hooks.server';
import { load as sellerLayoutLoad } from '../(seller)/+layout.server';
import { actions as onboardingActions } from '../(seller)/onboarding-wa/+page.server';
import { actions as loginActions, load as loginLoad } from '../login/+page.server';
import { GET as googleCallbackGet } from './callback/google/+server';
import { GET as googleLoginGet } from './login/google/+server';
import { POST as logoutPost } from './logout/+server';

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

function createMockCookies(initial: Record<string, string> = {}) {
	const store = new Map<string, string>(Object.entries(initial));
	const deleted: string[] = [];
	const cookies = {
		get(name: string) {
			return store.get(name);
		},
		set(name: string, value: string) {
			store.set(name, value);
		},
		delete(name: string) {
			store.delete(name);
			deleted.push(name);
		}
	} as unknown as Cookies;

	return { cookies, store, deleted };
}

async function expectRedirect(fn: () => unknown, status: number, location: string) {
	try {
		await fn();
		expect.unreachable(`Expected redirect ${status} -> ${location}`);
	} catch (err) {
		expect(isRedirect(err)).toBe(true);
		expect(err).toMatchObject({ status, location });
	}
}

describe('auth routes, hooks & seller guards integration', () => {
	beforeEach(() => {
		workerEnv.DB = createSqliteD1();
		workerEnv.GOOGLE_CLIENT_ID = 'client-id-123';
		workerEnv.GOOGLE_CLIENT_SECRET = 'client-secret-456';
		workerEnv.ENABLE_DEV_LOGIN = 'false';
		mockExchangeCode.mockReset();
	});

	it('hooks.server membaca Stateless JWT valid tanpa DB dan mengabaikan token rusak', async () => {
		const token = await signSessionJwt(
			{ id: 'u1', nama: 'Pak Tani', no_wa: '628123456789', default_lat: -7.1, default_lng: 110.2 },
			workerEnv.JWT_SECRET
		);

		const okCookies = createMockCookies({ [SESSION_COOKIE_NAME]: token });
		const okEvent = {
			cookies: okCookies.cookies,
			locals: { user: null }
		} as unknown as Parameters<typeof handle>[0]['event'];

		await handle({ event: okEvent, resolve: async () => new Response('ok') });
		expect(okEvent.locals.user).toEqual({
			id: 'u1',
			nama: 'Pak Tani',
			no_wa: '628123456789',
			default_lat: -7.1,
			default_lng: 110.2
		});

		const badCookies = createMockCookies({ [SESSION_COOKIE_NAME]: 'rusak.jwt.token' });
		const badEvent = {
			cookies: badCookies.cookies,
			locals: { user: null }
		} as unknown as Parameters<typeof handle>[0]['event'];

		await handle({ event: badEvent, resolve: async () => new Response('ok') });
		expect(badEvent.locals.user).toBeNull();
	});

	it('(seller)/+layout.server mengarahkan pengguna sesuai status login dan nomor WA', async () => {
		await expectRedirect(
			() =>
				sellerLayoutLoad({
					locals: { user: null },
					url: new URL('http://localhost:5173/dashboard')
				} as unknown as Parameters<typeof sellerLayoutLoad>[0]),
			303,
			'/login'
		);

		const userWithoutWa = {
			id: 'u1',
			nama: 'Bu Sari',
			no_wa: null,
			default_lat: null,
			default_lng: null
		};
		await expectRedirect(
			() =>
				sellerLayoutLoad({
					locals: { user: userWithoutWa },
					url: new URL('http://localhost:5173/dashboard')
				} as unknown as Parameters<typeof sellerLayoutLoad>[0]),
			303,
			'/onboarding-wa'
		);

		const allowOnboarding = await sellerLayoutLoad({
			locals: { user: userWithoutWa },
			url: new URL('http://localhost:5173/onboarding-wa')
		} as unknown as Parameters<typeof sellerLayoutLoad>[0]);
		expect(allowOnboarding).toEqual({ user: userWithoutWa });

		const userWithWa = { ...userWithoutWa, no_wa: '6281234567890' };
		await expectRedirect(
			() =>
				sellerLayoutLoad({
					locals: { user: userWithWa },
					url: new URL('http://localhost:5173/onboarding-wa')
				} as unknown as Parameters<typeof sellerLayoutLoad>[0]),
			303,
			'/dashboard'
		);
	});

	it('GET /auth/login/google menyiapkan cookie PKCE + redirect ke Google atau fallback jika belum dikonfigurasi', async () => {
		const { cookies, store } = createMockCookies();
		try {
			await googleLoginGet({
				cookies,
				url: new URL('http://localhost:5173/auth/login/google')
			} as unknown as Parameters<typeof googleLoginGet>[0]);
			expect.unreachable('Expected OAuth redirect');
		} catch (err) {
			expect(isRedirect(err)).toBe(true);
			const redirectErr = err as { status: number; location: string };
			expect(redirectErr.status).toBe(302);
			expect(redirectErr.location.startsWith('https://accounts.google.com/')).toBe(true);
			expect(store.get(OAUTH_STATE_COOKIE)).toBeTruthy();
			expect(store.get(OAUTH_VERIFIER_COOKIE)).toBeTruthy();
		}

		workerEnv.GOOGLE_CLIENT_ID = '';
		await expectRedirect(
			() =>
				googleLoginGet({
					cookies: createMockCookies().cookies,
					url: new URL('http://localhost:5173/auth/login/google')
				} as unknown as Parameters<typeof googleLoginGet>[0]),
			303,
			'/login?error=oauth_config'
		);
	});

	it('GET /auth/callback/google menangani pembatalan, state mismatch, user baru -> onboarding, dan user lama -> dashboard', async () => {
		await expectRedirect(
			() =>
				googleCallbackGet({
					cookies: createMockCookies().cookies,
					url: new URL('http://localhost:5173/auth/callback/google?error=access_denied')
				} as unknown as Parameters<typeof googleCallbackGet>[0]),
			303,
			'/login?error=oauth_cancelled'
		);

		const mismatch = createMockCookies({
			[OAUTH_STATE_COOKIE]: 'state-benar',
			[OAUTH_VERIFIER_COOKIE]: 'verifier-1'
		});
		await expectRedirect(
			() =>
				googleCallbackGet({
					cookies: mismatch.cookies,
					url: new URL('http://localhost:5173/auth/callback/google?code=abc&state=salah')
				} as unknown as Parameters<typeof googleCallbackGet>[0]),
			303,
			'/login?error=oauth_invalid'
		);
		expect(mismatch.deleted).toEqual([OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE]);

		// User baru (belum punya no_wa) -> /onboarding-wa
		mockExchangeCode.mockResolvedValueOnce({
			id: 'google-sub-99',
			nama: 'Pak Darma',
			email: 'darma@example.com'
		});
		const firstCookies = createMockCookies({
			[OAUTH_STATE_COOKIE]: 'st-1',
			[OAUTH_VERIFIER_COOKIE]: 'ver-1'
		});
		await expectRedirect(
			() =>
				googleCallbackGet({
					cookies: firstCookies.cookies,
					url: new URL('http://localhost:5173/auth/callback/google?code=ok&state=st-1')
				} as unknown as Parameters<typeof googleCallbackGet>[0]),
			303,
			'/onboarding-wa'
		);

		const tokenAfterLogin = firstCookies.store.get(SESSION_COOKIE_NAME);
		expect(tokenAfterLogin).toBeTruthy();
		const session = await verifySessionJwt(tokenAfterLogin!, workerEnv.JWT_SECRET);
		expect(session?.id).toBe('google-sub-99');
		expect(session?.no_wa).toBeNull();

		// Simpan no WA lewat action onboarding-wa
		const formData = new FormData();
		formData.set('no_wa', '0812-3456-7890');
		const onboardLocals = { user: session };
		await expectRedirect(
			() =>
				onboardingActions.default({
					request: new Request('http://localhost:5173/onboarding-wa', {
						method: 'POST',
						body: formData
					}),
					locals: onboardLocals,
					cookies: firstCookies.cookies,
					url: new URL('http://localhost:5173/onboarding-wa')
				} as unknown as Parameters<typeof onboardingActions.default>[0]),
			303,
			'/dashboard'
		);
		expect(onboardLocals.user?.no_wa).toBe('6281234567890');

		// Login ulang user yang sudah punya no_wa -> langsung ke /dashboard
		mockExchangeCode.mockResolvedValueOnce({
			id: 'google-sub-99',
			nama: 'Pak Darma',
			email: 'darma@example.com'
		});
		const secondCookies = createMockCookies({
			[OAUTH_STATE_COOKIE]: 'st-2',
			[OAUTH_VERIFIER_COOKIE]: 'ver-2'
		});
		await expectRedirect(
			() =>
				googleCallbackGet({
					cookies: secondCookies.cookies,
					url: new URL('http://localhost:5173/auth/callback/google?code=ok2&state=st-2')
				} as unknown as Parameters<typeof googleCallbackGet>[0]),
			303,
			'/dashboard'
		);
	});

	it('login page & logout POST mengatur devLogin, pesan error, dan hapus cookie sesi', async () => {
		const loadRes = await loginLoad({
			locals: { user: null },
			url: new URL('http://localhost:5173/login?error=oauth_invalid')
		} as unknown as Parameters<typeof loginLoad>[0]);
		expect(loadRes).toMatchObject({
			oauthConfigured: true,
			devLoginEnabled: false
		});
		expect((loadRes as { errorMessage: string | null }).errorMessage).toContain('kedaluwarsa');

		const forbiddenRes = await loginActions.devLogin({
			cookies: createMockCookies().cookies,
			url: new URL('http://localhost:5173/login?/devLogin')
		} as unknown as Parameters<typeof loginActions.devLogin>[0]);
		expect(isActionFailure(forbiddenRes)).toBe(true);
		expect(forbiddenRes).toMatchObject({ status: 403 });

		workerEnv.ENABLE_DEV_LOGIN = 'true';
		const devCookies = createMockCookies();
		await expectRedirect(
			() =>
				loginActions.devLogin({
					cookies: devCookies.cookies,
					url: new URL('http://localhost:5173/login?/devLogin')
				} as unknown as Parameters<typeof loginActions.devLogin>[0]),
			303,
			'/onboarding-wa'
		);
		expect(devCookies.store.has(SESSION_COOKIE_NAME)).toBe(true);

		await expectRedirect(
			() =>
				logoutPost({
					cookies: devCookies.cookies,
					url: new URL('http://localhost:5173/auth/logout')
				} as unknown as Parameters<typeof logoutPost>[0]),
			303,
			'/'
		);
		expect(devCookies.deleted).toContain(SESSION_COOKIE_NAME);
	});
});
