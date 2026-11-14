<script lang="ts">
	import { enhance } from '$app/forms';
	import Alert from '#shared/components/Alert.svelte';
	import Button from '#shared/components/Button.svelte';
	import Field from '#shared/components/Field.svelte';
	import Input from '#shared/components/Input.svelte';
	import { normalizeWaNumber } from '#shared/utils/format.ts';

	interface Props {
		sellerName: string;
		initialWa?: string | null;
		errorMessage?: string | null;
		submitLabel?: string;
		action?: string;
	}

	let {
		sellerName,
		initialWa = '',
		errorMessage = null,
		submitLabel = 'Simpan Nomor WhatsApp',
		action
	}: Props = $props();

	let waInput = $state('');
	let isSubmitting = $state(false);
	let initialized = false;

	$effect(() => {
		if (!initialized && initialWa) {
			initialized = true;
			waInput = `0${initialWa.replace(/^62/, '')}`;
		}
	});

	const previewNormalized = $derived(normalizeWaNumber(waInput));
</script>

<form
	method="POST"
	{action}
	use:enhance={() => {
		isSubmitting = true;
		return async ({ update }) => {
			await update();
			isSubmitting = false;
		};
	}}
	class="space-y-5"
>
	{#if errorMessage}
		<Alert tone="error" title="Periksa Nomor WhatsApp">
			{errorMessage}
		</Alert>
	{/if}

	<div class="rounded-[var(--radius-control)] border border-bubble-border bg-bubble p-4 text-sm leading-relaxed text-bubble-ink">
		Halo <strong>{sellerName}</strong>! Pembeli akan menghubungi Anda langsung lewat WhatsApp tanpa perantara. Masukkan nomor WhatsApp aktif Anda cukup satu kali ini saja.
	</div>

	<div class="space-y-2">
		<Field
			id="no_wa"
			label="Nomor WhatsApp Aktif"
			hint={waInput.trim() ? undefined : 'Bisa diawali 08… atau 628… (otomatis diformat).'}
			error={waInput.trim() && !previewNormalized
				? 'Gunakan nomor HP Indonesia diawali 08… atau 628… (10-15 digit).'
				: null}
		>
			<Input
				id="no_wa"
				name="no_wa"
				type="tel"
				inputmode="numeric"
				autocomplete="tel"
				size="lg"
				required
				bind:value={waInput}
				placeholder="Contoh: 081234567890"
			/>
			{#if previewNormalized}
				<p class="text-sm text-accent">
					Link tujuan pembeli: <span class="font-semibold tabular-nums">wa.me/{previewNormalized}</span>
				</p>
			{/if}
		</Field>
	</div>

	<Button type="submit" variant="whatsapp" fullWidth disabled={isSubmitting}>
		{isSubmitting ? 'Menyimpan…' : submitLabel}
	</Button>
</form>
