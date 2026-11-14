<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import type * as LeafletNS from 'leaflet';
	import { getCategoryMeta } from '#shared/constants/harvest.ts';
	import {
		formatDistanceKm,
		formatRemainingDays,
		formatRupiah
	} from '#shared/utils/format.ts';
	import { getLapakStatus } from '#shared/utils/lapak.ts';
	import { buildWhatsAppOrderUrl } from '#shared/utils/whatsapp.ts';
	import type { BoundingBox, GeoPoint, MapProductItem } from '../types';

	interface Props {
		products: MapProductItem[];
		selectedProductId?: string | null;
		userLocation?: GeoPoint | null;
		center?: GeoPoint;
		zoom?: number;
		onBoundsChange?: (bounds: BoundingBox, zoom: number) => void;
		onSelectProduct?: (product: MapProductItem) => void;
		onClosePopup?: () => void;
		containerClass?: string;
	}

	let {
		products,
		selectedProductId = null,
		userLocation = null,
		center = { lat: -7.25, lng: 109.75 },
		zoom = 7,
		onBoundsChange,
		onSelectProduct,
		onClosePopup,
		containerClass = 'rounded-[var(--radius-card)] border border-rule'
	}: Props = $props();

	let mapContainer = $state<HTMLDivElement | null>(null);
	let L = $state<typeof LeafletNS | null>(null);
	let map = $state<LeafletNS.Map | null>(null);
	let markersLayer = $state<LeafletNS.LayerGroup | null>(null);
	let userLayer = $state<LeafletNS.LayerGroup | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let lastCenteredPoint = '';
	const markerById = new Map<string, LeafletNS.Marker>();
	const groupById = new Map<string, MapProductItem[]>();
	let lastHighlightedId: string | null = null;
	let isRebuildingMarkers = false;
	// Diatur saat popup dibuka lewat Enter/Space, dipakai handler popupopen/popupclose.
	let focusPopupOnOpen = false;
	let restoreFocusOnClose = false;

	function formatShortPrice(harga: number): string {
		if (harga >= 1_000_000) {
			return `Rp ${(harga / 1_000_000).toFixed(1).replace('.0', '')}jt`;
		}
		if (harga >= 1_000) {
			return `Rp ${Math.round(harga / 100) / 10}rb`.replace('.0rb', 'rb');
		}
		return `Rp ${harga}`;
	}

	function tokenColor(name: string): string {
		if (typeof window === 'undefined') return '';
		return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	}

	function escapeHtml(text: string): string {
		return text
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;');
	}

	function safeUrl(url: string): string {
		return url.startsWith('/') || url.startsWith('https://') || url.startsWith('http://')
			? url
			: '';
	}

	const CATEGORY_SVG_PATHS: Record<string, string> = {
		sayur:
			'<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
		beras:
			'<path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/>',
		buah:
			'<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
		umbi:
			'<path d="M12 3c-2.5 0-4.5 2-4.5 5 0 4 2 9 4.5 13 2.5-4 4.5-9 4.5-13 0-3-2-5-4.5-5Z"/><path d="M10 9h2"/><path d="M12 13h2"/>',
		laut:
			'<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6-3.56 0-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M6.5 12 2 9v6l4.5-3Z"/>',
		olahan:
			'<path d="M8 3h8"/><path d="M7 7h10l1 13H6L7 7Z"/><path d="M10 3v4"/><path d="M14 3v4"/>',
		lainnya:
			'<path d="M5 10h14l-1.5 9h-11Z"/><path d="M3 10h18"/><path d="m9 10 3-6 3 6"/>'
	};

	function categorySvg(category: string, size = 13, color = 'currentColor'): string {
		const paths = CATEGORY_SVG_PATHS[category] ?? CATEGORY_SVG_PATHS.lainnya;
		return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;flex-shrink:0;stroke:${color};">${paths}</svg>`;
	}

	interface MapCluster {
		lat: number;
		lng: number;
		lapakCount: number;
		items: MapProductItem[];
	}

	function clusterProducts(leafletMap: LeafletNS.Map, items: MapProductItem[]): MapCluster[] {
		const coordGroups = new Map<string, MapProductItem[]>();
		for (const item of items) {
			const key = `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`;
			const list = coordGroups.get(key);
			if (list) list.push(item);
			else coordGroups.set(key, [item]);
		}

		const lapaks = Array.from(coordGroups.values()).map((group) => ({
			lat: group[0].lat,
			lng: group[0].lng,
			point: leafletMap.latLngToLayerPoint([group[0].lat, group[0].lng]),
			items: group
		}));

		if (leafletMap.getZoom() >= 15) {
			return lapaks.map((l) => ({
				lat: l.lat,
				lng: l.lng,
				lapakCount: 1,
				items: l.items
			}));
		}

		const THRESHOLD_SQ = 58 * 58;
		const visited = new Array<boolean>(lapaks.length).fill(false);
		const clusters: MapCluster[] = [];

		for (let i = 0; i < lapaks.length; i++) {
			if (visited[i]) continue;
			visited[i] = true;
			const seed = lapaks[i];
			const merged = [seed];

			for (let j = i + 1; j < lapaks.length; j++) {
				if (visited[j]) continue;
				const dx = seed.point.x - lapaks[j].point.x;
				const dy = seed.point.y - lapaks[j].point.y;
				if (dx * dx + dy * dy <= THRESHOLD_SQ) {
					visited[j] = true;
					merged.push(lapaks[j]);
				}
			}

			const avgLat = merged.reduce((sum, m) => sum + m.lat, 0) / merged.length;
			const avgLng = merged.reduce((sum, m) => sum + m.lng, 0) / merged.length;
			clusters.push({
				lat: avgLat,
				lng: avgLng,
				lapakCount: merged.length,
				items: merged.flatMap((m) => m.items)
			});
		}

		return clusters;
	}

	function createPinIcon(
		leaflet: typeof LeafletNS,
		group: MapProductItem[],
		isSelected: boolean,
		lapakCount = 1
	): LeafletNS.DivIcon {
		const primary = group[0];
		const meta = getCategoryMeta(primary.kategori);
		const isMulti = lapakCount > 1 || group.length > 1;
		const minHarga = isMulti ? Math.min(...group.map((p) => p.harga)) : primary.harga;
		const label =
			lapakCount > 1
				? `${lapakCount} lapak · Mulai ${escapeHtml(formatShortPrice(minHarga))}`
				: group.length > 1
					? `${group.length} panen · Mulai ${escapeHtml(formatShortPrice(minHarga))}`
					: escapeHtml(formatShortPrice(primary.harga));
		const borderColor = isSelected
			? 'var(--color-highlight)'
			: isMulti
				? 'var(--color-accent)'
				: meta.color;
		const iconHtml = categorySvg(
			isMulti ? 'lainnya' : primary.kategori,
			13,
			isSelected ? 'var(--color-accent-ink)' : isMulti ? 'var(--color-accent)' : meta.color
		);			const pinAria = escapeHtml(
				lapakCount > 1
					? `Perbesar ${lapakCount} lapak di titik ini`
					: `Buka ${primary.nama_produk} dari ${primary.penjual_nama}`
			);

			return leaflet.divIcon({
				className: 'petaniaga-map-pin',
				html: `<div role="button" tabindex="0" aria-label="${pinAria}" style="display:inline-flex;align-items:center;gap:4px;min-height:44px;padding:0 12px;border-radius:9999px;background:${isSelected ? 'var(--color-accent)' : 'var(--color-paper-2)'};color:${isSelected ? 'var(--color-accent-ink)' : 'var(--color-ink)'};border:2px solid ${borderColor};box-shadow:var(--shadow-pin);font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer;transform:translate(-50%,-50%);">${iconHtml}<span>${label}</span></div>`,
				iconSize: [0, 0],
				iconAnchor: [0, 0],
				popupAnchor: [0, -24]
			});
	}

	function buildGroupPopupHtml(group: MapProductItem[], origin: GeoPoint | null): string {
		if (group.length === 1) {
			return buildPopupHtml(group[0], origin);
		}

		const first = group[0];
		const lapakStatus = getLapakStatus(first.is_open, first.jam_buka, first.jam_tutup, first.lng);
		const lapakHtml = !lapakStatus.open
			? `<span style="display:inline-block;padding:2px 7px;border-radius:9999px;background:var(--color-paper-3);color:var(--color-muted);font-size:11px;font-weight:600;">${escapeHtml(lapakStatus.label)}</span>`
			: lapakStatus.schedule
				? `<span style="display:inline-block;padding:2px 7px;border-radius:9999px;background:var(--color-bubble);color:var(--color-bubble-ink);font-size:11px;font-weight:600;">Buka ${escapeHtml(lapakStatus.schedule)}</span>`
				: '';
		const distanceHtml = origin
			? `<span style="display:inline-block;padding:2px 7px;border-radius:9999px;background:var(--color-info-bg);color:var(--color-info-ink);font-size:11px;font-weight:600;">${escapeHtml(formatDistanceKm(origin.lat, origin.lng, first.lat, first.lng))}</span>`
			: '';
		const mapsUrl = escapeHtml(
			`https://www.google.com/maps/search/?api=1&query=${first.lat},${first.lng}`
		);

		const rowsHtml = group
			.map((item) => {
				const fotoUrl = escapeHtml(safeUrl(item.foto_url));
				const namaProduk = escapeHtml(item.nama_produk);
				const harga = escapeHtml(formatRupiah(item.harga));
				const satuan = escapeHtml(item.satuan);
				const waUrl = escapeHtml(
					buildWhatsAppOrderUrl({
						noWa: item.no_wa,
						namaPenjual: item.penjual_nama,
						namaProduk: item.nama_produk,
						harga: item.harga,
						satuan: item.satuan
					})
				);
				return `
					<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid var(--color-rule);">
						<img src="${fotoUrl}" alt="${namaProduk}" loading="lazy" style="width:40px;height:40px;border-radius:9999px;object-fit:cover;flex-shrink:0;background:var(--color-paper-3);" />
						<div style="min-width:0;flex:1;">
							<div style="font-size:12px;font-weight:700;color:var(--color-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${namaProduk}</div>
							<div style="font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--color-accent);">${harga} <span style="font-weight:400;color:var(--color-muted);">/${satuan}</span></div>
							${item.stok_info ? `<div style="margin-top:2px;font-size:11px;line-height:1.35;color:var(--color-ink-2);overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(item.stok_info)}</div>` : ''}
						</div>
						<a href="${waUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;min-height:44px;padding:0 12px;border-radius:9999px;background:var(--color-wa);color:var(--color-wa-ink);font-size:11px;font-weight:600;text-decoration:none;">WA</a>
					</div>
				`;
			})
			.join('');

		return `
			<div style="font-family:inherit;background:var(--color-paper-2);padding:12px;">
				<div style="padding-right:30px;margin-bottom:6px;">
					<div style="font-size:13px;font-weight:700;color:var(--color-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Lapak ${escapeHtml(first.penjual_nama)}</div>
					<div style="font-size:11px;color:var(--color-muted);">${group.length} hasil panen</div>
				</div>
				<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-bottom:8px;">
					${lapakHtml}
					${distanceHtml}
					<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;margin-left:auto;flex-shrink:0;min-height:44px;padding:0 12px;border:1px solid var(--color-rule-strong);border-radius:9999px;background:var(--color-paper-2);color:var(--color-ink);font-size:11px;font-weight:600;text-decoration:none;">Rute</a>
				</div>
				<div onwheel="event.stopPropagation()" style="max-height:185px;overflow-y:auto;overscroll-behavior:contain;">${rowsHtml}</div>
			</div>
		`;
	}

	function buildPopupHtml(item: MapProductItem, origin: GeoPoint | null): string {
		const meta = getCategoryMeta(item.kategori);
		const fotoUrl = escapeHtml(safeUrl(item.foto_url));
		const namaProduk = escapeHtml(item.nama_produk);
		const namaPenjual = escapeHtml(item.penjual_nama);
		const harga = escapeHtml(formatRupiah(item.harga));
		const satuan = escapeHtml(item.satuan);
		const expiry = escapeHtml(formatRemainingDays(item.expired_at));
		const waUrl = escapeHtml(
			buildWhatsAppOrderUrl({
				noWa: item.no_wa,
				namaPenjual: item.penjual_nama,
				namaProduk: item.nama_produk,
				harga: item.harga,
				satuan: item.satuan
			})
		);
		const mapsUrl = escapeHtml(
			`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`
		);
		const distanceHtml = origin
			? `<span style="display:inline-block;padding:2px 7px;border-radius:9999px;background:var(--color-info-bg);color:var(--color-info-ink);font-size:11px;font-weight:600;">${escapeHtml(formatDistanceKm(origin.lat, origin.lng, item.lat, item.lng))}</span>`
			: '';
		const lapakStatus = getLapakStatus(item.is_open, item.jam_buka, item.jam_tutup, item.lng);
		const lapakHtml = !lapakStatus.open
			? `<span style="display:inline-block;padding:2px 7px;border-radius:9999px;background:var(--color-paper-3);color:var(--color-muted);font-size:11px;font-weight:600;">${escapeHtml(lapakStatus.label)}${lapakStatus.schedule ? ` (${escapeHtml(lapakStatus.schedule)})` : ''}</span>`
			: lapakStatus.schedule
				? `<span style="display:inline-block;padding:2px 7px;border-radius:9999px;background:var(--color-bubble);color:var(--color-bubble-ink);font-size:11px;font-weight:600;">Buka ${escapeHtml(lapakStatus.schedule)}</span>`
				: '';
		const stokHtml = item.stok_info
			? `<p style="margin:4px 0 0;font-size:11px;line-height:1.35;color:var(--color-ink-2);overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(item.stok_info)}</p>`
			: '';

		return `
			<div style="font-family:inherit;background:var(--color-paper-2);max-height:290px;overflow-y:auto;">
				<img src="${fotoUrl}" alt="${namaProduk}" loading="lazy" style="width:100%;height:108px;object-fit:cover;display:block;background:var(--color-paper-3);" />
				<div style="padding:10px 12px 12px;">
					<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-bottom:4px;">
						<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;background:var(--color-paper-3);color:var(--color-ink-2);font-size:11px;font-weight:600;">${categorySvg(item.kategori, 12, 'var(--color-accent)')}<span>${escapeHtml(meta.label)}</span></span>
						${distanceHtml}
						${lapakHtml}
					</div>
					<h3 style="margin:0;font-size:14px;font-weight:700;line-height:1.25;color:var(--color-ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${namaProduk}</h3>
					<p style="margin:3px 0 0;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--color-accent);">${harga} <span style="font-size:12px;font-weight:400;color:var(--color-muted);">/ ${satuan}</span></p>
					${stokHtml}
					<div style="margin:5px 0 8px;display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--color-muted);">
						<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Penjual: ${namaPenjual}</span>
						<span style="flex-shrink:0;font-variant-numeric:tabular-nums;">${expiry}</span>
					</div>
					<div style="display:flex;gap:6px;align-items:center;">
						<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;min-height:44px;padding:0 14px;border:1px solid var(--color-rule-strong);border-radius:var(--radius-control);background:var(--color-paper-2);color:var(--color-ink);font-size:12px;font-weight:600;text-decoration:none;">Rute</a>
						<a href="${waUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;flex:1 1 auto;min-height:44px;padding:0 14px;border-radius:var(--radius-control);background:var(--color-wa);color:var(--color-wa-ink);font-size:12px;font-weight:600;text-decoration:none;">Pesan WhatsApp</a>
					</div>
				</div>
			</div>
		`;
	}

	function emitBounds() {
		if (!map || !onBoundsChange) return;
		const b = map.getBounds();
		onBoundsChange(
			{
				north: Math.min(90, b.getNorth()),
				south: Math.max(-90, b.getSouth()),
				east: Math.min(180, b.getEast()),
				west: Math.max(-180, b.getWest())
			},
			map.getZoom()
		);
	}

	onMount(async () => {
		if (!mapContainer) return;
		await import('leaflet/dist/leaflet.css');
		const leafletModule = await import('leaflet');
		const leaflet = (leafletModule.default ?? leafletModule) as typeof LeafletNS;
		L = leaflet;

		const instance = leaflet.map(mapContainer, {
			center: [center.lat, center.lng],
			zoom,
			zoomControl: true
		});

		leaflet
			.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				updateWhenIdle: true,
				updateWhenZooming: false,
				keepBuffer: 1,
				attribution: '&copy; OpenStreetMap'
			})
			.addTo(instance);

		markersLayer = leaflet.layerGroup().addTo(instance);
		userLayer = leaflet.layerGroup().addTo(instance);
		map = instance;

		instance.on('moveend', () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(emitBounds, 280);
		});
		instance.on('zoomend', () => {
			rebuildMarkers();
		});

		resizeObserver = new ResizeObserver(() => instance.invalidateSize({ animate: false }));
		resizeObserver.observe(mapContainer);

		emitBounds();
	});

	function rebuildMarkers() {
		if (!L || !map || !markersLayer) return;
		const leaflet = L;
		const leafletMap = map;
		const currentLocation = userLocation;
		const activeId = untrack(() => selectedProductId);
		const hadPopupOpen = untrack(() =>
			activeId ? (markerById.get(activeId)?.isPopupOpen() ?? false) : false
		);

		isRebuildingMarkers = true;
		markersLayer.clearLayers();
		markerById.clear();
		groupById.clear();

		for (const cluster of clusterProducts(leafletMap, products)) {
			const group = cluster.items;
			const primary = group[0];
			const isGroupSelected = activeId ? group.some((p) => p.id === activeId) : false;
			const marker = leaflet.marker([cluster.lat, cluster.lng], {
				icon: createPinIcon(leaflet, group, isGroupSelected, cluster.lapakCount),
				// Keyboard ditangani tombol di dalam pin (44px), supaya tidak ada tab stop
				// kedua pada elemen root Leaflet yang berukuran 0x0.
				keyboard: false
			});

			if (cluster.lapakCount > 1) {
				marker.on('click', () => {
					const bounds = leaflet.latLngBounds(group.map((p) => [p.lat, p.lng] as [number, number]));
					leafletMap.fitBounds(bounds, {
						padding: [56, 56],
						maxZoom: Math.min(leafletMap.getZoom() + 3, 15),
						animate: true
					});
				});
			} else {
				const popup = leaflet.popup({
					className: 'petaniaga-popup',
					minWidth: 236,
					maxWidth: 268,
					autoPanPaddingTopLeft: [16, 16],
					autoPanPaddingBottomRight: [16, 16]
				});
				popup.setContent(buildGroupPopupHtml(group, currentLocation));
				marker.bindPopup(popup);

				marker.on('click', () => {
					onSelectProduct?.(primary);
				});
				// Popup adalah panel isi (link WA & peta): saat dibuka lewat keyboard,
				// pindahkan fokus ke panelnya lalu kembalikan ke pin ketika ditutup.
				marker.on('popupopen', () => {
					if (!focusPopupOnOpen) return;
					focusPopupOnOpen = false;
					const wrapper = marker
						.getPopup()
						?.getElement()
						?.querySelector<HTMLElement>('.leaflet-popup-content-wrapper');
					if (!wrapper) return;
					wrapper.tabIndex = -1;
					wrapper.setAttribute('aria-label', 'Detail hasil panen');
					wrapper.setAttribute('role', 'dialog');
					wrapper.focus({ preventScroll: true });
					wrapper.addEventListener('keydown', (event: KeyboardEvent) => {
						if (event.key === 'Escape') {
							event.preventDefault();
							marker.closePopup();
						}
					});
					restoreFocusOnClose = true;
				});
				marker.on('popupclose', () => {
					if (!restoreFocusOnClose) return;
					restoreFocusOnClose = false;
					// Memilih produk memicu rebuild marker, jadi elemen lama bisa sudah dilepas;
					// cari elemen pin terkini setelah satu frame.
					requestAnimationFrame(() => {
						const target = markerById.get(primary.id) ?? marker;
						const pin = target.getElement()?.firstElementChild as HTMLElement | null;
						pin?.focus({ preventScroll: true });
					});
				});
				marker.on('popupclose', () => {
					const currentSelected = untrack(() => selectedProductId);
					if (!isRebuildingMarkers && currentSelected && group.some((p) => p.id === currentSelected)) {
						onClosePopup?.();
					}
				});

				for (const item of group) {
					markerById.set(item.id, marker);
					groupById.set(item.id, group);
				}
			}

			marker.addTo(markersLayer);

			const pinEl = marker.getElement();
			const pinBtn = pinEl?.firstElementChild as HTMLElement | null;
			if (pinBtn) {
				pinBtn.addEventListener('keydown', (event: KeyboardEvent) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						focusPopupOnOpen = Boolean(marker.getPopup());
						marker.fire('click');
					}
				});
			}
		}

		const target = activeId ? markerById.get(activeId) : undefined;
		const targetPopup = target?.getPopup();
		if (target && targetPopup) {
			if (hadPopupOpen) {
				targetPopup.options.autoPan = false;
				target.openPopup();
				targetPopup.options.autoPan = true;
			} else {
				target.openPopup();
			}
			lastHighlightedId = activeId;
		} else {
			lastHighlightedId = null;
		}

		isRebuildingMarkers = false;
	}

	$effect(() => {
		if (!map || !center) return;
		const key = `${center.lat.toFixed(5)},${center.lng.toFixed(5)},${zoom}`;
		if (key !== lastCenteredPoint) {
			lastCenteredPoint = key;
			map.setView([center.lat, center.lng], zoom, { animate: true });
		}
	});

	$effect(() => {
		void products;
		void userLocation;
		rebuildMarkers();
	});

	$effect(() => {
		if (!L || !markersLayer) return;
		const leaflet = L;

		if (lastHighlightedId && lastHighlightedId !== selectedProductId) {
			const prevMarker = markerById.get(lastHighlightedId);
			const prevGroup = groupById.get(lastHighlightedId);
			const nextMarker = selectedProductId ? markerById.get(selectedProductId) : undefined;
			if (prevMarker && prevGroup && prevMarker !== nextMarker) {
				prevMarker.setIcon(createPinIcon(leaflet, prevGroup, false));
				if (prevMarker.isPopupOpen()) {
					prevMarker.closePopup();
				}
			}
		}

		if (selectedProductId) {
			const nextMarker = markerById.get(selectedProductId);
			const nextGroup = groupById.get(selectedProductId);
			if (nextMarker && nextGroup) {
				if (lastHighlightedId !== selectedProductId) {
					nextMarker.setIcon(createPinIcon(leaflet, nextGroup, true));
				}
				if (!nextMarker.isPopupOpen()) {
					nextMarker.openPopup();
				}
			}
		}

		lastHighlightedId = selectedProductId;
	});

	$effect(() => {
		if (!L || !userLayer) return;
		userLayer.clearLayers();
		if (!userLocation) return;

		L.circleMarker([userLocation.lat, userLocation.lng], {
			radius: 9,
			color: tokenColor('--color-paper-2'),
			weight: 3,
			fillColor: tokenColor('--color-info-ink'),
			fillOpacity: 1
		})
			.bindTooltip('Lokasi Anda', { direction: 'top' })
			.addTo(userLayer);
	});

	onDestroy(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
		resizeObserver?.disconnect();
		resizeObserver = null;
		markerById.clear();
		groupById.clear();
		map?.remove();
	});
</script>

<div class={`relative isolate h-full w-full overflow-hidden bg-paper-3 ${containerClass}`}>
	<div
		bind:this={mapContainer}
		role="region"
		aria-label="Peta hasil panen di sekitar Anda"
		class="h-full w-full"
	></div>
</div>
