<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import Icon from '#shared/components/Icon.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const pathname = $derived(page.url.pathname);
	const isMapActive = $derived(pathname === '/');
	const isSellerActive = $derived(pathname.startsWith('/dashboard') || pathname.startsWith('/login'));
	const isSplitDesktop = $derived(isMapActive || pathname.startsWith('/dashboard'));

	// Browser chrome colour comes from the token instead of a duplicated literal.
	let themeColor = $state<string | null>(null);
	onMount(() => {
		themeColor =
			getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || null;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Petaniaga — Peta Niaga Hasil Tani, Laut &amp; UMKM Lokal</title>
	{#if themeColor}
		<meta name="theme-color" content={themeColor} />
	{/if}
</svelte:head>

<div class="flex min-h-screen flex-col bg-paper text-ink lg:h-screen lg:flex-row lg:overflow-hidden">
	<!-- Mobile top header -->
	<header class="sticky top-0 z-[1100] border-b border-rule bg-accent text-accent-ink lg:hidden">
		<div class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
			<a href="/" class="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-control)] py-0.5 text-accent-ink">
				<span class="flex h-9 w-9 items-center justify-center rounded-full bg-paper-2/15 text-accent-ink">
					<Icon name="sprout" class="h-5 w-5" />
				</span>
				<div>
					<span class="block text-lg leading-tight font-bold tracking-tight">Petaniaga</span>
					<span class="block text-xs font-normal text-accent-ink/85">
						Langsung dari Produsen
					</span>
				</div>
			</a>

			<nav class="flex items-center gap-2">
				<a
					href={data.user ? '/dashboard' : '/login'}
					class="inline-flex min-h-11 items-center whitespace-nowrap rounded-[var(--radius-control)] bg-paper-2 px-3.5 py-2 text-sm font-semibold text-accent transition-colors hover:bg-paper-3"
				>
					{data.user ? 'Lapak Saya' : 'Jual Panen'}
				</a>
			</nav>
		</div>
	</header>

	<!-- Desktop WhatsApp-style left icon rail -->
	<aside
		aria-label="Navigasi utama"
		class="hidden lg:flex lg:w-16 lg:shrink-0 lg:flex-col lg:items-center lg:justify-between lg:border-r lg:border-rule lg:bg-paper-3 lg:py-3"
	>
		<div class="flex flex-col items-center gap-2">
			<a
				href="/"
				title="Peta Panen"
				aria-label="Peta Panen"
				class={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
					isMapActive
						? 'bg-paper-2 text-accent shadow-[var(--shadow-card)]'
						: 'text-ink-2 hover:bg-rule'
				}`}
			>
				<Icon name="sprout" class="h-5 w-5" />
			</a>
		</div>

		<div class="flex flex-col items-center gap-2">
			<a
				href={data.user ? '/dashboard' : '/login'}
				title={data.user ? `Lapak Saya (${data.user.nama})` : 'Masuk Penjual'}
				aria-label={data.user ? 'Lapak Penjual' : 'Masuk Penjual'}
				class={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
					isSellerActive
						? 'bg-paper-2 text-accent shadow-[var(--shadow-card)]'
						: 'bg-paper-2 text-ink-2 shadow-[var(--shadow-card)] hover:bg-rule'
				}`}
			>
				<Icon name="user" class="h-5 w-5" />
			</a>
		</div>
	</aside>

	<main class={`flex-1 min-w-0 ${isSplitDesktop ? 'lg:flex lg:h-full lg:flex-col lg:overflow-hidden' : 'lg:overflow-y-auto'}`}>
		{@render children()}
	</main>
</div>
