<script lang="ts">
	import { ProductCard } from '#modules/catalog';
	import { MapCanvas } from '#modules/geo';
	import type { BoundingBox, GeoPoint, MapProductItem } from '#modules/geo';
	import Alert from '#shared/components/Alert.svelte';
	import Button from '#shared/components/Button.svelte';
	import Chip from '#shared/components/Chip.svelte';
	import Icon from '#shared/components/Icon.svelte';
	import type { IconName } from '#shared/components/Icon.svelte';
	import ImageZoomModal from '#shared/components/ImageZoomModal.svelte';
	import { PRODUCT_CATEGORIES } from '#shared/constants/harvest.ts';

	let products = $state<MapProductItem[]>([]);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let zoomTooWide = $state(false);
	let hasMore = $state(false);

	let activeCategory = $state<string>('semua');
	let searchQuery = $state<string>('');
	let currentBounds = $state<BoundingBox | null>(null);
	let currentZoom = $state<number>(7);
	let mapCenter = $state<GeoPoint>({ lat: -7.25, lng: 109.75 });
	let mapZoom = $state<number>(7);

	let userLocation = $state<GeoPoint | null>(null);
	let gpsLoading = $state(false);
	let gpsError = $state<string | null>(null);

	let selectedProductId = $state<string | null>(null);
	let previewProduct = $state<MapProductItem | null>(null);
	let reportStatus = $state<string | null>(null);
	let reporting = $state(false);
	let activeFetchController: AbortController | null = null;

	const filteredProducts = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return products;
		return products.filter(
			(p) =>
				p.nama_produk.toLowerCase().includes(q) ||
				p.penjual_nama.toLowerCase().includes(q)
		);
	});

	async function fetchProducts(bounds: BoundingBox, zoom: number, kategori: string) {
		activeFetchController?.abort();
		const controller = new AbortController();
		activeFetchController = controller;

		loading = true;
		errorMessage = null;

		const params = new URLSearchParams({
			north: String(bounds.north),
			south: String(bounds.south),
			east: String(bounds.east),
			west: String(bounds.west),
			zoom: String(zoom),
			kategori
		});

		try {
			const res = await fetch(`/api/map-products?${params.toString()}`, {
				signal: controller.signal
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { message?: string } | null;
				throw new Error(body?.message || 'Gagal memuat hasil panen di peta.');
			}
			const data = (await res.json()) as {
				products: MapProductItem[];
				hasMore: boolean;
				zoomTooWide: boolean;
			};
			products = data.products;
			hasMore = data.hasMore;
			zoomTooWide = data.zoomTooWide;
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			errorMessage =
				err instanceof Error ? err.message : 'Gagal terhubung ke server peta.';
		} finally {
			if (activeFetchController === controller) {
				loading = false;
			}
		}
	}

	function handleBoundsChange(bounds: BoundingBox, zoom: number) {
		currentBounds = bounds;
		currentZoom = zoom;
		void fetchProducts(bounds, zoom, activeCategory);
	}

	function selectCategory(category: string) {
		activeCategory = category;
		if (currentBounds) {
			void fetchProducts(currentBounds, currentZoom, category);
		}
	}

	function handleUseMyLocation() {
		if (!navigator.geolocation) {
			gpsError = 'Browser Anda tidak mendukung GPS.';
			return;
		}
		gpsLoading = true;
		gpsError = null;
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				gpsLoading = false;
				const point = {
					lat: pos.coords.latitude,
					lng: pos.coords.longitude
				};
				userLocation = point;
				mapCenter = point;
				mapZoom = 12;
			},
			(err) => {
				gpsLoading = false;
				gpsError =
					err.code === err.PERMISSION_DENIED
						? 'Izin lokasi ditolak. Geser peta secara manual ke daerah Anda.'
						: 'Lokasi GPS tidak dapat dideteksi saat ini.';
			},
			{ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
		);
	}

	function handlePreview(product: MapProductItem) {
		previewProduct = product;
		reportStatus = null;
	}

	async function handleReport() {
		const product = previewProduct;
		if (!product || reporting) return;

		reporting = true;
		reportStatus = null;
		try {
			const res = await fetch(`/api/products/${product.id}/report`, { method: 'POST' });
			const body = (await res.json().catch(() => null)) as { message?: string } | null;
			if (!res.ok) {
				throw new Error(body?.message || 'Gagal mengirim laporan.');
			}
			reportStatus = body?.message ?? 'Laporan diterima. Terima kasih.';
		} catch (err) {
			reportStatus = err instanceof Error ? err.message : 'Gagal mengirim laporan.';
		} finally {
			reporting = false;
		}
	}

	function handleSelectFromMap(product: MapProductItem) {
		selectedProductId = product.id;
	}

	function handleSelectFromCard(product: MapProductItem) {
		selectedProductId = product.id;
		mapCenter = { lat: product.lat, lng: product.lng };
		mapZoom = Math.max(currentZoom, 13);
		document
			.getElementById('map-canvas-section')
			?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}
</script>

<div class="flex flex-1 flex-col lg:h-full lg:flex-row lg:overflow-hidden">
	<!-- Left pane: WhatsApp-style harvest list -->
	<aside class="order-2 flex min-w-0 flex-col bg-paper-2 lg:order-1 lg:h-full lg:w-[500px] lg:shrink-0 lg:border-r lg:border-rule xl:w-[560px]">
		<!-- Pane header -->
		<div class="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
			<!-- Header mobile sudah menampilkan wordmark; di layar kecil heading ini
			     tetap ada untuk pembaca layar, tampil visual mulai lg. -->
			<h1 class="text-[22px] font-bold tracking-tight text-wa sr-only lg:not-sr-only">
				Petaniaga
			</h1>

			<button
				type="button"
				onclick={handleUseMyLocation}
				disabled={gpsLoading}
				title="Cari panen di sekitar lokasi saya"
				class="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-paper-3 px-3 text-xs font-semibold text-ink transition-colors hover:bg-rule disabled:opacity-60"
			>
				<Icon name="pin" class="h-4 w-4 text-accent" />
				<span>{gpsLoading ? 'Mencari...' : 'Sekitarku'}</span>
			</button>
		</div>

		<!-- Search input -->
		<div class="px-3 pb-2.5">
			<label class="flex items-center gap-2.5 rounded-full border border-muted bg-paper-3 px-3.5 py-0.5 text-sm text-ink-2 focus-within:ring-2 focus-within:ring-accent/30">
				<Icon name="search" class="h-4 w-4 shrink-0 text-muted" />
				<input
					type="search"
					aria-label="Cari hasil panen atau penjual"
					bind:value={searchQuery}
					placeholder="Cari hasil panen atau penjual..."
					class="min-h-11 w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
				/>
			</label>
		</div>

		<!-- Filter chips -->
		<div class="flex flex-wrap items-center gap-1.5 border-b border-rule px-3 pb-2.5">
			<Chip active={activeCategory === 'semua'} onclick={() => selectCategory('semua')}>
				<span>Semua</span>
				<span class="tabular-nums opacity-80">{products.length}</span>
			</Chip>
			{#each PRODUCT_CATEGORIES as cat}
				<Chip active={activeCategory === cat.value} onclick={() => selectCategory(cat.value)}>
					<Icon name={cat.value as IconName} class="h-3.5 w-3.5" />
					<span>{cat.label}</span>
				</Chip>
			{/each}
		</div>

		<!-- Scrollable list -->
		<div class="flex-1 overflow-y-auto">
			{#if gpsError}
				<div class="p-3">
					<Alert tone="warning">{gpsError}</Alert>
				</div>
			{/if}

			{#if errorMessage}
				<div class="p-3">
					<Alert tone="error">{errorMessage}</Alert>
				</div>
			{/if}

			{#if zoomTooWide}
				<div class="p-3">
					<Alert tone="warning" title="Tampilan Peta Terlalu Luas">
						Perbesar (zoom in) peta ke wilayah provinsi atau kota Anda agar produk penjual tampil lebih akurat.
					</Alert>
				</div>
			{:else if hasMore}
				<div class="border-b border-rule bg-paper-3 px-3 py-2 text-xs text-ink-2">
					Menampilkan {products.length} produk pertama di area peta. Perbesar peta untuk hasil lebih spesifik.
				</div>
			{/if}

			{#if !loading && !zoomTooWide && filteredProducts.length === 0 && !errorMessage}
				<div class="p-6 text-center">
					<p class="text-base font-bold text-ink">
						{searchQuery ? 'Tidak ada hasil yang cocok' : 'Belum ada hasil panen di area ini'}
					</p>
					<p class="mt-1 text-sm text-ink-2">
						{searchQuery
							? 'Coba kata kunci lain atau hapus pencarian.'
							: 'Geser atau perbesar peta ke daerah lain, atau tawarkan hasil panen Anda.'}
					</p>
					{#if !searchQuery}
						<Button href="/login" variant="whatsapp" size="sm" shape="pill" class="mt-4">
							Penjual? Jual Panen di Sini
						</Button>
					{/if}
				</div>
			{:else}
				<div>
					{#each filteredProducts as item, index (item.id)}
						<ProductCard
							product={item}
							priority={index === 0}
							selected={selectedProductId === item.id}
							{userLocation}
							onSelect={handleSelectFromCard}
							onPreviewImage={handlePreview}
						/>
					{/each}
				</div>
			{/if}
		</div>
	</aside>

	<!-- Right pane: Full-bleed Map -->
	<section id="map-canvas-section" class="relative order-1 min-w-0 flex-1 bg-paper lg:order-2 lg:h-full">
		<div class="relative h-[44vh] min-h-[300px] w-full lg:h-full">
			<MapCanvas
				{products}
				{selectedProductId}
				{userLocation}
				center={mapCenter}
				zoom={mapZoom}
				containerClass="border-b border-rule lg:border-0"
				onBoundsChange={handleBoundsChange}
				onSelectProduct={handleSelectFromMap}
				onClosePopup={() => (selectedProductId = null)}
			/>

			{#if loading}
				<div class="pointer-events-none absolute top-3 right-3 z-[500] rounded-full border border-rule bg-paper-2 px-3 py-1.5 text-xs font-semibold text-accent shadow-[var(--shadow-card)]">
					Memuat hasil panen…
				</div>
			{/if}
		</div>
	</section>
</div>

<ImageZoomModal
	open={Boolean(previewProduct)}
	src={previewProduct?.foto_url ?? ''}
	alt={previewProduct?.nama_produk ?? ''}
	title={previewProduct?.nama_produk}
	onClose={() => (previewProduct = null)}
	onReport={handleReport}
	{reportStatus}
	{reporting}
/>
