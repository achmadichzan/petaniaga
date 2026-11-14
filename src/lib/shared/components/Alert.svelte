<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'info' | 'success' | 'warning' | 'error';

	interface Props {
		tone?: Tone;
		title?: string;
		class?: string;
		children: Snippet;
	}

	let { tone = 'info', title, class: className = '', children }: Props = $props();

	const toneClasses: Record<Tone, string> = {
		info: 'border-info-border bg-info-bg text-info-ink',
		success: 'border-bubble-border bg-bubble text-bubble-ink',
		warning: 'border-warn-border bg-warn-bg text-warn-ink',
		error: 'border-error-border bg-error-bg text-error-ink'
	};
</script>

<div
	role={tone === 'error' ? 'alert' : 'status'}
	class={`rounded-[var(--radius-control)] border px-4 py-3 text-sm leading-relaxed ${toneClasses[tone]} ${className}`}
>
	{#if title}
		<p class="mb-1 font-bold">{title}</p>
	{/if}
	<div>
		{@render children()}
	</div>
</div>

