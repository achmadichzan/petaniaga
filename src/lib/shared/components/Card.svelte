<script lang="ts">
	import type { Snippet } from 'svelte';

	type Padding = 'none' | 'md' | 'lg';

	interface Props {
		padding?: Padding;
		class?: string;
		children: Snippet;
	}

	let { padding = 'md', class: className = '', children }: Props = $props();

	const paddingClasses: Record<Padding, string> = {
		none: '',
		md: 'p-4',
		lg: 'p-6 sm:p-8'
	};
</script>

<div
	class={`rounded-[var(--radius-card)] border border-rule bg-paper-2 shadow-[var(--shadow-card)] ${paddingClasses[padding]} ${className}`}
>
	{@render children()}
</div>
