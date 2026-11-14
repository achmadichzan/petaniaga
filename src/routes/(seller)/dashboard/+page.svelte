<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import { WaOnboardingForm } from '#modules/auth';
	import { AddProductForm } from '#modules/catalog';
	import Alert from '#shared/components/Alert.svelte';
	import Badge from '#shared/components/Badge.svelte';
	import Button from '#shared/components/Button.svelte';
	import Icon from '#shared/components/Icon.svelte';
	import type { IconName } from '#shared/components/Icon.svelte';
	import Modal from '#shared/components/Modal.svelte';
	import TimeSelect24 from '#shared/components/TimeSelect24.svelte';
	import { getCategoryMeta } from '#shared/constants/harvest.ts';
	import { formatRemainingDays, formatRupiah, formatWaDisplay } from '#shared/utils/format.ts';
	import { getLapakStatus } from '#shared/utils/lapak.ts';

	let { data, form }: PageProps = $props();

	let showWaModal = $state(false);
	let showLogoutModal = $state(false);
	let confirmDeleteId = $state<string | null>(null);
	let deleting = $state(false);
	let pickedLng = $state<number | null>(null);

	const productToDelete = $derived(
		confirmDeleteId ? (data.products.find((p) => p.id === confirmDeleteId) ?? null) : null
	);

	$effect(() => {
		if (form?.action === 'updateWa' && 'message' in form && form.message) {
			showWaModal = false;
		}
	});

	const createError = $derived(
		form?.action === 'createProduct' && 'error' in form ? form.error : null
	);
	const createSuccess = $derived(
		form?.action === 'createProduct' && 'message' in form ? form.message : null
	);
	const manageError = $derived(
		form?.action === 'manageProduct' && 'error' in form ? form.error : null
	);
	const manageSuccess = $derived(
		form?.action === 'manageProduct' && 'message' in form ? form.message : null
	);
	const waError = $derived(
		form?.action === 'updateWa' && 'error' in form ? form.error : null
	);
	const waSuccess = $derived(
		form?.action === 'updateWa' && 'message' in form ? form.message : null
	);
	const lapakError = $derived(
		form?.action === 'updateLapak' && 'error' in form ? form.error : null
	);
	const lapakSuccess = $derived(
		form?.action === 'updateLapak' && 'message' in form ? form.message : null
	);
	const productCount = $derived(data.products.length);
	const activeLng = $derived(pickedLng ?? data.user.default_lng ?? data.products[0]?.lng ?? null);
	const lapakStatus = $derived(
		getLapakStatus(
			data.user.is_open,
			data.user.jam_buka,
			data.user.jam_tutup,
			activeLng
		)
	);
</script>

<div class="flex flex-1 flex-col lg:h-full lg:flex-row lg:overflow-hidden">
	<!-- Left pane: WhatsApp-style settings & add product form -->
	<aside class="flex min-w-0 flex-col bg-paper-2 lg:h-full lg:w-[500px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-rule xl:w-[560px]">
		<div class="space-y-4 border-b border-rule p-5">
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<h1 class="truncate text-xl font-bold text-ink">{data.user.nama}</h1>
					<p class="mt-0.5 text-xs text-muted">
						WhatsApp:
						<strong class="tabular-nums text-accent">
							{data.user.no_wa ? formatWaDisplay(data.user.no_wa) : '-'}
						</strong>
					</p>
				</div>
				<Badge tone={lapakStatus.open ? 'bubble' : 'neutral'} class="shrink-0">{lapakStatus.label}</Badge>
			</div>

			<div class="flex flex-wrap gap-2">
				<form method="POST" action="?/updateLapak" use:enhance>
					<input type="hidden" name="is_open" value={data.user.is_open === 0 ? '1' : '0'} />
					<input type="hidden" name="jam_buka" value={data.user.jam_buka ?? ''} />
					<input type="hidden" name="jam_tutup" value={data.user.jam_tutup ?? ''} />
					<Button
						type="submit"
						variant={data.user.is_open === 0 ? 'primary' : 'secondary'}
						size="md"
						class={data.user.is_open === 0
							? ''
							: 'border-error-border bg-error-bg text-error-ink'}
					>
						{data.user.is_open === 0 ? 'Buka Lapak' : 'Tutup Lapak'}
					</Button>
				</form>
				<Button type="button" variant="secondary" size="md" onclick={() => (showWaModal = true)}>
					Ubah No. WA
				</Button>
				{#if data.isAdmin}
					<Button href="/admin" variant="secondary" size="md">Panel Admin</Button>
				{/if}
				<Button
					type="button"
					variant="danger"
					size="md"
					onclick={() => (showLogoutModal = true)}
				>
					Keluar
				</Button>
			</div>

			<form
				method="POST"
				action="?/updateLapak"
				use:enhance
				class="flex flex-wrap items-end gap-2.5 border-t border-rule pt-3.5"
			>
				<input type="hidden" name="is_open" value={data.user.is_open === 0 ? '0' : '1'} />
				<div class="min-w-[115px] flex-1">
					<label for="jam_buka" class="block text-xs font-semibold text-ink-2">
						Jam Buka ({lapakStatus.tzLabel})
					</label>
					<TimeSelect24 id="jam_buka" name="jam_buka" value={data.user.jam_buka ?? ''} placeholder="06:00" />
				</div>
				<div class="min-w-[115px] flex-1">
					<label for="jam_tutup" class="block text-xs font-semibold text-ink-2">
						Jam Tutup ({lapakStatus.tzLabel})
					</label>
					<TimeSelect24 id="jam_tutup" name="jam_tutup" value={data.user.jam_tutup ?? ''} placeholder="17:00" />
				</div>
				<Button type="submit" variant="secondary" size="md">
					Simpan Jam
				</Button>
				{#if data.user.jam_buka || data.user.jam_tutup}
					<p class="w-full text-xs text-muted">
						Jadwal aktif: {lapakStatus.schedule}. Kosongkan kedua jam untuk buka 24 jam.
					</p>
				{/if}
			</form>
		</div>

		{#if waSuccess || lapakError || lapakSuccess}
			<div class="space-y-2 border-b border-rule p-4">
				{#if waSuccess}
					<Alert tone="success">{waSuccess}</Alert>
				{/if}
				{#if lapakError}
					<Alert tone="error">{lapakError}</Alert>
				{/if}
				{#if lapakSuccess}
					<Alert tone="success">{lapakSuccess}</Alert>
				{/if}
			</div>
		{/if}

		<div class="p-4">
			<AddProductForm
				defaultLat={data.user.default_lat}
				defaultLng={data.user.default_lng}
				errorMessage={createError}
				successMessage={createSuccess}
				onLocationChange={(lng) => (pickedLng = lng)}
			/>
		</div>
	</aside>

	<!-- Right pane: Product grid -->
	<section class="min-w-0 flex-1 bg-paper p-4 sm:p-6 lg:h-full lg:overflow-y-auto">
		<div class="mx-auto max-w-5xl space-y-4">
			<div class="flex items-center justify-between gap-3">
				<h2 class="min-w-0 break-words text-lg font-bold text-ink sm:text-xl">
					Daftar Hasil Panen Saya ({productCount})
				</h2>
				<a href="/" class="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-accent hover:underline">
					Lihat di Peta
				</a>
			</div>

			{#if manageError}
				<Alert tone="error">{manageError}</Alert>
			{/if}
			{#if manageSuccess}
				<Alert tone="success">{manageSuccess}</Alert>
			{/if}

			{#if data.products.length === 0}
				<div class="rounded-[var(--radius-card)] border border-dashed border-rule-strong bg-paper-2 p-8 text-center shadow-[var(--shadow-card)]">
					<p class="text-lg font-bold text-ink">Belum ada produk yang ditayangkan</p>
					<p class="mt-1 text-sm text-ink-2">
						Isi formulir di sebelah kiri untuk mulai menjual hasil panen langsung ke pembeli sekitar.
					</p>
				</div>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{#each data.products as product (product.id)}
						{@const meta = getCategoryMeta(product.kategori)}
						{@const isExpired = product.expired_at <= data.nowUnix}
						{@const isAvailable = product.is_available === 1}
						<article class="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-rule bg-paper-2 shadow-[var(--shadow-card)]">
							<img
								src={product.foto_url}
								alt={product.nama_produk}
								class="h-40 w-full bg-paper-3 object-cover"
							/>

							<div class="flex flex-1 flex-col justify-between p-4">
								<div class="space-y-2">
									<div class="flex flex-wrap items-center gap-1.5">
										<Badge icon={(meta.value as IconName) || 'lainnya'} iconClass="h-3.5 w-3.5 text-accent">
											{meta.label}
										</Badge>

										{#if isExpired}
											<Badge tone="error">Kedaluwarsa</Badge>
										{:else if !isAvailable}
											<Badge>Stok Habis</Badge>
										{:else}
											<Badge tone="bubble">{formatRemainingDays(product.expired_at, data.nowUnix)}</Badge>
										{/if}
									</div>

									<h3 class="line-clamp-2 text-base font-bold text-ink">{product.nama_produk}</h3>

									<p class="text-base font-bold tabular-nums text-accent">
										{formatRupiah(product.harga)}
										<span class="text-xs font-normal text-muted">/ {product.satuan}</span>
									</p>

									{#if product.stok_info}
										<p class="break-words text-xs text-ink-2">{product.stok_info}</p>
									{/if}
								</div>

								<div class="mt-4 space-y-2 border-t border-rule pt-3">
									<form method="POST" action="?/toggleAvailability" use:enhance>
										<input type="hidden" name="product_id" value={product.id} />
										<input type="hidden" name="next_available" value={isAvailable ? '0' : '1'} />
										<Button
											type="submit"
											variant={isAvailable ? 'secondary' : 'primary'}
											size="md"
											fullWidth
										>
											{isAvailable ? 'Tandai Stok Habis' : 'Aktifkan Lagi'}
										</Button>
									</form>

									<div class="flex gap-2">
										<form method="POST" action="?/renewProduct" use:enhance class="flex-1">
											<input type="hidden" name="product_id" value={product.id} />
											<Button type="submit" variant="secondary" size="md" fullWidth>
												+14 Hari
											</Button>
										</form>

										<Button
											type="button"
											variant="danger"
											size="md"
											onclick={() => (confirmDeleteId = product.id)}
										>
											Hapus
										</Button>
									</div>
								</div>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</div>
	</section>
</div>

<Modal open={showLogoutModal} title="Keluar dari Akun?" onClose={() => (showLogoutModal = false)}>
	<div class="space-y-4">
		<p class="text-sm text-ink-2">
			Anda harus masuk kembali untuk mengelola lapak dan hasil panen Anda.
		</p>
		<div class="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
			<Button
				type="button"
				variant="secondary"
				size="lg"
				onclick={() => (showLogoutModal = false)}
			>
				Batal
			</Button>
			<form method="POST" action="/auth/logout">
				<Button type="submit" variant="danger" size="lg" fullWidth>
					Ya, Keluar
				</Button>
			</form>
		</div>
	</div>
</Modal>

<Modal open={showWaModal} title="Ubah Nomor WhatsApp" onClose={() => (showWaModal = false)}>
	<WaOnboardingForm
		sellerName={data.user.nama}
		initialWa={data.user.no_wa}
		errorMessage={waError}
		action="?/updateWa"
		submitLabel="Simpan Perubahan Nomor WA"
	/>
</Modal>

<Modal
	open={Boolean(productToDelete)}
	title="Hapus Hasil Panen?"
	onClose={() => {
		if (!deleting) confirmDeleteId = null;
	}}
>
	{#if productToDelete}
		{@const deleteMeta = getCategoryMeta(productToDelete.kategori)}
		<div class="space-y-4">
			<div class="flex gap-3.5 rounded-[var(--radius-control)] border border-rule bg-paper-3 p-3">
				<img
					src={productToDelete.foto_url}
					alt={productToDelete.nama_produk}
					class="h-20 w-24 shrink-0 rounded-[var(--radius-control)] bg-rule object-cover"
				/>
				<div class="min-w-0 flex-1 space-y-1">
					<Badge icon={(deleteMeta.value as IconName) || 'lainnya'} iconClass="h-3.5 w-3.5 text-accent">
						{deleteMeta.label}
					</Badge>
					<h3 class="text-base font-bold text-ink">
						{productToDelete.nama_produk}
					</h3>
					<p class="text-base font-bold tabular-nums text-accent">
						{formatRupiah(productToDelete.harga)}
						<span class="text-xs font-semibold text-muted">/ {productToDelete.satuan}</span>
					</p>
					{#if productToDelete.stok_info}
						<p class="text-xs text-ink-2">{productToDelete.stok_info}</p>
					{/if}
				</div>
			</div>

			<p class="text-sm text-ink-2">
				Produk beserta fotonya akan dihapus permanen dari peta pembeli dan tidak dapat dikembalikan.
			</p>

			<div class="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
				<Button
					type="button"
					variant="secondary"
					size="lg"
					disabled={deleting}
					onclick={() => (confirmDeleteId = null)}
				>
					Batal
				</Button>
				<form
					method="POST"
					action="?/deleteProduct"
					use:enhance={() => {
						deleting = true;
						return async ({ update }) => {
							await update();
							deleting = false;
							confirmDeleteId = null;
						};
					}}
				>
					<input type="hidden" name="product_id" value={productToDelete.id} />
					<Button type="submit" variant="danger" size="lg" fullWidth disabled={deleting}>
						{deleting ? 'Menghapus...' : 'Hapus'}
					</Button>
				</form>
			</div>
		</div>
	{/if}
</Modal>
