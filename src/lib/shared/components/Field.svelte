<script lang="ts">
	import { setContext, type Snippet } from 'svelte';
	import { FIELD_CONTEXT } from './field-context.ts';

	interface Props {
		id: string;
		label: string;
		hint?: string;
		error?: string | null;
		class?: string;
		children: Snippet;
	}

	let { id, label, hint, error = null, class: className = '', children }: Props = $props();

	const hintId = $derived(`${id}-hint`);
	const errorId = $derived(`${id}-error`);
	const messageId = $derived(error ? errorId : hint ? hintId : undefined);

	// Kontrol di dalam Field (Input/Select) membaca konteks ini untuk aria-describedby
	// dan aria-invalid, jadi pesan error tidak pernah lepas dari field-nya.
	setContext(FIELD_CONTEXT, {
		describedBy: () => messageId,
		invalid: () => Boolean(error)
	});
</script>

<div class={['space-y-1.5', className].filter(Boolean).join(' ')}>
	<label for={id} class="block text-sm font-semibold text-ink">{label}</label>
	{@render children()}
	{#if error}
		<p id={errorId} class="text-xs font-semibold text-error-ink" role="alert">{error}</p>
	{:else if hint}
		<p id={hintId} class="text-xs text-muted">{hint}</p>
	{/if}
</div>
