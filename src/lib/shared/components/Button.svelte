<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'whatsapp' | 'danger' | 'ghost';
	type Size = 'sm' | 'md' | 'lg';
	type Shape = 'rounded' | 'pill';

	interface BaseProps {
		variant?: Variant;
		size?: Size;
		shape?: Shape;
		fullWidth?: boolean;
		class?: string;
		children: Snippet;
	}

	type ButtonProps = BaseProps &
		HTMLButtonAttributes & {
			href?: undefined;
		};

	type AnchorProps = BaseProps &
		HTMLAnchorAttributes & {
			href: string;
		};

	let {
		variant = 'primary',
		size = 'lg',
		shape = 'rounded',
		fullWidth = false,
		class: className = '',
		href,
		children,
		...rest
	}: ButtonProps | AnchorProps = $props();

	const variantClasses: Record<Variant, string> = {
		primary:
			'bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-active shadow-sm border border-accent-hover',
		secondary:
			'bg-paper-2 text-ink hover:bg-paper-3 active:bg-rule border border-rule-strong shadow-xs',
		whatsapp:
			'bg-wa text-wa-ink hover:bg-wa-hover active:bg-wa-active shadow-sm border border-wa-hover',
		danger:
			'bg-danger text-danger-ink hover:bg-danger-hover active:bg-danger-active border border-danger-hover',
		ghost: 'bg-transparent text-ink-2 hover:bg-paper-3 active:bg-rule border border-transparent'
	};

	const sizeClasses: Record<Size, string> = {
		sm: 'min-h-11 px-3 text-xs',
		md: 'min-h-11 px-4 py-2 text-sm',
		lg: 'min-h-12 px-5 py-3 text-base'
	};

	const computedClass = $derived(
		[
			'inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none',
			variantClasses[variant],
			sizeClasses[size],
			shape === 'pill' ? 'rounded-full' : 'rounded-[var(--radius-control)]',
			fullWidth ? 'w-full' : '',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#if href}
	<a {href} class={computedClass} {...rest as HTMLAnchorAttributes}>
		{@render children()}
	</a>
{:else}
	<button class={computedClass} {...rest as HTMLButtonAttributes}>
		{@render children()}
	</button>
{/if}

