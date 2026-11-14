import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Chip from '../Chip.svelte';

const label = (text: string) =>
	createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Chip', () => {
	it('menandai chip aktif dengan aria-pressed dan warna bubble', () => {
		render(Chip, { props: { active: true, children: label('Sayur') } });

		const chip = screen.getByRole('button', { name: 'Sayur' });
		expect(chip.getAttribute('aria-pressed')).toBe('true');
		expect(chip.className).toContain('bg-bubble');
		expect(chip.className).toContain('min-h-11');
	});

	it('chip tidak aktif tetap 44px dan berwarna netral', () => {
		render(Chip, { props: { children: label('Buah') } });

		const chip = screen.getByRole('button', { name: 'Buah' });
		expect(chip.getAttribute('aria-pressed')).toBe('false');
		expect(chip.className).toContain('bg-paper-2');
		expect(chip.className).toContain('min-h-11');
	});

	it('meneruskan klik ke pemanggil', async () => {
		const onclick = vi.fn();
		render(Chip, { props: { onclick, children: label('Umbi') } });

		await fireEvent.click(screen.getByRole('button', { name: 'Umbi' }));
		expect(onclick).toHaveBeenCalledTimes(1);
	});
});
