<script lang="ts">
	import { onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import LocationPicker from '#modules/geo/components/LocationPicker.svelte';
	import Alert from '#shared/components/Alert.svelte';
	import Button from '#shared/components/Button.svelte';
	import Field from '#shared/components/Field.svelte';
	import Icon from '#shared/components/Icon.svelte';
	import Input from '#shared/components/Input.svelte';
	import Select from '#shared/components/Select.svelte';
	import type { SelectOption } from '#shared/components/Select.svelte';
	import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from '#shared/constants/harvest.ts';
	import { compressImageToWebP, formatBytesCompact } from '#shared/utils/image.ts';

	interface Props {
		defaultLat: number | null;
		defaultLng: number | null;
		errorMessage?: string | null;
		successMessage?: string | null;
		onLocationChange?: (lng: number) => void;
	}

	let {
		defaultLat,
		defaultLng,
		errorMessage = null,
		successMessage = null,
		onLocationChange
	}: Props = $props();

	let namaProduk = $state('');
	let kategori = $state('sayur');
	let harga = $state('');
	let satuan = $state('kg');
	let stokInfo = $state('');
	let lat = $state<number | null>(null);
	let lng = $state<number | null>(null);

	const categoryOptions = $derived<SelectOption[]>(
		PRODUCT_CATEGORIES.map((cat) => ({ value: cat.value, label: cat.label }))
	);
	const unitOptions = $derived<SelectOption[]>(
		PRODUCT_UNITS.map((unit) => ({ value: unit, label: `/ ${unit}` }))
	);

	let compressedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let fileInputEl = $state<HTMLInputElement | null>(null);
	let compressionNote = $state<string | null>(null);
	let photoError = $state<string | null>(null);
	let compressing = $state(false);
	let submitting = $state(false);
	let locationError = $state<string | null>(null);
	let syncedInitialLocation = false;
	let photoRequestId = 0;

	onDestroy(() => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
	});

	$effect(() => {
		if (!syncedInitialLocation && lat === null && lng === null && defaultLat !== null && defaultLng !== null) {
			syncedInitialLocation = true;
			lat = defaultLat;
			lng = defaultLng;
		}
	});

	$effect(() => {
		if (lng !== null && Number.isFinite(lng)) {
			onLocationChange?.(lng);
		}
	});

	async function handlePhotoChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		const reqId = ++photoRequestId;
		photoError = null;
		compressionNote = null;

		if (!file) {
			compressedFile = null;
			compressing = false;
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = null;
			return;
		}

		compressing = true;
		try {
			const result = await compressImageToWebP(file);
			if (reqId !== photoRequestId) return;

			compressedFile = result.file;
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = URL.createObjectURL(result.file);
			compressionNote = `Foto siap unggah: ${formatBytesCompact(result.originalSize)} → ${formatBytesCompact(result.compressedSize)} (${result.width}×${result.height}px)`;
		} catch (err) {
			if (reqId !== photoRequestId) return;

			compressedFile = null;
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = null;
			if (fileInputEl) fileInputEl.value = '';
			photoError =
				err instanceof Error ? err.message : 'Gagal memproses foto. Pilih foto lain.';
		} finally {
			if (reqId === photoRequestId) {
				compressing = false;
			}
		}
	}

	function resetForm() {
		++photoRequestId;
		namaProduk = '';
		harga = '';
		stokInfo = '';
		compressedFile = null;
		compressing = false;
		compressionNote = null;
		photoError = null;
		locationError = null;
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = null;
		if (fileInputEl) fileInputEl.value = '';
	}
</script>

<form
	method="POST"
	action="?/createProduct"
	enctype="multipart/form-data"
	use:enhance={({ formData, cancel }) => {
		photoError = null;
		locationError = null;

		if (compressing) {
			photoError = 'Sedang memproses foto, tunggu sebentar lalu kirim ulang.';
			cancel();
			return;
		}

		if (!compressedFile) {
			photoError = 'Pilih foto hasil panen terlebih dahulu.';
			cancel();
			return;
		}

		if (lat === null || lng === null) {
			locationError = 'Ambil lokasi GPS atau ketuk peta untuk menandai lokasi panen.';
			cancel();
			return;
		}

		formData.set('foto', compressedFile);
		submitting = true;

		return async ({ result, update }) => {
			submitting = false;
			if (result.type === 'success') {
				resetForm();
			}
			await update();
		};
	}}
	class="space-y-5 rounded-[var(--radius-card)] border border-rule bg-paper-2 p-5 shadow-[var(--shadow-card)]"
>
	<div>
		<h2 class="text-xl font-bold text-ink">Jual Hasil Panen Baru</h2>
		<p class="mt-1 text-sm text-ink-2">
			Foto otomatis diperkecil (~50–80 KB) agar tetap cepat diunggah dari kebun. Produk tampil aktif selama 14 hari.
		</p>
	</div>

	{#if errorMessage}
		<Alert tone="error" title="Gagal Mengunggah Produk">
			{errorMessage}
		</Alert>
	{/if}

	{#if successMessage}
		<Alert tone="success" title="Berhasil Tayang di Peta!">
			{successMessage}
		</Alert>
	{/if}

	<div class="space-y-2">
		<label for="foto_raw" class="block text-sm font-semibold text-ink">
			1. Foto Hasil Panen
		</label>
		<label
			for="foto_raw"
			class="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-control)] border border-dashed border-rule-strong bg-paper-3 p-4 text-center transition-colors hover:bg-paper-2"
		>
			{#if previewUrl}
				<img
					src={previewUrl}
					alt="Preview hasil panen"
					class="mb-2 max-h-48 rounded-[var(--radius-control)] object-contain shadow-[var(--shadow-card)]"
				/>
				<span class="text-sm font-semibold text-ink">Ketuk untuk ganti foto</span>
			{:else}
				<Icon name="camera" class="h-8 w-8 text-accent" />
				<span class="mt-1.5 text-base font-semibold text-accent">
					Ambil Foto / Pilih dari Galeri
				</span>
				<span class="mt-0.5 text-xs text-muted">
					Otomatis dikompres ke format WebP hemat kuota
				</span>
			{/if}
		</label>
		<input
			bind:this={fileInputEl}
			id="foto_raw"
			type="file"
			accept="image/*"
			onchange={handlePhotoChange}
			class="sr-only"
		/>
		{#if compressing}
			<p class="text-sm font-semibold text-warn-ink">Sedang mengecilkan ukuran foto…</p>
		{/if}
		{#if compressionNote}
			<p class="text-sm font-semibold text-accent">{compressionNote}</p>
		{/if}
		{#if photoError}
			<p class="text-sm font-semibold text-error-ink">{photoError}</p>
		{/if}
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<Field id="nama_produk" label="2. Nama Hasil Panen" class="sm:col-span-2">
			<Input
				id="nama_produk"
				name="nama_produk"
				type="text"
				required
				maxlength={80}
				bind:value={namaProduk}
				placeholder="Contoh: Beras Pandan Wangi / Cabai Rawit Merah"
			/>
		</Field>

		<Field id="kategori" label="3. Kategori">
			<Select id="kategori" name="kategori" bind:value={kategori} options={categoryOptions} />
		</Field>

		<div class="grid grid-cols-5 gap-2">
			<Field id="harga" label="4. Harga (Rp)" hint="Isi angka saja, contoh 12000" class="col-span-3">
				<Input
					id="harga"
					name="harga"
					type="number"
					inputmode="numeric"
					min="100"
					step="100"
					required
					bind:value={harga}
					placeholder="12000"
				/>
			</Field>
			<Field id="satuan" label="Satuan" class="col-span-2">
				<Select id="satuan" name="satuan" bind:value={satuan} options={unitOptions} />
			</Field>
		</div>

		<Field id="stok_info" label="5. Info Stok &amp; Catatan (Opsional)" class="sm:col-span-2">
			<Input
				id="stok_info"
				name="stok_info"
				type="text"
				maxlength={160}
				bind:value={stokInfo}
				placeholder="Contoh: Panen pagi ini, tersedia 40 kg, bisa ambil di kebun"
			/>
		</Field>
	</div>

	<div class="border-t border-rule pt-4">
		<LocationPicker bind:lat bind:lng errorMessage={locationError} />
	</div>

	<Button type="submit" variant="primary" size="lg" fullWidth disabled={compressing || submitting}>
		{#if compressing}
			Memproses Foto…
		{:else if submitting}
			Mengunggah ke Peta…
		{:else}
			Tayangkan Hasil Panen ke Peta
		{/if}
	</Button>
</form>
