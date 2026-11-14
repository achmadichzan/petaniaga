<script lang="ts">
	import type { PageProps } from './$types';
	import { WaOnboardingForm } from '#modules/auth';
	import Card from '#shared/components/Card.svelte';

	let { data, form }: PageProps = $props();
</script>

<section class="mx-auto max-w-lg px-4 py-8 sm:py-12">
	<Card padding="lg" class="space-y-5">
		<div>
			<h1 class="text-2xl font-bold text-ink">Lengkapi Nomor WhatsApp</h1>
			<p class="mt-1.5 text-base leading-relaxed text-ink-2">
				Agar pembeli yang melihat hasil panen di peta bisa langsung memesan ke WhatsApp Anda.
			</p>
		</div>

		<WaOnboardingForm
			sellerName={data.user.nama}
			initialWa={data.user.no_wa}
			errorMessage={form?.error ?? null}
		/>
	</Card>
</section>

