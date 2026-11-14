import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Button from '../Button.svelte';

const label = (text: string) =>
	createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Button', () => {
	it('merender <button> bertoken dengan ukuran default lg', () => {
		render(Button, { props: { children: label('Simpan') } });

		const button = screen.getByRole('button', { name: 'Simpan' });
		expect(button.tagName).toBe('BUTTON');
		expect(button.className).toContain('min-h-12');
		expect(button.className).toContain('rounded-[var(--radius-control)]');
		expect(button.className).toContain('bg-accent');
	});

	it('size sm + shape pill tetap memenuhi target sentuh 44px', () => {
		render(Button, {
			props: { size: 'sm', shape: 'pill', variant: 'whatsapp', children: label('Pesan WA') }
		});

		const button = screen.getByRole('button', { name: 'Pesan WA' });
		expect(button.className).toContain('min-h-11');
		expect(button.className).toContain('rounded-full');
		expect(button.className).not.toContain('rounded-[var(--radius-control)]');
		expect(button.className).toContain('bg-wa');
	});

	it('meneruskan klik pada varian button', async () => {
		const onclick = vi.fn();
		render(Button, { props: { onclick, children: label('Hapus') } });

		await fireEvent.click(screen.getByRole('button', { name: 'Hapus' }));
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('href merender <a> dengan atribut tautan utuh', () => {
		render(Button, {
			props: {
				href: '#daftar',
				target: '_blank',
				rel: 'noopener noreferrer',
				children: label('Pesan WA')
			}
		});

		const link = screen.getByRole('link', { name: 'Pesan WA' });
		expect(link.tagName).toBe('A');
		expect(link.getAttribute('href')).toBe('#daftar');
		expect(link.getAttribute('target')).toBe('_blank');
		expect(link.getAttribute('rel')).toBe('noopener noreferrer');
	});
});
