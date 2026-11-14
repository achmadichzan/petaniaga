import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Badge from '../Badge.svelte';

const label = (text: string) =>
	createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

/** Badge = parent dari teks yang dirender snippet anak. */
const badgeFor = (text: string) => screen.getByText(text).parentElement as HTMLElement;

describe('Badge', () => {
	it('memakai tone netral dan ukuran md secara default', () => {
		render(Badge, { props: { children: label('Sayur') } });

		const badge = badgeFor('Sayur');
		expect(badge.tagName).toBe('SPAN');
		expect(badge.className).toContain('rounded-full');
		expect(badge.className).toContain('bg-paper-3');
		expect(badge.className).toContain('text-xs');
	});

	it.each([
		['warn', 'bg-warn-bg', 'text-warn-ink'],
		['error', 'bg-error-bg', 'text-error-ink'],
		['info', 'bg-info-bg', 'text-info-ink'],
		['bubble', 'bg-bubble', 'text-bubble-ink']
	] as const)('tone %s memakai token yang sesuai', (tone, bg, ink) => {
		render(Badge, { props: { tone, children: label(tone) } });

		const badge = badgeFor(tone);
		expect(badge.className).toContain(bg);
		expect(badge.className).toContain(ink);
	});

	it('ukuran sm lebih rapat dari md', () => {
		render(Badge, { props: { size: 'sm', children: label('1,2 km') } });

		expect(badgeFor('1,2 km').className).toContain('text-[11px]');
	});
});
