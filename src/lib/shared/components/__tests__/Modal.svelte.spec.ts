import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Modal from '../Modal.svelte';

const body = createRawSnippet(() => ({
	render: () =>
		'<div><button type="button">Batal</button><button type="button">Hapus</button></div>'
}));

function renderModal(onClose = vi.fn()) {
	return render(Modal, {
		props: { open: false, title: 'Hapus Hasil Panen?', onClose, children: body }
	});
}

async function open(result: ReturnType<typeof renderModal>, onClose = vi.fn()) {
	await result.rerender({ open: true, onClose });
	await waitFor(() =>
		expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
	);
	return onClose;
}

describe('Modal', () => {
	it('tidak merender apa pun saat tertutup', () => {
		renderModal();

		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('memindahkan fokus ke dalam dialog saat dibuka', async () => {
		const result = renderModal();
		await open(result);

		const dialog = screen.getByRole('dialog');
		expect(dialog.getAttribute('aria-modal')).toBe('true');
		expect(dialog.contains(document.activeElement)).toBe(true);
	});

	it('menahan Tab di dalam dialog', async () => {
		const result = renderModal();
		await open(result);

		const close = screen.getByRole('button', { name: 'Tutup' });
		const last = screen.getByRole('button', { name: 'Hapus' });

		close.focus();
		await fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
		expect(document.activeElement).toBe(last);

		await fireEvent.keyDown(window, { key: 'Tab' });
		expect(document.activeElement).toBe(close);
	});

	it('meng-inert halaman di belakang lalu melepasnya saat ditutup', async () => {
		const background = document.createElement('div');
		document.body.appendChild(background);

		const onClose = vi.fn();
		const result = renderModal(onClose);
		await open(result, onClose);
		expect(background.inert).toBe(true);

		await result.rerender({ open: false, onClose });
		expect(background.inert).toBe(false);
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('menutup lewat Escape dan mengembalikan fokus ke tombol pemicu', async () => {
		const trigger = document.createElement('button');
		trigger.textContent = 'Hapus panen';
		document.body.appendChild(trigger);
		trigger.focus();

		const onClose = vi.fn();
		const result = renderModal(onClose);
		await open(result, onClose);
		expect(document.activeElement).not.toBe(trigger);

		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);

		await result.rerender({ open: false, onClose });
		await waitFor(() => expect(document.activeElement).toBe(trigger));
	});
});
