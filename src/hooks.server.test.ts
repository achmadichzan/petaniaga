import { describe, expect, it, vi } from 'vitest';
import { handle } from './hooks.server.ts';

function makeEvent(country?: string) {
	const headers = new Headers();
	if (country) headers.set('cf-ipcountry', country);
	return {
		request: new Request('https://petaniaga.pages.dev/', { headers }),
		cookies: { get: () => undefined },
		locals: {}
	} as unknown as Parameters<typeof handle>[0]['event'];
}

describe('hooks.server geo-block', () => {
	it('mengizinkan request dari Indonesia (ID)', async () => {
		const resolve = vi.fn(async () => new Response('ok', { status: 200 }));
		const res = await handle({ event: makeEvent('ID'), resolve });
		expect(res.status).toBe(200);
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('mengizinkan request tanpa header cf-ipcountry (local dev)', async () => {
		const resolve = vi.fn(async () => new Response('ok', { status: 200 }));
		const res = await handle({ event: makeEvent(), resolve });
		expect(res.status).toBe(200);
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('memblokir request dari luar Indonesia dengan 403', async () => {
		const resolve = vi.fn(async () => new Response('ok', { status: 200 }));
		const res = await handle({ event: makeEvent('US'), resolve });
		expect(res.status).toBe(403);
		expect(resolve).not.toHaveBeenCalled();
	});
});
