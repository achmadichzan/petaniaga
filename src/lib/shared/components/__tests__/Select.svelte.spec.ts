import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Select from '../Select.svelte';

const OPTIONS = [
	{ value: 'kg', label: 'kilogram (kg)' },
	{ value: 'ikat', label: 'ikat' },
	{ value: 'karung', label: 'karung' },
	{ value: 'ton', label: 'ton' }
];

describe('Select', () => {
	it('menampilkan placeholder saat belum ada pilihan', () => {
		render(Select, { props: { id: 'satuan', name: 'satuan', options: OPTIONS } });

		const trigger = screen.getByRole('combobox');
		expect(trigger.textContent).toContain('Pilih…');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByRole('listbox')).toBeNull();
	});

	it('membuka listbox bertema dan memilih opsi lewat klik', async () => {
		const { container } = render(Select, {
			props: { id: 'satuan', name: 'satuan', options: OPTIONS }
		});

		await fireEvent.click(screen.getByRole('combobox'));
		const listbox = screen.getByRole('listbox');
		expect(listbox.id).toBe('satuan-listbox');
		expect(screen.getAllByRole('option')).toHaveLength(OPTIONS.length);

		await fireEvent.click(screen.getByRole('option', { name: 'karung' }));

		expect(screen.queryByRole('listbox')).toBeNull();
		expect(screen.getByRole('combobox').textContent).toContain('karung');
		const hidden = container.querySelector<HTMLInputElement>('input[name="satuan"]');
		expect(hidden?.value).toBe('karung');
	});

	it('membuka dengan ArrowDown lalu berpindah fokus di dalam daftar', async () => {
		render(Select, { props: { id: 'satuan', options: OPTIONS, value: 'ikat' } });

		const trigger = screen.getByRole('combobox');
		await fireEvent.keyDown(trigger, { key: 'ArrowDown' });

		const options = screen.getAllByRole('option');
		expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('true');
		// fokus awal jatuh pada opsi yang sedang terpilih
		expect(document.activeElement).toBe(options[1]);

		await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
		expect(document.activeElement).toBe(options[options.length - 1]);

		await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });
		expect(document.activeElement).toBe(options[0]);
	});

	it('menutup daftar dengan Escape dan mengembalikan fokus ke trigger', async () => {
		render(Select, { props: { id: 'satuan', options: OPTIONS } });

		const trigger = screen.getByRole('combobox');
		await fireEvent.click(trigger);
		await fireEvent.keyDown(screen.getAllByRole('option')[0], { key: 'Escape' });

		expect(screen.queryByRole('listbox')).toBeNull();
		expect(document.activeElement).toBe(trigger);
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('menandai opsi terpilih dengan aria-selected', async () => {
		render(Select, { props: { id: 'satuan', options: OPTIONS, value: 'ton' } });

		await fireEvent.click(screen.getByRole('combobox'));
		const selected = screen.getAllByRole('option').filter((el) => el.getAttribute('aria-selected') === 'true');

		expect(selected).toHaveLength(1);
		expect(selected[0].textContent).toContain('ton');
	});

	it('disabled tidak bisa membuka daftar', async () => {
		render(Select, { props: { id: 'satuan', options: OPTIONS, disabled: true } });

		await fireEvent.click(screen.getByRole('combobox'));
		expect(screen.queryByRole('listbox')).toBeNull();
	});
});
