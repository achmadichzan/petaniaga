<script lang="ts">
	import { tick } from 'svelte';
	import { focusInside, inertBackground, trapTab } from '#shared/utils/dialog.ts';
	import { portal } from '#shared/utils/portal.ts';

	interface Props {
		open: boolean;
		src: string;
		alt: string;
		title?: string;
		onClose: () => void;
		onReport?: () => void;
		reportStatus?: string | null;
		reporting?: boolean;
	}

	let {
		open,
		src,
		alt,
		title,
		onClose,
		onReport,
		reportStatus = null,
		reporting = false
	}: Props = $props();

	const MIN_SCALE = 1;
	const MAX_SCALE = 3.5;
	const STEP = 0.5;

	let scale = $state(1);
	let offsetX = $state(0);
	let offsetY = $state(0);
	let dragging = $state(false);
	let dragStartX = 0;
	let dragStartY = 0;
	let originX = 0;
	let originY = 0;
	let overlayEl = $state<HTMLDivElement | null>(null);

	// Sama seperti Modal: fokus masuk ke dialog, latar di-inert, fokus balik ke pemicu.
	$effect(() => {
		if (!open || !overlayEl) return;
		const trigger = document.activeElement as HTMLElement | null;
		const releaseInert = inertBackground(overlayEl);
		void tick().then(() => {
			if (overlayEl) focusInside(overlayEl);
		});

		return () => {
			releaseInert();
			trigger?.focus?.();
		};
	});

	$effect(() => {
		if (open) {
			scale = 1;
			offsetX = 0;
			offsetY = 0;
			dragging = false;
		}
	});

	function clampScale(next: number): number {
		return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(next * 100) / 100));
	}

	function zoomIn() {
		scale = clampScale(scale + STEP);
	}

	function zoomOut() {
		const next = clampScale(scale - STEP);
		scale = next;
		if (next <= 1) {
			offsetX = 0;
			offsetY = 0;
		}
	}

	function resetZoom() {
		scale = 1;
		offsetX = 0;
		offsetY = 0;
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		if (event.deltaY < 0) zoomIn();
		else zoomOut();
	}

	function handleDoubleClick() {
		if (scale > 1) resetZoom();
		else scale = 2;
	}

	function handlePointerDown(event: PointerEvent) {
		if (scale <= 1) return;
		dragging = true;
		dragStartX = event.clientX;
		dragStartY = event.clientY;
		originX = offsetX;
		originY = offsetY;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent) {
		if (!dragging) return;
		offsetX = originX + (event.clientX - dragStartX);
		offsetY = originY + (event.clientY - dragStartY);
	}

	function handlePointerUp() {
		dragging = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') onClose();
		else if (event.key === '+' || event.key === '=') zoomIn();
		else if (event.key === '-') zoomOut();
		else if (event.key === '0') resetZoom();
		else if (overlayEl) trapTab(event, overlayEl);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		bind:this={overlayEl}
		use:portal
		class="fixed inset-0 z-[1200] flex flex-col bg-ink/90 text-accent-ink"
		role="dialog"
		aria-modal="true"
		aria-label={title ?? alt}
	>
		<!-- Top toolbar -->
		<div class="flex items-center justify-between gap-3 border-b border-paper-2/15 px-4 py-3">
			<p class="truncate text-sm font-semibold text-accent-ink">
				{title ?? alt}
			</p>

			<div class="flex shrink-0 items-center gap-1.5">
				<button
					type="button"
					onclick={zoomOut}
					disabled={scale <= MIN_SCALE}
					aria-label="Perkecil gambar"
					class="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-paper-2/15 text-base font-bold text-accent-ink transition-colors hover:bg-paper-2/25 disabled:cursor-not-allowed disabled:opacity-40"
				>
					−
				</button>
				<button
					type="button"
					onclick={resetZoom}
					aria-label="Reset zoom"
					class="inline-flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-full bg-paper-2/15 px-2.5 text-xs font-semibold whitespace-nowrap tabular-nums text-accent-ink transition-colors hover:bg-paper-2/25"
				>
					{Math.round(scale * 100)}%
				</button>
				<button
					type="button"
					onclick={zoomIn}
					disabled={scale >= MAX_SCALE}
					aria-label="Perbesar gambar"
					class="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-paper-2/15 text-base font-bold text-accent-ink transition-colors hover:bg-paper-2/25 disabled:cursor-not-allowed disabled:opacity-40"
				>
					+
				</button>
				<button
					type="button"
					onclick={onClose}
					aria-label="Tutup pratinjau gambar"
					class="ml-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-paper-2/15 text-lg font-bold text-accent-ink transition-colors hover:bg-paper-2/25"
				>
					&times;
				</button>
			</div>
		</div>

		{#if onReport}
			<div
				class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-paper-2/15 px-4 py-2"
			>
				<button
					type="button"
					onclick={onReport}
					disabled={reporting}
					class="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-xs font-semibold text-accent-ink/75 underline underline-offset-4 transition-colors hover:text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
				>
					{reporting ? 'Mengirim laporan…' : 'Laporkan foto ini'}
				</button>
				{#if reportStatus}
					<p class="text-xs text-accent-ink/80" role="status">{reportStatus}</p>
				{/if}
			</div>
		{/if}

		<!-- Image viewport -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative flex flex-1 items-center justify-center overflow-hidden p-4 select-none"
			onwheel={handleWheel}
		>
			<button
				type="button"
				tabindex="-1"
				class="absolute inset-0 cursor-default"
				aria-label="Tutup pratinjau"
				onclick={onClose}
			></button>
			<img
				{src}
				{alt}
				draggable="false"
				ondblclick={handleDoubleClick}
				onpointerdown={handlePointerDown}
				onpointermove={handlePointerMove}
				onpointerup={handlePointerUp}
				onpointercancel={handlePointerUp}
				style={`transform: translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale});`}
				class={`relative max-h-[82vh] max-w-full rounded-[var(--radius-card)] object-contain transition-transform duration-150 ease-[var(--ease-out)] ${
					scale > 1
						? dragging
							? 'cursor-grabbing'
							: 'cursor-grab'
						: 'cursor-zoom-in'
				}`}
			/>
		</div>
	</div>
{/if}
