<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type * as LeafletNS from 'leaflet';
	import Button from '#shared/components/Button.svelte';
	import Icon from '#shared/components/Icon.svelte';

	interface Props {
		lat: number | null;
		lng: number | null;
		errorMessage?: string | null;
	}

	let { lat = $bindable(null), lng = $bindable(null), errorMessage = null }: Props = $props();

	let mapEl = $state<HTMLDivElement | null>(null);
	let L = $state<typeof LeafletNS | null>(null);
	let map = $state<LeafletNS.Map | null>(null);
	let marker = $state<LeafletNS.Marker | null>(null);
	let gpsLoading = $state(false);
	let gpsFeedback = $state<string | null>(null);

	function updateCoordinates(nextLat: number, nextLng: number, zoomLevel?: number) {
		const roundedLat = Number(nextLat.toFixed(6));
		const roundedLng = Number(nextLng.toFixed(6));
		lat = roundedLat;
		lng = roundedLng;

		if (map && L) {
			if (!marker) {
				// Wadah 44px supaya pin punya target sentuh dan cincin fokus yang terlihat;
				// bulatan 28px tetap jadi tampilan visualnya.
				const pinIcon = L.divIcon({
					className: 'petaniaga-picker-pin',
					html: `<div style="display:flex;width:44px;height:44px;align-items:center;justify-content:center;"><div style="width:28px;height:28px;border-radius:9999px;background:var(--color-accent);border:4px solid var(--color-paper-2);box-shadow:var(--shadow-pin);"></div></div>`,
					iconSize: [44, 44],
					iconAnchor: [22, 22]
				});
				const created = L.marker([roundedLat, roundedLng], {
					draggable: true,
					icon: pinIcon
				}).addTo(map);
				// Marker Leaflet fokusabel (panah menggeser pin), jadi beri nama yang jelas.
				created
					.getElement()
					?.setAttribute(
						'aria-label',
						'Titik lokasi lapak. Geser dengan tombol panah atau tarik dengan mouse, atau ketuk peta untuk memilih titik lain.'
					);
				created.on('dragend', () => {
					const pos = created.getLatLng();
					lat = Number(pos.lat.toFixed(6));
					lng = Number(pos.lng.toFixed(6));
				});
				marker = created;
			} else {
				marker.setLatLng([roundedLat, roundedLng]);
			}
			map.setView([roundedLat, roundedLng], zoomLevel ?? Math.max(map.getZoom(), 14), {
				animate: true
			});
		}
	}

	function detectCurrentGps() {
		if (!navigator.geolocation) {
			gpsFeedback = 'Browser Anda tidak mendukung fitur GPS. Silakan ketuk peta untuk menandai lokasi.';
			return;
		}

		gpsLoading = true;
		gpsFeedback = null;

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				gpsLoading = false;
				updateCoordinates(pos.coords.latitude, pos.coords.longitude, 15);
				gpsFeedback = 'Titik GPS berhasil diambil! Anda dapat menggeser pin jika perlu penyesuaian.';
			},
			(err) => {
				gpsLoading = false;
				if (err.code === err.PERMISSION_DENIED) {
					gpsFeedback =
						'Izin lokasi ditolak. Aktifkan GPS browser atau ketuk langsung titik lokasi kebun Anda di peta.';
				} else if (err.code === err.TIMEOUT) {
					gpsFeedback = 'Waktu pencarian GPS habis. Coba lagi atau ketuk titik lokasi Anda di peta.';
				} else {
					gpsFeedback = 'Gagal mengambil sinyal GPS. Ketuk lokasi Anda secara manual di peta.';
				}
			},
			{
				enableHighAccuracy: true,
				timeout: 12000,
				maximumAge: 60000
			}
		);
	}

	onMount(async () => {
		if (!mapEl) return;
		await import('leaflet/dist/leaflet.css');
		const leafletModule = await import('leaflet');
		const leaflet = (leafletModule.default ?? leafletModule) as typeof LeafletNS;
		L = leaflet;

		const hasInitial = lat !== null && lng !== null;
		const startLat = hasInitial && lat !== null ? lat : -7.25;
		const startLng = hasInitial && lng !== null ? lng : 109.75;
		const startZoom = hasInitial ? 14 : 6;

		const instance = leaflet.map(mapEl, {
			center: [startLat, startLng],
			zoom: startZoom
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

		instance.on('click', (event: LeafletNS.LeafletMouseEvent) => {
			updateCoordinates(event.latlng.lat, event.latlng.lng);
			gpsFeedback = 'Pin lokasi diperbarui sesuai titik yang Anda pilih.';
		});

		map = instance;

		if (hasInitial && lat !== null && lng !== null) {
			updateCoordinates(lat, lng, 14);
		}
	});

	onDestroy(() => {
		map?.remove();
	});
</script>

<div class="space-y-3">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<span class="block text-sm font-semibold text-ink">
			Lokasi Kebun / Lapak Panen
		</span>
		<Button type="button" variant="secondary" size="md" onclick={detectCurrentGps} disabled={gpsLoading}>
			<Icon name="pin" class="h-4 w-4 text-accent" />
			{gpsLoading ? 'Mencari Titik GPS…' : 'Ambil Lokasi Saya'}
		</Button>
	</div>

	<div class="h-56 w-full overflow-hidden rounded-[var(--radius-control)] border border-rule-strong bg-paper-3">
		<div bind:this={mapEl} role="region" aria-label="Peta pilih lokasi lapak" class="h-full w-full"></div>
	</div>

	<input type="hidden" name="lat" value={lat ?? ''} />
	<input type="hidden" name="lng" value={lng ?? ''} />

	{#if gpsFeedback}
		<p class="text-sm text-ink-2">{gpsFeedback}</p>
	{/if}

	{#if errorMessage}
		<p class="text-sm font-semibold text-error-ink">{errorMessage}</p>
	{:else if lat !== null && lng !== null}
		<p class="text-xs text-muted">
			Koordinat tersimpan: <span class="font-semibold tabular-nums">{lat.toFixed(5)}, {lng.toFixed(5)}</span> (ketuk peta atau geser pin hijau untuk menyesuaikan).
		</p>
	{:else}
		<p class="text-sm text-warn-ink">
			Tekan tombol <strong>Ambil Lokasi Saya</strong> atau ketuk langsung lokasi Anda pada peta di atas.
		</p>
	{/if}
</div>

