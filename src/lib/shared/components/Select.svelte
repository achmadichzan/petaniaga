<script lang="ts">
	import { getContext, tick } from 'svelte';
	import Icon from './Icon.svelte';
	import { FIELD_CONTEXT, type FieldContext } from './field-context.ts';
	import { portal } from '#shared/utils/portal.ts';

	export interface SelectOption {
		value: string;
		label: string;
	}

	interface Props {
		id: string;
		name?: string;
		value?: string;
		options: readonly SelectOption[];
		placeholder?: string;
		disabled?: boolean;
		invalid?: boolean;
		class?: string;
	}

	let {
		id,
		name,
		value = $bindable(''),
		options,
		placeholder = 'Pilih…',
		disabled = false,
		invalid = false,
		class: className = ''
	}: Props = $props();

	const listId = $derived(`${id}-listbox`);
	const GAP = 4;
	const ROW_HEIGHT = 44;
	const LIST_PADDING = 8;
	const MAX_ROWS = 5;

	let open = $state(false);
	let containerEl = $state<HTMLDivElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);
	let listStyle = $state('');

	const field = getContext<FieldContext | undefined>(FIELD_CONTEXT);
	const describedBy = $derived(field?.describedBy());
	const invalidState = $derived(invalid || field?.invalid() === true);

	const selectedIndex = $derived(options.findIndex((option) => option.value === value));
	const selectedLabel = $derived(
		selectedIndex >= 0 ? options[selectedIndex].label : placeholder
	);
	const triggerClass = $derived(
		[
			'flex min-h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-control)] border bg-paper-2 py-2.5 pr-3.5 pl-3.5 text-left text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
			invalidState ? 'border-error-border' : 'border-rule-strong',
			className
		].join(' ')
	);

	function optionButtons(): HTMLButtonElement[] {
		return Array.from(listEl?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
	}

	function place() {
		if (!triggerEl) return;
		const rect = triggerEl.getBoundingClientRect();
		const below = window.innerHeight - rect.bottom - GAP * 2;
		const above = rect.top - GAP * 2;
		const openUp = below < ROW_HEIGHT * 3 && above > below;
		// Tinggi dibulatkan ke kelipatan baris supaya tidak ada baris terpotong separuh.
		const space = openUp ? above : below;
		const rows = Math.max(2, Math.min(MAX_ROWS, Math.floor((space - LIST_PADDING) / ROW_HEIGHT)));
		const height = rows * ROW_HEIGHT + LIST_PADDING;

		listStyle = [
			`left:${rect.left}px`,
			`width:${rect.width}px`,
			`max-height:${height}px`,
			openUp
				? `bottom:${window.innerHeight - rect.top + GAP}px`
				: `top:${rect.bottom + GAP}px`
		].join(';');
	}

	async function openList(index = selectedIndex) {
		if (disabled) return;
		place();
		open = true;
		await tick();
		place();
		const buttons = optionButtons();
		(buttons[index >= 0 ? index : 0] ?? triggerEl)?.focus();
	}

	function closeList(refocus = true) {
		open = false;
		if (refocus) triggerEl?.focus();
	}

	function selectOption(option: SelectOption) {
		value = option.value;
		closeList();
	}

	function handleTriggerKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openList(selectedIndex >= 0 ? selectedIndex : 0);
		}
	}

	function handleListKeydown(event: KeyboardEvent) {
		const buttons = optionButtons();
		const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				buttons[Math.min(current + 1, buttons.length - 1)]?.focus();
				break;
			case 'ArrowUp':
				event.preventDefault();
				buttons[Math.max(current - 1, 0)]?.focus();
				break;
			case 'Home':
				event.preventDefault();
				buttons[0]?.focus();
				break;
			case 'End':
				event.preventDefault();
				buttons[buttons.length - 1]?.focus();
				break;
			case 'Escape':
				event.preventDefault();
				closeList();
				break;
			case 'Tab':
				closeList(false);
				break;
		}
	}

	function handleWindowPointerDown(event: PointerEvent) {
		if (!open) return;
		const target = event.target as Node;
		if (containerEl?.contains(target) || listEl?.contains(target)) return;
		closeList(false);
	}

	// Posisi fixed harus ikut anchor saat pane di-scroll; tutup hanya kalau anchor keluar layar.
	let frame = 0;
	function handleViewportChange() {
		if (!open || !triggerEl || frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			if (!open || !triggerEl) return;
			const rect = triggerEl.getBoundingClientRect();
			if (rect.bottom < 0 || rect.top > window.innerHeight) {
				closeList(false);
				return;
			}
			place();
		});
	}
</script>

<svelte:window
	onpointerdown={handleWindowPointerDown}
	onscrollcapture={handleViewportChange}
	onresize={handleViewportChange}
/>

<div bind:this={containerEl} class="relative w-full">
	{#if name}
		<input type="hidden" {name} {value} />
	{/if}

	<button
		bind:this={triggerEl}
		{id}
		type="button"
		role="combobox"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={listId}
		aria-invalid={invalidState || undefined}
		aria-describedby={describedBy}
		{disabled}
		class={triggerClass}
		onclick={() => (open ? closeList() : openList())}
		onkeydown={handleTriggerKeydown}
	>
		<span class={selectedIndex >= 0 ? 'truncate text-ink' : 'truncate text-muted'}>
			{selectedLabel}
		</span>
		<Icon
			name="chevron"
			class={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
		/>
	</button>
</div>

{#if open}
	<ul
		bind:this={listEl}
		use:portal
		id={listId}
		role="listbox"
		aria-labelledby={id}
		style={listStyle}
		class="fixed z-[1000] overflow-y-auto rounded-[var(--radius-control)] border border-rule-strong bg-paper-2 py-1 shadow-[var(--shadow-popup)]"
		onkeydown={handleListKeydown}
	>
		{#each options as option (option.value)}
			<li role="presentation">
				<button
					type="button"
					role="option"
					aria-selected={option.value === value}
					tabindex="-1"
					class={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 px-3.5 text-left text-sm transition-colors ${
						option.value === value
							? 'bg-bubble font-semibold text-bubble-ink'
							: 'text-ink hover:bg-paper-3'
					}`}
					onclick={() => selectOption(option)}
				>
					<span class="truncate">{option.label}</span>
					{#if option.value === value}
						<Icon name="check" class="h-4 w-4 shrink-0" />
					{/if}
				</button>
			</li>
		{:else}
			<li class="px-3.5 py-2 text-sm text-muted">Tidak ada pilihan.</li>
		{/each}
	</ul>
{/if}
