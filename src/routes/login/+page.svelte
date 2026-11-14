<script lang="ts">
	import type { PageProps } from './$types';
	import { InAppBrowserBanner } from '#modules/auth';
	import Alert from '#shared/components/Alert.svelte';
	import Button from '#shared/components/Button.svelte';
	import Card from '#shared/components/Card.svelte';
	import Icon from '#shared/components/Icon.svelte';

	let { data, form }: PageProps = $props();
</script>

<section class="mx-auto max-w-lg px-4 py-8 sm:py-12">
	<Card padding="lg" class="space-y-6">
		<div class="space-y-3 text-center">
			<div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-rule bg-paper-3 text-accent">
				<Icon name="sprout" class="h-7 w-7" />
			</div>
			<h1 class="text-2xl font-bold text-ink">Masuk sebagai Penjual</h1>
			<p class="text-base leading-relaxed text-ink-2">
				Jual hasil panen langsung ke pembeli sekitar tanpa potongan tengkulak. Gratis 100%, tanpa perlu verifikasi OTP berbayar.
			</p>
		</div>

		<InAppBrowserBanner />

		{#if data.errorMessage || form?.error}
			<Alert tone="error" title="Gagal Masuk">
				{data.errorMessage ?? form?.error}
			</Alert>
		{/if}

		{#if !data.oauthConfigured}
			<Alert tone="warning" title="Google OAuth Belum Dikonfigurasi">
				Isi <code>GOOGLE_CLIENT_ID</code> dan <code>GOOGLE_CLIENT_SECRET</code> pada file
				<code>.dev.vars</code> (lokal) atau pengaturan Environment Variables Cloudflare Pages.
			</Alert>
		{/if}

		<div class="space-y-3">
			<Button href="/auth/login/google" variant="primary" size="lg" fullWidth>
				<svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
					<path
						fill="currentColor"
						d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81"
					/>
				</svg>
				<span>Masuk dengan Google</span>
			</Button>

			{#if data.devLoginEnabled}
				<form method="POST" action="?/devLogin">
					<Button type="submit" variant="secondary" size="lg" fullWidth>
						Masuk Mode Uji Coba Lokal (Dev)
					</Button>
				</form>
			{/if}
		</div>

		<ul class="space-y-2 rounded-[var(--radius-control)] border border-rule bg-paper-3 p-4 text-sm leading-relaxed text-ink-2">
			<li><span class="mr-1.5 font-semibold tabular-nums text-muted">1.</span>Masuk dengan akun Google Anda (1 klik).</li>
			<li><span class="mr-1.5 font-semibold tabular-nums text-muted">2.</span>Isi nomor WhatsApp aktif sekali saja agar pembeli bisa menghubungi Anda.</li>
			<li><span class="mr-1.5 font-semibold tabular-nums text-muted">3.</span>Foto hasil panen, tekan tombol lokasi GPS, langsung tayang di peta!</li>
		</ul>
	</Card>
</section>

