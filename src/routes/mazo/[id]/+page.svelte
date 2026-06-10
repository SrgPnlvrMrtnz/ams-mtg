<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { data } = $props();

	type Deck = {
		id: string;
		name: string;
		format: string | null;
		description: string | null;
		colorIdentity: string;
		commander: string | null;
		cards: string;
	};

	let deck = $state<Deck | null>(null);
	let cartasDatos: Record<string, any> = $state({});
	let cargando = $state(true);
	let busquedaTexto = $state('');
	let resultadosBusqueda: any[] = $state([]);
	let buscando = $state(false);
	let editandoNombre = $state(false);
	let nuevoNombreInput = $state('');
	let cartaSeleccionada = $state<any>(null);

	function verDetalle(carta: any) {
		cartaSeleccionada = carta;
	}
	function cerrarDetalle() {
		cartaSeleccionada = null;
	}

	const cartasEnMazo = $derived<string[]>(deck ? JSON.parse(deck.cards) : []);
	const totalCartas = $derived(cartasEnMazo.length);
	const colores = $derived<string[]>(deck ? JSON.parse(deck.colorIdentity) : []);

	const comandantesDelMazo = $derived.by<string[]>(() => {
		if (!deck?.commander) return [];
		try {
			return JSON.parse(deck.commander);
		} catch {
			return [deck.commander!];
		}
	});

	const cartasAgrupadas = $derived.by(() => {
		const conteo: Record<string, number> = {};
		for (const c of cartasEnMazo) {
			conteo[c] = (conteo[c] || 0) + 1;
		}
		return Object.entries(conteo)
			.map(([nombre, cantidad]) => ({ nombre, cantidad }))
			.sort((a, b) => a.nombre.localeCompare(b.nombre));
	});

	onMount(async () => {
		const res = await fetch(`/api/decks/${data.id}`);
		if (!res.ok) {
			goto('/');
			return;
		}
		deck = await res.json();
		nuevoNombreInput = deck!.name;
		await cargarDatosCartas();
	});

	async function cargarDatosCartas() {
		cargando = true;
		const nombres = [...new Set(cartasEnMazo)];
		const resultados = await Promise.all(
			nombres.map(async (nombre) => {
				try {
					const res = await fetch(
						`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(nombre)}`
					);
					if (res.ok) return [nombre, await res.json()] as [string, any];
				} catch {}
				return [nombre, null] as [string, null];
			})
		);
		cartasDatos = Object.fromEntries(resultados.filter(([, d]) => d !== null));
		cargando = false;
	}

	function getImageUrl(carta: any): string {
		if (carta?.image_uris?.png) return carta.image_uris.png;
		if (carta?.card_faces?.[0]?.image_uris?.png) return carta.card_faces[0].image_uris.png;
		return '';
	}

	async function actualizarCartas(nuevasCartas: string[]) {
		const res = await fetch(`/api/decks/${data.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cards: nuevasCartas })
		});
		if (res.ok) deck = await res.json();
	}

	function agregarCopia(nombreCarta: string) {
		actualizarCartas([...cartasEnMazo, nombreCarta]);
	}

	function quitarCopia(nombreCarta: string) {
		const lista = [...cartasEnMazo];
		const idx = lista.lastIndexOf(nombreCarta);
		if (idx !== -1) lista.splice(idx, 1);
		actualizarCartas(lista);
	}

	async function buscarCartas() {
		if (!busquedaTexto.trim()) return;
		buscando = true;
		resultadosBusqueda = [];
		try {
			const res = await fetch(
				`https://api.scryfall.com/cards/search?q=${encodeURIComponent(busquedaTexto)}`
			);
			const json = await res.json();
			resultadosBusqueda = json.data?.slice(0, 20) || [];
		} catch {}
		buscando = false;
	}

	function agregarDesdeBusqueda(carta: any) {
		actualizarCartas([...cartasEnMazo, carta.name]);
		if (!cartasDatos[carta.name]) cartasDatos = { ...cartasDatos, [carta.name]: carta };
	}

	async function eliminarMazo() {
		if (!confirm(`¿Eliminar el mazo "${deck?.name}"? Esta acción no se puede deshacer.`)) return;
		await fetch(`/api/decks/${data.id}`, { method: 'DELETE' });
		goto('/');
	}

	async function guardarNombre() {
		const nuevo = nuevoNombreInput.trim();
		if (!nuevo || nuevo === deck?.name) {
			editandoNombre = false;
			return;
		}
		const res = await fetch(`/api/decks/${data.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: nuevo })
		});
		if (res.ok) {
			deck = await res.json();
			editandoNombre = false;
		}
	}

	const COLOR_MAP: Record<string, string> = {
		W: '#c8b47c',
		U: '#2c6fad',
		B: '#888',
		R: '#c93c1c',
		G: '#2e7d4f'
	};

	let exportOpen = $state(false);
	let copiedFormat = $state('');

	let analisisData: {
		distribution: { tag: string; label: string; count: number; percentage: number }[];
		alerts: string[];
		total: number;
	} | null = $state(null);
	let cargandoAnalisis = $state(false);

	async function analizarMazo() {
		cargandoAnalisis = true;
		analisisData = null;
		try {
			const res = await fetch(`/api/decks/${data.id}/analysis`);
			if (res.ok) analisisData = await res.json();
		} finally {
			cargandoAnalisis = false;
		}
	}

	function buildList(fmt: 'plain' | 'moxfield' | 'arena' | 'mtgo'): string {
		const counts: Record<string, number> = {};
		for (const c of cartasEnMazo) counts[c] = (counts[c] || 0) + 1;
		return Object.entries(counts)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([name, qty]) => {
				if (fmt === 'plain') return `${qty}x ${name}`;
				if (fmt === 'moxfield') return `${qty} ${name}`;
				if (fmt === 'arena') return `${qty} ${name}`;
				if (fmt === 'mtgo') return `${qty} ${name}`;
				return `${qty} ${name}`;
			})
			.join('\n');
	}

	async function copyFormat(fmt: 'plain' | 'moxfield' | 'arena' | 'mtgo') {
		await navigator.clipboard.writeText(buildList(fmt));
		copiedFormat = fmt;
		setTimeout(() => {
			copiedFormat = '';
			exportOpen = false;
		}, 1200);
	}
</script>

<svelte:head>
	<title>{deck?.name ?? 'Mazo'} — AMS MTG</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cinzel:wght@600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<header class="deck-header">
	<div class="header-inner">
		<a href="/" class="btn btn-ghost back-btn">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
				<path
					fill-rule="evenodd"
					d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
					clip-rule="evenodd"
				/>
			</svg>
			Colección
		</a>

		<div class="deck-title-area">
			{#if editandoNombre}
				<input
					class="deck-name-input"
					bind:value={nuevoNombreInput}
					onkeydown={(e) => {
						if (e.key === 'Enter') guardarNombre();
						if (e.key === 'Escape') editandoNombre = false;
					}}
				/>
				<button class="btn btn-primary" onclick={guardarNombre}>Guardar</button>
				<button class="btn btn-ghost" onclick={() => (editandoNombre = false)}>Cancelar</button>
			{:else}
				<button
					class="deck-name-btn"
					onclick={() => {
						nuevoNombreInput = deck?.name ?? '';
						editandoNombre = true;
					}}
					title="Haz clic para renombrar"
				>
					<h1 class="deck-name">{deck?.name ?? '...'}</h1>
					<svg
						class="edit-icon"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 16 16"
						fill="currentColor"
					>
						<path
							d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474ZM4.75 13.5c-.69 0-1.25-.56-1.25-1.25v-8.5C3.5 3.06 4.06 2.5 4.75 2.5h3.5a.75.75 0 0 1 0 1.5h-3v7.5h7.5v-3a.75.75 0 0 1 1.5 0v3.25c0 .69-.56 1.25-1.25 1.25h-8Z"
						/>
					</svg>
				</button>
			{/if}
		</div>

		<div class="deck-meta-row">
			{#if deck?.format}
				<span class="meta-chip">{deck.format}</span>
			{/if}
			{#if colores.length > 0}
				<div class="color-dots">
					{#each colores as c}
						<span class="color-dot" style="background:{COLOR_MAP[c] ?? '#666'}" title={c}></span>
					{/each}
				</div>
			{/if}
		</div>

		<span class="card-count-badge">{totalCartas} {totalCartas === 1 ? 'carta' : 'cartas'}</span>

		<div class="export-wrap">
			<button class="btn btn-ghost" onclick={() => (exportOpen = !exportOpen)}>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
					<path
						d="M8.75 2.75a.75.75 0 0 0-1.5 0v5.69L5.03 6.22a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 8.44V2.75Z"
					/>
					<path
						d="M3.5 9.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 14h6.5A2.75 2.75 0 0 0 14 11.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25h-6.5c-.69 0-1.25-.56-1.25-1.25v-1.5Z"
					/>
				</svg>
				Exportar mazo
			</button>
			{#if exportOpen}
				<div class="export-dropdown">
					<div class="export-title">Export options</div>
					{#each [{ key: 'moxfield', label: 'Copy for Moxfield' }, { key: 'arena', label: 'Copy for Arena' }, { key: 'mtgo', label: 'Copy for MTGO' }, { key: 'plain', label: 'Copy plain text' }] as opt}
						<button
							class="export-option"
							class:copied={copiedFormat === opt.key}
							onclick={() => copyFormat(opt.key as any)}
						>
							{#if copiedFormat === opt.key}
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
									<path
										fill-rule="evenodd"
										d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
										clip-rule="evenodd"
									/>
								</svg>
								¡Copiado!
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
									<path
										d="M5.5 3.5A1.5 1.5 0 0 1 7 2h2.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061V9.5A1.5 1.5 0 0 1 12 11H7a1.5 1.5 0 0 1-1.5-1.5v-6Z"
									/>
									<path
										d="M4 4.5a.5.5 0 0 0-.5.5v7a1.5 1.5 0 0 0 1.5 1.5h5a.5.5 0 0 0 0-1H5A.5.5 0 0 1 4.5 12V5a.5.5 0 0 0-.5-.5Z"
									/>
								</svg>
								{opt.label}
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<button class="btn btn-danger" onclick={eliminarMazo}>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
				<path
					fill-rule="evenodd"
					d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.712Z"
					clip-rule="evenodd"
				/>
			</svg>
			Eliminar mazo
		</button>
	</div>

	{#if deck?.commander || deck?.description}
		<div class="deck-subheader">
			{#if deck.commander}
				{@const cmds = (() => {
					try {
						return JSON.parse(deck.commander);
					} catch {
						return [deck.commander];
					}
				})()}
				{#each cmds as cmd}
					<span class="commander-chip">⚔ {cmd}</span>
				{/each}
			{/if}
			{#if deck.description}
				<span class="desc-text">{deck.description}</span>
			{/if}
		</div>
	{/if}
</header>

<main class="deck-layout">
	<section class="cards-section">
		{#if cargando}
			<div class="centered-state">
				<div class="loader-ring"></div>
				<p>Cargando cartas del mazo...</p>
			</div>
		{:else if cartasAgrupadas.length === 0}
			<div class="centered-state">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					class="empty-icon"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-.98.626-1.813 1.5-2.122"
					/>
				</svg>
				<p class="empty-title">Mazo vacío</p>
				<p class="empty-hint">Busca cartas en el panel derecho para añadirlas al mazo.</p>
			</div>
		{:else}
			<div class="card-grid">
				{#each cartasAgrupadas as { nombre, cantidad }}
					{@const carta = cartasDatos[nombre]}
					{@const imgUrl = carta ? getImageUrl(carta) : ''}
					<article class="card-item">
						{#if imgUrl}
							<img
								src={imgUrl}
								alt={nombre}
								loading="lazy"
								onclick={() => carta && verDetalle(carta)}
								style="cursor:pointer;"
							/>
						{:else}
							<div class="card-placeholder"><span>{nombre}</span></div>
						{/if}
						<div class="card-overlay">
							<div class="qty-controls">
								<button
									class="qty-btn qty-minus"
									onclick={() => quitarCopia(nombre)}
									title="Quitar una copia">−</button
								>
								<span class="qty-num">×{cantidad}</span>
								<button
									class="qty-btn qty-plus"
									onclick={() => agregarCopia(nombre)}
									title="Añadir una copia">+</button
								>
							</div>
							{#if carta}
								<div class="card-meta">
									{#if carta.mana_cost}<span class="meta-mana">{carta.mana_cost}</span>{/if}
									<span class="meta-type">{carta.type_line?.split('—')[0]?.trim() || ''}</span>
								</div>
							{/if}
						</div>
						{#if comandantesDelMazo.includes(nombre)}
							<div class="commander-badge">⚔ Comandante</div>
						{:else if cantidad > 1}
							<div class="qty-badge">×{cantidad}</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	{#if cartaSeleccionada}
		{@const img = getImageUrl(cartaSeleccionada)}
		<div
			class="detalle-overlay"
			role="button"
			tabindex="-1"
			onclick={cerrarDetalle}
			onkeydown={(e) => e.key === 'Escape' && cerrarDetalle()}
		>
			<div class="detalle-panel" onclick={(e) => e.stopPropagation()}>
				<button class="detalle-cerrar" onclick={cerrarDetalle} title="Cerrar">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
						<path
							d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"
						/>
					</svg>
				</button>
				<div class="detalle-body">
					{#if img}<img class="detalle-img" src={img} alt={cartaSeleccionada.name} />{/if}
					<div class="detalle-info">
						<h2 class="detalle-nombre">{cartaSeleccionada.name}</h2>
						{#if cartaSeleccionada.mana_cost}<div class="detalle-fila">
								<span class="detalle-label">Coste</span><span class="detalle-valor mana"
									>{cartaSeleccionada.mana_cost}</span
								>
							</div>{/if}
						{#if cartaSeleccionada.type_line}<div class="detalle-fila">
								<span class="detalle-label">Tipo</span><span class="detalle-valor"
									>{cartaSeleccionada.type_line}</span
								>
							</div>{/if}
						{#if cartaSeleccionada.oracle_text}<div class="detalle-fila">
								<span class="detalle-label">Texto</span><span class="detalle-valor oracle"
									>{cartaSeleccionada.oracle_text}</span
								>
							</div>{/if}
						{#if cartaSeleccionada.power}<div class="detalle-fila">
								<span class="detalle-label">F/R</span><span class="detalle-valor"
									>{cartaSeleccionada.power}/{cartaSeleccionada.toughness}</span
								>
							</div>{/if}
						{#if cartaSeleccionada.loyalty}<div class="detalle-fila">
								<span class="detalle-label">Lealtad</span><span class="detalle-valor"
									>{cartaSeleccionada.loyalty}</span
								>
							</div>{/if}
						<div class="detalle-fila">
							<span class="detalle-label">Rareza</span><span
								class="detalle-valor rarity-{cartaSeleccionada.rarity}"
								>{cartaSeleccionada.rarity}</span
							>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<aside class="search-panel">
		<div class="panel-header">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="panel-icon"
			>
				<path
					d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z"
				/>
			</svg>
			<h2>Añadir cartas</h2>
		</div>
		<div class="search-row">
			<input
				type="text"
				bind:value={busquedaTexto}
				placeholder="Buscar carta..."
				onkeydown={(e) => e.key === 'Enter' && buscarCartas()}
			/>
			<button class="btn btn-primary" onclick={buscarCartas}>Buscar</button>
		</div>
		{#if buscando}
			<div class="search-loading"><div class="loader-ring loader-sm"></div></div>
		{:else if resultadosBusqueda.length > 0}
			<ul class="result-list">
				{#each resultadosBusqueda as carta}
					{@const imgUrl = getImageUrl(carta)}
					<li class="result-item">
						{#if imgUrl}<img
								class="result-thumb"
								src={imgUrl}
								alt={carta.name}
								loading="lazy"
							/>{/if}
						<div class="result-info">
							<span class="result-name">{carta.name}</span>
							<span class="result-type">{carta.type_line?.split('—')[0]?.trim() || ''}</span>
						</div>
						<button
							class="btn-add"
							onclick={() => agregarDesdeBusqueda(carta)}
							title="Añadir al mazo">+</button
						>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="analysis-sep"></div>

		<div class="panel-header" style="margin-top:16px;">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="panel-icon"
			>
				<path
					d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9a1.5 1.5 0 0 0 3 0v-9A1.5 1.5 0 0 0 9.5 6ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 3.5 10Z"
				/>
			</svg>
			<h2>Análisis</h2>
		</div>

		<button
			class="btn btn-primary"
			style="width:100%;justify-content:center;margin-bottom:12px;"
			onclick={analizarMazo}
			disabled={cargandoAnalisis || cartasEnMazo.length === 0}
		>
			{cargandoAnalisis ? 'Analizando...' : 'Analizar mazo'}
		</button>

		{#if cargandoAnalisis}
			<div class="search-loading"><div class="loader-ring loader-sm"></div></div>
		{:else if analisisData}
			{#if analisisData.alerts.length === 0}
				<div class="alert-ok">✓ Mazo equilibrado</div>
			{:else}
				<div class="alerts-list">
					{#each analisisData.alerts as alerta (alerta)}
						<div class="alert-item">⚠ {alerta}</div>
					{/each}
				</div>
			{/if}
			<div class="tag-distribution">
				{#each analisisData.distribution.slice(0, 8) as entry (entry.tag)}
					<div class="tag-row">
						<span class="tag-label">{entry.label}</span>
						<div class="tag-bar">
							<div class="tag-fill" style="width:{entry.percentage}%"></div>
						</div>
						<span class="tag-count">{entry.count}</span>
					</div>
				{/each}
			</div>
		{/if}
	</aside>
</main>

<style>
	:global(:root) {
		--bg: #0c0c10;
		--surface: #14141c;
		--surface-2: #1c1c28;
		--border: #2a2a38;
		--border-focus: #6d5acd;
		--text-primary: #f0eff6;
		--text-secondary: #8e8da8;
		--text-muted: #5a596e;
		--accent: #7c5cf6;
		--accent-light: #9b7cff;
		--accent-dim: rgba(124, 92, 246, 0.15);
		--gold: #c9a840;
		--danger: #e0434a;
		--danger-dim: rgba(224, 67, 74, 0.15);
		--green: #3db37a;
		--green-dim: rgba(61, 179, 122, 0.18);
		--radius-sm: 6px;
		--radius: 10px;
		--radius-lg: 16px;
		--shadow-lg: 0 20px 60px rgba(0, 0, 0, 0.8), 0 4px 16px rgba(0, 0, 0, 0.5);
		--shadow-card: 0 8px 32px rgba(0, 0, 0, 0.6);
		--shadow-accent: 0 0 24px rgba(124, 92, 246, 0.25);
		--font: 'Inter', system-ui, sans-serif;
		--font-display: 'Cinzel', serif;
		--glow-accent: 0 0 0 1px rgba(124, 92, 246, 0.4), 0 0 16px rgba(124, 92, 246, 0.15);
	}
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		background: var(--bg);
		background-image:
			radial-gradient(ellipse 80% 50% at 20% -10%, rgba(124, 92, 246, 0.06) 0%, transparent 60%),
			radial-gradient(ellipse 60% 40% at 80% 110%, rgba(201, 168, 64, 0.04) 0%, transparent 50%);
		color: var(--text-primary);
		font-family: var(--font);
		font-size: 14px;
		line-height: 1.5;
		margin: 0;
		-webkit-font-smoothing: antialiased;
	}
	:global(input[type='text']) {
		width: 100%;
		background: var(--surface-2);
		border: 1px solid var(--border);
		color: var(--text-primary);
		padding: 9px 13px;
		border-radius: var(--radius-sm);
		font-family: var(--font);
		font-size: 13px;
		outline: none;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}
	:global(input[type='text']:focus) {
		border-color: var(--border-focus);
		box-shadow: var(--glow-accent);
	}

	/* ── Buttons ── */
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
		font-family: var(--font);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition:
			background 0.18s,
			border-color 0.18s,
			box-shadow 0.18s,
			transform 0.12s;
		white-space: nowrap;
		text-decoration: none;
	}
	.btn:active {
		transform: scale(0.97);
	}
	.btn svg {
		width: 14px;
		height: 14px;
	}
	.btn-primary {
		background: linear-gradient(135deg, var(--accent), #6040d8);
		color: #fff;
		border-color: var(--accent);
		box-shadow: 0 2px 10px rgba(124, 92, 246, 0.35);
	}
	.btn-primary:hover {
		background: linear-gradient(135deg, var(--accent-light), var(--accent));
		box-shadow: 0 4px 18px rgba(124, 92, 246, 0.5);
	}
	.btn-ghost {
		background: transparent;
		color: var(--text-secondary);
		border-color: var(--border);
	}
	.btn-ghost:hover {
		background: var(--surface-2);
		color: var(--text-primary);
		border-color: rgba(124, 92, 246, 0.35);
	}
	.btn-danger {
		background: var(--danger-dim);
		color: var(--danger);
		border-color: rgba(224, 67, 74, 0.35);
	}
	.btn-danger:hover {
		background: var(--danger);
		color: #fff;
		box-shadow: 0 2px 10px rgba(224, 67, 74, 0.35);
	}

	/* ── Header ── */
	.deck-header {
		background: rgba(20, 20, 28, 0.92);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 100;
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
	}
	.header-inner {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 13px 28px;
		max-width: 1600px;
		margin: 0 auto;
	}
	.back-btn {
		flex-shrink: 0;
		font-size: 13px;
	}

	.deck-title-area {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.deck-name-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
		padding: 5px 10px;
		transition:
			border-color 0.18s,
			background 0.18s;
	}
	.deck-name-btn:hover {
		border-color: var(--border);
		background: rgba(255, 255, 255, 0.03);
	}
	.deck-name-btn:hover .edit-icon {
		opacity: 1;
	}
	.deck-name {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: -0.01em;
	}
	.edit-icon {
		width: 13px;
		height: 13px;
		color: var(--text-muted);
		opacity: 0;
		transition: opacity 0.18s;
		flex-shrink: 0;
	}
	.deck-name-input {
		font-size: 16px;
		font-weight: 700;
		max-width: 300px;
	}

	.deck-meta-row {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}
	.meta-chip {
		background: var(--accent-dim);
		color: var(--accent-light);
		font-size: 11px;
		font-weight: 700;
		padding: 3px 10px;
		border-radius: 20px;
		border: 1px solid rgba(124, 92, 246, 0.35);
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}
	.color-dots {
		display: flex;
		gap: 5px;
		align-items: center;
	}
	.color-dot {
		width: 13px;
		height: 13px;
		border-radius: 50%;
		border: 1.5px solid rgba(255, 255, 255, 0.2);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
	}
	.card-count-badge {
		background: var(--accent-dim);
		color: var(--accent-light);
		font-size: 12px;
		font-weight: 700;
		padding: 4px 12px;
		border-radius: 20px;
		border: 1px solid rgba(124, 92, 246, 0.35);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.deck-subheader {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 7px 28px 9px;
		border-top: 1px solid rgba(42, 42, 56, 0.7);
		max-width: 1600px;
		margin: 0 auto;
	}
	.commander-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		font-weight: 600;
		color: var(--gold);
		background: rgba(201, 168, 64, 0.08);
		border: 1px solid rgba(201, 168, 64, 0.25);
		padding: 2px 10px;
		border-radius: 20px;
	}
	.desc-text {
		font-size: 12px;
		color: var(--text-muted);
		font-style: italic;
	}

	/* ── Layout ── */
	.deck-layout {
		display: flex;
		align-items: flex-start;
		max-width: 1600px;
		margin: 0 auto;
		min-height: calc(100vh - 64px);
	}
	.cards-section {
		flex: 1;
		padding: 24px;
		min-width: 0;
	}

	.centered-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 100px 24px;
		gap: 14px;
		color: var(--text-secondary);
	}
	.empty-icon {
		width: 52px;
		height: 52px;
		color: var(--text-muted);
		opacity: 0.6;
	}
	.empty-title {
		font-size: 17px;
		font-weight: 600;
		margin: 0;
		color: var(--text-secondary);
	}
	.empty-hint {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0;
		text-align: center;
		max-width: 260px;
		line-height: 1.7;
	}

	/* ── Card grid ── */
	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
		gap: 16px;
	}
	.card-item {
		position: relative;
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--surface-2);
		border: 1px solid var(--border);
		transition:
			transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1),
			box-shadow 0.22s ease,
			border-color 0.2s;
		cursor: default;
	}
	.card-item::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: var(--radius);
		border: 1px solid transparent;
		transition: border-color 0.2s;
		pointer-events: none;
	}
	.card-item:hover {
		transform: translateY(-6px) scale(1.03);
		box-shadow:
			var(--shadow-card),
			0 0 28px rgba(124, 92, 246, 0.2);
		border-color: var(--border-focus);
		z-index: 10;
	}
	.card-item:hover::after {
		border-color: rgba(124, 92, 246, 0.25);
	}
	.card-item img {
		width: 100%;
		display: block;
	}
	.card-placeholder {
		aspect-ratio: 488/680;
		background: linear-gradient(145deg, var(--surface-2), rgba(42, 42, 56, 0.5));
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12px;
		text-align: center;
		font-size: 12px;
		color: var(--text-muted);
	}

	.card-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 14px 10px 12px;
		background: linear-gradient(
			to top,
			rgba(8, 8, 14, 0.97) 55%,
			rgba(8, 8, 14, 0.6) 80%,
			transparent
		);
		opacity: 0;
		transition: opacity 0.22s;
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: center;
	}
	.card-item:hover .card-overlay {
		opacity: 1;
	}

	.qty-controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.qty-btn {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		font-size: 17px;
		font-weight: 700;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.15s,
			transform 0.12s,
			box-shadow 0.15s;
	}
	.qty-btn:active {
		transform: scale(0.9);
	}
	.qty-minus {
		background: var(--danger-dim);
		color: var(--danger);
	}
	.qty-minus:hover {
		background: var(--danger);
		color: #fff;
		box-shadow: 0 2px 8px rgba(224, 67, 74, 0.4);
	}
	.qty-plus {
		background: var(--green-dim);
		color: var(--green);
	}
	.qty-plus:hover {
		background: var(--green);
		color: #fff;
		box-shadow: 0 2px 8px rgba(61, 179, 122, 0.4);
	}
	.qty-num {
		font-size: 15px;
		font-weight: 800;
		color: #fff;
		min-width: 28px;
		text-align: center;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
	}
	.card-meta {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.meta-mana {
		font-size: 11px;
		color: var(--gold);
		font-weight: 700;
		letter-spacing: 0.02em;
	}
	.meta-type {
		font-size: 10px;
		color: var(--text-secondary);
	}

	.qty-badge {
		position: absolute;
		top: 7px;
		right: 7px;
		background: rgba(8, 8, 14, 0.88);
		color: var(--accent-light);
		font-size: 11px;
		font-weight: 800;
		padding: 2px 8px;
		border-radius: 12px;
		border: 1px solid rgba(124, 92, 246, 0.45);
		backdrop-filter: blur(6px);
		letter-spacing: 0.01em;
	}
	.commander-badge {
		position: absolute;
		top: 7px;
		right: 7px;
		background: rgba(8, 8, 14, 0.9);
		color: var(--gold);
		font-size: 10px;
		font-weight: 700;
		padding: 3px 9px;
		border-radius: 12px;
		border: 1px solid rgba(201, 168, 64, 0.55);
		backdrop-filter: blur(6px);
		letter-spacing: 0.02em;
	}

	/* ── Search Panel ── */
	.search-panel {
		width: 290px;
		flex-shrink: 0;
		background: var(--surface);
		border-left: 1px solid var(--border);
		padding: 20px 16px;
		position: sticky;
		top: 64px;
		max-height: calc(100vh - 64px);
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}
	.panel-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 14px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--border);
	}
	.panel-header h2 {
		margin: 0;
		font-size: 13px;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: 0.01em;
	}
	.panel-icon {
		width: 15px;
		height: 15px;
		color: var(--accent);
		flex-shrink: 0;
	}
	.search-row {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 14px;
	}
	.search-row .btn {
		width: 100%;
		justify-content: center;
	}
	.search-loading {
		display: flex;
		justify-content: center;
		padding: 20px 0;
	}

	/* ── Loader ── */
	.loader-ring {
		width: 36px;
		height: 36px;
		border: 3px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.75s linear infinite;
	}
	.loader-sm {
		width: 22px;
		height: 22px;
		border-width: 2px;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Results ── */
	.result-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.result-item {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 7px 9px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		border: 1px solid var(--border);
		transition:
			border-color 0.18s,
			background 0.18s,
			box-shadow 0.18s;
	}
	.result-item:hover {
		border-color: var(--border-focus);
		background: rgba(28, 28, 40, 0.9);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
	}
	.result-thumb {
		width: 38px;
		border-radius: 4px;
		flex-shrink: 0;
		object-fit: cover;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
	}
	.result-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.result-name {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.result-type {
		font-size: 10px;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.btn-add {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: none;
		background: var(--green-dim);
		color: var(--green);
		font-size: 18px;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition:
			background 0.15s,
			transform 0.12s,
			box-shadow 0.15s;
	}
	.btn-add:hover {
		background: var(--green);
		color: #fff;
		box-shadow: 0 2px 8px rgba(61, 179, 122, 0.4);
	}
	.btn-add:active {
		transform: scale(0.88);
	}

	/* ── Detail overlay ── */
	.detalle-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.78);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		padding: 20px;
	}
	.detalle-panel {
		background: linear-gradient(160deg, #1a1926, var(--surface));
		border: 1px solid rgba(124, 92, 246, 0.25);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg), var(--shadow-accent);
		width: 100%;
		max-width: 700px;
		max-height: 90vh;
		overflow-y: auto;
		position: relative;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}
	.detalle-cerrar {
		position: absolute;
		top: 14px;
		right: 14px;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
		z-index: 1;
	}
	.detalle-cerrar:hover {
		background: var(--danger);
		color: #fff;
		border-color: var(--danger);
	}
	.detalle-cerrar svg {
		width: 14px;
		height: 14px;
	}

	.detalle-body {
		display: flex;
		gap: 24px;
		padding: 24px;
	}
	.detalle-img {
		width: 225px;
		flex-shrink: 0;
		border-radius: var(--radius);
		align-self: flex-start;
		box-shadow: var(--shadow-card);
	}
	.detalle-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 4px;
	}
	.detalle-nombre {
		margin: 0 0 4px;
		font-size: 20px;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.25;
		letter-spacing: -0.01em;
	}
	.detalle-fila {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 10px 12px;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
	}
	.detalle-label {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-muted);
	}
	.detalle-valor {
		font-size: 13px;
		color: var(--text-primary);
		line-height: 1.55;
	}
	.detalle-valor.mana {
		color: var(--gold);
		font-weight: 700;
		letter-spacing: 0.03em;
	}
	.detalle-valor.oracle {
		color: var(--text-secondary);
		white-space: pre-wrap;
	}
	.rarity-common {
		color: var(--text-secondary);
	}
	.rarity-uncommon {
		color: #a8c4d4;
	}
	.rarity-rare {
		color: var(--gold);
		font-weight: 600;
	}
	.rarity-mythic {
		color: #e87c3e;
		font-weight: 600;
	}

	/* ── Analysis ── */
	.analysis-sep {
		border-top: 1px solid var(--border);
		margin: 16px 0 0;
	}

	.alerts-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 10px;
	}

	.alert-item {
		background: var(--danger-dim);
		color: var(--danger);
		border: 1px solid rgba(224, 67, 74, 0.3);
		border-radius: var(--radius-sm);
		padding: 5px 8px;
		font-size: 10px;
		line-height: 1.4;
	}

	.alert-ok {
		color: var(--green);
		font-size: 11px;
		margin-bottom: 8px;
		font-weight: 500;
	}

	.tag-distribution {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.tag-row {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.tag-label {
		font-size: 10px;
		color: var(--text-secondary);
		width: 88px;
		flex-shrink: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tag-bar {
		flex: 1;
		height: 5px;
		background: var(--surface);
		border-radius: 3px;
		overflow: hidden;
	}

	.tag-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 3px;
	}

	.tag-count {
		font-size: 10px;
		color: var(--text-muted);
		width: 16px;
		text-align: right;
		flex-shrink: 0;
	}

	/* ── Export ── */
	.export-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.export-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		min-width: 200px;
		z-index: 200;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
		overflow: hidden;
	}

	.export-title {
		padding: 9px 14px 7px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-muted);
		border-bottom: 1px solid var(--border);
	}

	.export-option {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 10px 14px;
		background: transparent;
		border: none;
		color: var(--text-secondary);
		font-family: var(--font);
		font-size: 13px;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
		text-align: left;
	}

	.export-option svg {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}
	.export-option:hover {
		background: var(--surface-2);
		color: var(--text-primary);
	}
	.export-option.copied {
		color: var(--green);
	}
</style>
