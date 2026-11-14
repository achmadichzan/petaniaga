<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { focusInside, inertBackground, trapTab } from '#shared/utils/dialog.ts';
	import { portal } from '#shared/utils/portal.ts';

	interface Props {
		open: boolean;
		title?: string;
		onClose: () => void;
		children: Snippet;
	}

	let { open, title, onClose, children }: Props = $props();

	let overlayEl = $state<HTMLDivElement | null>(null);
	let panelEl = $state<HTMLDivElement | null>(null);

	// Fokus pindah ke dalam dialog, halaman di belakang di-inert, dan fokus kembali
	// ke tombol pemicu saat ditutup.
	$effect(() => {
		if (!open || !overlayEl) return;
		const trigger = document.activeElement as HTMLElement | null;
		const releaseInert = inertBackground(overlayEl);
		void tick().then(() => {
			if (panelEl) focusInside(panelEl);
		});

		return () => {
			releaseInert();
			trigger?.focus?.();
		};
	});

	function handleKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			onClose();
			return;
		}
		if (overlayEl) trapTab(event, overlayEl);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		bind:this={overlayEl}
		use:portal
		class="fixed inset-0 z-[1100] flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-4"
		role="dialog"
		aria-modal="true"
		aria-label={title ?? 'Detail'}
	>
		<button
			type="button"
			tabindex="-1"
			class="fixed inset-0 cursor-default"
			aria-label="Tutup dialog"
			onclick={onClose}
		></button>
		<div
			bind:this={panelEl}
			tabindex="-1"
			class="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[var(--radius-card)] border border-rule bg-paper-2 shadow-[var(--shadow-popup)] outline-none sm:max-w-lg sm:rounded-[var(--radius-card)]"
		>
			<div class="sticky top-0 z-10 flex items-center justify-between border-b border-rule bg-paper-2 px-5 py-3.5">
				<h2 class="text-lg font-bold text-ink">{title ?? ''}</h2>
				<button
					type="button"
					onclick={onClose}
					class="flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold text-ink-2 transition-colors hover:bg-paper-3"
					aria-label="Tutup"
				>
					&times;
				</button>
			</div>
			<div class="p-5">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
