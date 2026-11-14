<script lang="ts">
	import { tick } from 'svelte';

	interface Props {
		id: string;
		name: string;
		value?: string;
		placeholder?: string;
	}

	let { id, name, value = '', placeholder = '06:00' }: Props = $props();

	const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

	let currentValue = $state('');
	let open = $state(false);
	let containerEl = $state<HTMLDivElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let listEl = $state<HTMLUListElement | null>(null);

	const listId = $derived(`${id}-hours`);

	$effect(() => {
		currentValue = value;
	});

	function optionButtons(): HTMLButtonElement[] {
		return Array.from(listEl?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
	}

	async function openList() {
		open = true;
		await tick();
		const buttons = optionButtons();
		const selected = buttons.findIndex((b) => b.textContent?.trim() === currentValue);
		(buttons[selected >= 0 ? selected : 0] ?? triggerEl)?.focus();
	}

	function closeList(refocus = true) {
		open = false;
		if (refocus) triggerEl?.focus();
	}

	function handleWindowPointerDown(event: PointerEvent) {
		if (open && containerEl && !containerEl.contains(event.target as Node)) {
			closeList(false);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			closeList();
		}
	}

	function handleTriggerKeydown(event: KeyboardEvent) {
		if (open) return;
		if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			void openList();
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
			case 'Tab':
				closeList(false);
				break;
		}
	}

	function selectHour(hour: string) {
		currentValue = hour;
		closeList();
	}
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleKeydown} />

<div bind:this={containerEl} class="relative mt-1">
	<div class="flex min-h-11 items-center rounded-[var(--radius-control)] border border-rule-strong bg-paper-2 focus-within:border-accent">
		<input
			{id}
			{name}
			type="text"
			inputmode="numeric"
			maxlength={5}
			pattern="^([01]\d|2[0-3]):[0-5]\d$"
			{placeholder}
			bind:value={currentValue}
			class="min-h-11 min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm tabular-nums text-ink focus:outline-none"
		/>
		<button
			bind:this={triggerEl}
			type="button"
			onclick={() => (open ? closeList() : void openList())}
			onkeydown={handleTriggerKeydown}
			aria-label="Pilih jam"
			aria-haspopup="listbox"
			aria-expanded={open}
			aria-controls={listId}
			class="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-ink-2 transition-colors hover:text-ink"
		>
			<svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
	</div>

	{#if open}
		<ul
			bind:this={listEl}
			id={listId}
			role="listbox"
			aria-label="Pilihan jam 24 jam"
			onkeydown={handleListKeydown}
			class="absolute left-0 z-[1000] mt-1 max-h-[184px] w-full overflow-y-auto rounded-[var(--radius-control)] border border-rule-strong bg-paper-2 py-1 shadow-[var(--shadow-popup)]"
		>
			{#each HOURS as hour (hour)}
				<li role="presentation">
					<button
						type="button"
						role="option"
						aria-selected={currentValue === hour}
						tabindex="-1"
						onclick={() => selectHour(hour)}
						class={`flex min-h-11 w-full cursor-pointer items-center px-3 text-left text-sm tabular-nums transition-colors ${
							currentValue === hour
								? 'bg-bubble font-semibold text-bubble-ink'
								: 'text-ink hover:bg-paper-3'
						}`}
					>
						{hour}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
