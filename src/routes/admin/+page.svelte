<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	import Alert from '#shared/components/Alert.svelte';
	import Badge from '#shared/components/Badge.svelte';
	import Button from '#shared/components/Button.svelte';
	import Card from '#shared/components/Card.svelte';
	import { formatWaDisplay } from '#shared/utils/format.ts';

	let { data, form }: PageProps = $props();

	const errorMessage = $derived(form && 'error' in form ? form.error : null);
	const successMessage = $derived(form && 'message' in form ? form.message : null);
	const bannedCount = $derived(data.groups.filter((group) => group.isBanned).length);
	const totalReports = $derived(
		data.groups.reduce(
			(total, group) =>
				total + group.products.reduce((sum, product) => sum + product.reportCount, 0),
			0
		)
	);
</script>

<svelte:head>
	<title>Panel Admin — Petaniaga</title>
</svelte:head>

<div class="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
	<header class="space-y-2">
		<div class="flex flex-wrap items-center gap-2">
			<h1 class="text-2xl font-bold tracking-tight text-ink">Panel Admin</h1>
			<Badge tone="error">{bannedCount} akun diblokir</Badge>
			<Badge tone="neutral">{totalReports} laporan</Badge>
		</div>
		<p class="text-sm leading-relaxed text-ink-2">
			Tinjau laporan foto produk dari pembeli. Membuka blokir akan mengaktifkan kembali akun
			penjual, mereset peringatan AI, dan menghapus laporan yang sudah ditinjau.
		</p>
	</header>

	{#if errorMessage}
		<Alert tone="error">{errorMessage}</Alert>
	{/if}
	{#if successMessage}
		<Alert tone="success">{successMessage}</Alert>
	{/if}

	{#if data.groups.length === 0}
		<Card>
			<p class="text-sm text-ink-2">Belum ada laporan foto yang masuk.</p>
		</Card>
	{:else}
		{#each data.groups as group (group.userId)}
			<Card class="space-y-3">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<h2 class="truncate text-base font-bold text-ink">{group.nama}</h2>
						<p class="mt-0.5 text-xs text-muted">
							{group.email}
							{#if group.noWa}
								· WA {formatWaDisplay(group.noWa)}
							{/if}
						</p>
					</div>
					<div class="flex flex-wrap items-center gap-1.5">
						{#if group.isBanned}
							<Badge tone="error">Diblokir</Badge>
						{:else}
							<Badge tone="neutral">Akun aktif</Badge>
						{/if}
						<Badge tone="warn">Peringatan AI {group.strikeCount}/3</Badge>
						<Badge tone="info">{group.reporterCount} pelapor unik</Badge>
					</div>
				</div>

				<ul class="space-y-2">
					{#each group.products as product (product.productId)}
						<li
							class="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-rule bg-paper p-2"
						>
							<a
								href={product.fotoUrl}
								target="_blank"
								rel="noopener noreferrer"
								title="Buka foto ukuran penuh"
								class="block h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-paper-3"
							>
								<img
									src={product.fotoUrl}
									alt={`Foto ${product.namaProduk}`}
									loading="lazy"
									class="h-full w-full object-cover"
								/>
							</a>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-semibold text-ink">{product.namaProduk}</p>
								<p class="text-xs text-muted">
									Laporan terakhir {product.latestReportedLabel} WIB
								</p>
							</div>

							<div class="flex flex-wrap items-center gap-1.5">
								<Badge tone="info">{product.reportCount} laporan</Badge>
								{#if product.isAvailable}
									<Badge tone="bubble">Tayang</Badge>
								{:else}
									<Badge tone="muted">Disembunyikan</Badge>
								{/if}
							</div>

							<div class="flex flex-wrap items-center gap-1.5">
								{#if product.isAvailable}
									<form method="POST" action="?/hideProduct" use:enhance>
										<input type="hidden" name="product_id" value={product.productId} />
										<Button type="submit" variant="secondary" size="sm">
											Sembunyikan
										</Button>
									</form>
								{/if}
								<form
									method="POST"
									action="?/deleteProduct"
									use:enhance
									onsubmit={(event) => {
										if (!confirm(`Hapus permanen produk ${product.namaProduk}?`))
											event.preventDefault();
									}}
								>
									<input type="hidden" name="product_id" value={product.productId} />
									<Button type="submit" variant="danger" size="sm">Hapus</Button>
								</form>
							</div>
						</li>
					{/each}
				</ul>

				{#if group.isBanned}
					<form
						method="POST"
						action="?/unban"
						use:enhance
						onsubmit={(event) => {
							if (!confirm(`Buka blokir akun ${group.nama}?`)) event.preventDefault();
						}}
					>
						<input type="hidden" name="user_id" value={group.userId} />
						<Button type="submit" variant="primary" size="md">Buka Blokir Akun</Button>
					</form>
				{/if}
			</Card>
		{/each}
	{/if}
</div>
