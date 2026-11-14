<script lang="ts">
	import { onMount } from 'svelte';
	import Alert from '#shared/components/Alert.svelte';
	import Button from '#shared/components/Button.svelte';
	import { buildAndroidChromeIntentUrl, detectInAppBrowser } from '#shared/utils/whatsapp.ts';

	let isInApp = $state(false);
	let appName = $state<string | null>(null);
	let isAndroid = $state(false);
	let chromeIntentUrl = $state('');
	let copied = $state(false);

	onMount(() => {
		const info = detectInAppBrowser(navigator.userAgent);
		isInApp = info.isInApp;
		appName = info.appName;
		isAndroid = info.isAndroid;
		chromeIntentUrl = buildAndroidChromeIntentUrl(window.location.href);
	});

	async function copyCurrentLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 3000);
		} catch {
			copied = false;
		}
	}
</script>

{#if isInApp}
	<Alert tone="warning" title={`Dibuka lewat browser dalam ${appName ?? 'aplikasi'}`}>
		<p class="mb-3">
			Login Google tidak diizinkan dari browser di dalam {appName ?? 'aplikasi'}. Buka halaman ini di
			<strong>Google Chrome</strong> atau <strong>Safari</strong> terlebih dahulu.
		</p>
		<div class="flex flex-col gap-2.5 sm:flex-row">
			{#if isAndroid}
				<Button href={chromeIntentUrl} variant="primary" size="lg" fullWidth>
					Buka di Google Chrome
				</Button>
			{/if}
			<Button type="button" variant="secondary" size="lg" fullWidth onclick={copyCurrentLink}>
				{copied ? 'Link Tersalin!' : 'Salin Link Halaman'}
			</Button>
		</div>
	</Alert>
{/if}
