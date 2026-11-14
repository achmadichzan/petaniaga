<script lang="ts">
	import { getContext } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { FIELD_CONTEXT, type FieldContext } from './field-context.ts';

	type Size = 'md' | 'lg';

	interface Props extends Omit<HTMLInputAttributes, 'value' | 'size'> {
		value?: string;
		size?: Size;
		invalid?: boolean;
	}

	let {
		value = $bindable(''),
		size = 'md',
		invalid = false,
		class: className = '',
		oninput,
		...rest
	}: Props = $props();

	const field = getContext<FieldContext | undefined>(FIELD_CONTEXT);
	const describedBy = $derived(
		[rest['aria-describedby'], field?.describedBy()].filter(Boolean).join(' ') || undefined
	);
	const invalidState = $derived(invalid || field?.invalid() === true);

	const sizeClasses: Record<Size, string> = {
		md: 'min-h-12 px-3.5 py-2.5 text-base',
		lg: 'min-h-13 px-4 py-3 text-lg'
	};

	const computedClass = $derived(
		[
			'w-full rounded-[var(--radius-control)] border bg-paper-2 text-ink placeholder:text-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
			invalidState ? 'border-error-border' : 'border-rule-strong',
			sizeClasses[size],
			className
		]
			.filter(Boolean)
			.join(' ')
	);

	function handleInput(event: Event) {
		value = (event.currentTarget as HTMLInputElement).value;
		oninput?.(event as InputEvent & { currentTarget: EventTarget & HTMLInputElement });
	}
</script>

<input
	{...rest}
	{value}
	oninput={handleInput}
	class={computedClass}
	aria-invalid={invalidState || undefined}
	aria-describedby={describedBy}
/>
