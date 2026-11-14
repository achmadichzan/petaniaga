<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import type { IconName } from './Icon.svelte';

	type Tone = 'neutral' | 'muted' | 'bubble' | 'info' | 'warn' | 'error';
	type Size = 'sm' | 'md';

	interface Props {
		tone?: Tone;
		size?: Size;
		icon?: IconName;
		iconClass?: string;
		class?: string;
		children: Snippet;
	}

	let {
		tone = 'neutral',
		size = 'md',
		icon,
		iconClass = 'h-3 w-3 text-accent',
		class: className = '',
		children
	}: Props = $props();

	const toneClasses: Record<Tone, string> = {
		neutral: 'bg-paper-3 text-ink-2',
		muted: 'bg-paper-3 text-muted',
		bubble: 'bg-bubble text-bubble-ink',
		info: 'bg-info-bg text-info-ink',
		warn: 'bg-warn-bg text-warn-ink',
		error: 'bg-error-bg text-error-ink'
	};

	const sizeClasses: Record<Size, string> = {
		sm: 'px-2 py-0.5 text-[11px]',
		md: 'px-2.5 py-0.5 text-xs'
	};
</script>

<span
	class={`inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ${toneClasses[tone]} ${sizeClasses[size]} ${className}`}
>
	{#if icon}
		<Icon name={icon} class={iconClass} />
	{/if}
	{@render children()}
</span>
