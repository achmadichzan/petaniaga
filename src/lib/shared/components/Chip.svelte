<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLButtonAttributes, 'class'> {
		active?: boolean;
		class?: string;
		children: Snippet;
	}

	let { active = false, class: className = '', children, ...rest }: Props = $props();
</script>

<button
	type="button"
	aria-pressed={active}
	class={`inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
		active
			? 'border-bubble-border bg-bubble text-bubble-ink'
			: 'border-rule-strong bg-paper-2 text-ink-2 hover:bg-paper-3'
	} ${className}`}
	{...rest}
>
	{@render children()}
</button>
