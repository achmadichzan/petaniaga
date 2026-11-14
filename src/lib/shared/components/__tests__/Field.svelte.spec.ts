import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import FieldHarness from './FieldHarness.svelte';

describe('Field + Input', () => {
	it('menyambungkan hint lewat aria-describedby', () => {
		render(FieldHarness, { props: { hint: 'Isi angka saja, contoh 12000' } });

		const input = screen.getByLabelText('Harga (Rp)');
		expect(input.getAttribute('aria-describedby')).toBe('harga-hint');
		expect(input.getAttribute('aria-invalid')).toBeNull();
		expect(document.getElementById('harga-hint')?.textContent).toContain('contoh 12000');
	});

	it('menandai input tidak valid dan mengaitkan pesan error', () => {
		render(FieldHarness, {
			props: { hint: 'Isi angka saja', error: 'Harga minimal Rp100' }
		});

		const input = screen.getByLabelText('Harga (Rp)');
		expect(input.getAttribute('aria-describedby')).toBe('harga-error');
		expect(input.getAttribute('aria-invalid')).toBe('true');

		const alert = screen.getByRole('alert');
		expect(alert.id).toBe('harga-error');
		expect(alert.textContent).toBe('Harga minimal Rp100');
		expect(alert.className).toContain('text-error-ink');
	});

	it('tidak memasang aria-describedby saat tanpa hint maupun error', () => {
		render(FieldHarness);

		const input = screen.getByLabelText('Harga (Rp)');
		expect(input.getAttribute('aria-describedby')).toBeNull();
		expect(input.getAttribute('aria-invalid')).toBeNull();
	});

	it('label terhubung ke kontrol lewat for/id', () => {
		render(FieldHarness, { props: { hint: 'Opsional' } });

		const label = screen.getByText('Harga (Rp)');
		expect(label.tagName).toBe('LABEL');
		expect(label.getAttribute('for')).toBe('harga');
		expect(screen.getByLabelText('Harga (Rp)').id).toBe('harga');
	});
});
