<script lang="ts">
	import type { GeoPoint, MapProductItem } from "#modules/geo/types.ts";
	import Badge from "#shared/components/Badge.svelte";
	import Button from "#shared/components/Button.svelte";
	import Icon from "#shared/components/Icon.svelte";
	import type { IconName } from "#shared/components/Icon.svelte";
	import { getCategoryMeta } from "#shared/constants/harvest.ts";
	import {
		formatDistanceKm,
		formatRemainingDays,
		formatRupiah,
	} from "#shared/utils/format.ts";
	import { getLapakStatus } from "#shared/utils/lapak.ts";
	import { buildWhatsAppOrderUrl } from "#shared/utils/whatsapp.ts";

	interface Props {
		product: MapProductItem;
		selected?: boolean;
		userLocation?: GeoPoint | null;
		onSelect?: (product: MapProductItem) => void;
		onPreviewImage?: (product: MapProductItem) => void;
		/** True for the first card in the list: it holds the largest paint and is the LCP candidate. */
		priority?: boolean;
	}

	let {
		product,
		selected = false,
		userLocation = null,
		onSelect,
		onPreviewImage,
		priority = false,
	}: Props = $props();

	const meta = $derived(getCategoryMeta(product.kategori));
	const categoryIcon = $derived((meta.value as IconName) || "lainnya");
	const waUrl = $derived(
		buildWhatsAppOrderUrl({
			noWa: product.no_wa,
			namaPenjual: product.penjual_nama,
			namaProduk: product.nama_produk,
			harga: product.harga,
			satuan: product.satuan,
		}),
	);
	const distanceLabel = $derived(
		userLocation
			? formatDistanceKm(
					userLocation.lat,
					userLocation.lng,
					product.lat,
					product.lng,
				)
			: null,
	);
	const lapakStatus = $derived(
		getLapakStatus(
			product.is_open,
			product.jam_buka,
			product.jam_tutup,
			product.lng,
		),
	);
</script>

<!-- Satu kontrol per baris: tombol transparan menutupi seluruh kartu (pola stretched
     button), sedangkan tombol foto dan tautan WA dinaikkan di atasnya. Dengan begitu
     tidak ada tombol/tautan bersarang di dalam tombol. -->
<article
	class={`relative border-b border-rule px-3 py-2.5 transition-colors ${
		selected ? "bg-bubble" : "bg-paper-2 hover:bg-paper-3"
	}`}
>
	<button
		type="button"
		onclick={() => onSelect?.(product)}
		aria-pressed={selected}
		aria-label={`Tampilkan ${product.nama_produk} di peta`}
		class="absolute inset-0 z-0 cursor-pointer"
	></button>

	<div class="relative flex items-start gap-3">
		<button
			type="button"
			onclick={() => onPreviewImage?.(product)}
			aria-label={`Perbesar foto ${product.nama_produk}`}
			class="relative z-10 h-14 w-14 shrink-0 cursor-zoom-in overflow-hidden rounded-full bg-paper-3 transition-transform hover:scale-105"
		>
			<img
				src={product.foto_url}
				alt={product.nama_produk}
				loading={priority ? "eager" : "lazy"}
				fetchpriority={priority ? "high" : "auto"}
				class="h-full w-full object-cover"
			/>
		</button>

		<div class="min-w-0 flex-1">
			<div class="flex items-baseline justify-between gap-2">
				<h3 class="min-w-0 text-[15px] font-semibold text-ink">
					<span class="line-clamp-1">{product.nama_produk}</span>
				</h3>
				<span
					class="shrink-0 text-sm font-bold tabular-nums text-accent"
				>
					{formatRupiah(product.harga)}<span
						class="text-xs font-normal text-muted"
						>/{product.satuan}</span
					>
				</span>
			</div>

			<div
				class="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted"
			>
				<span class="truncate">Penjual: {product.penjual_nama}</span>
				<span class="shrink-0 tabular-nums"
					>{formatRemainingDays(product.expired_at)}</span
				>
			</div>

			{#if product.stok_info}
				<p class="mt-1 break-words text-xs leading-snug text-ink-2">
					{product.stok_info}
				</p>
			{/if}

			<div class="mt-2 flex items-center justify-between gap-2">
				<div class="flex min-w-0 flex-wrap items-center gap-1.5">
					<Badge size="sm" icon={categoryIcon}>{meta.label}</Badge>
					{#if distanceLabel}
						<Badge size="sm" tone="info">{distanceLabel}</Badge>
					{/if}
					{#if !lapakStatus.open}
						<Badge
							size="sm"
							tone="muted"
							class="min-w-0 max-w-full truncate"
						>
							{lapakStatus.label}{lapakStatus.schedule
								? ` (${lapakStatus.schedule})`
								: ""}
						</Badge>
					{:else if lapakStatus.schedule}
						<Badge
							size="sm"
							tone="bubble"
							class="min-w-0 max-w-full truncate"
							>Buka {lapakStatus.schedule}</Badge
						>
					{/if}
				</div>

				<Button
					href={waUrl}
					target="_blank"
					rel="noopener noreferrer"
					variant="whatsapp"
					size="sm"
					shape="pill"
					class="relative z-10 shrink-0"
				>
					<Icon name="whatsapp" class="h-3.5 w-3.5" />
					<span>Pesan WA</span>
				</Button>
			</div>
		</div>
	</div>
</article>
