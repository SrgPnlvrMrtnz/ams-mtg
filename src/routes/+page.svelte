<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		goto('/login');
	}

	let puntero = $state(0);
	let colorSeleccionado = $state('');
	let textoBusqueda = $state('');
	let numPagina = $state(1);
	let cargando = $state(false);
	let statusMsg = $state('');
	let cartas: any[] = $state([]);

	let favoritos: string[] = $state([]);
	let mazos: Record<string, string[]> = $state({});
	let mazoSeleccionado = $state('');
	let nuevoMazoNombre = $state('');

	const frasesMagicas = [
		'Consultando el Oráculo de Scryfall...',
		'Canalizando maná de las tierras lejanas...',
		'Invocando criaturas del Multiverso...',
		'Tejiendo los hilos del Éter...',
		'Buscando reliquias en las ruinas de Dominaria...',
		'Leyendo los pergaminos antiguos...',
		'Explorando los planos de existencia...'
	];

	function fraseMagicaAleatoria() {
		return frasesMagicas[Math.floor(Math.random() * frasesMagicas.length)];
	}

	onMount(() => {
		favoritos = JSON.parse(localStorage.getItem('mtg_favs') || '[]');
		mazos = JSON.parse(localStorage.getItem('mtg_mazos') || '{}');
		rellenarPaginaCartas(0);
	});

	async function buscarCarta(texto: string, p: number) {
		let query = texto || '';
		if (colorSeleccionado) query += ` c:${colorSeleccionado}`;
		if (!query) query = 'is:spells';
		const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&page=${p + 1}`;
		const res = await fetch(url);
		return res.json();
	}

	async function rellenarPaginaCartas(p: number) {
		cartas = [];
		cargando = true;
		statusMsg = fraseMagicaAleatoria();
		try {
			const data = await buscarCarta(textoBusqueda, p);
			cargando = false;
			if (!data.data || data.data.length === 0) {
				statusMsg = 'No se encontraron cartas.';
			} else {
				statusMsg = '';
				cartas = data.data;
			}
		} catch {
			cargando = false;
			statusMsg = 'Error de red. Inténtalo de nuevo.';
		}
	}

	async function cartaAleatoria() {
		cartas = [];
		cargando = true;
		statusMsg = 'Buscando una carta aleatoria...';
		try {
			const res = await fetch('https://api.scryfall.com/cards/random');
			const carta = await res.json();
			cargando = false;
			statusMsg = '';
			cartas = [carta];
		} catch {
			cargando = false;
			statusMsg = 'Error de red. Inténtalo de nuevo.';
		}
	}

	function buscar() {
		puntero = 0;
		numPagina = 1;
		rellenarPaginaCartas(0);
	}

	function siguiente() {
		puntero++;
		numPagina = puntero + 1;
		rellenarPaginaCartas(puntero);
	}

	function anterior() {
		if (puntero > 0) {
			puntero--;
			numPagina = puntero + 1;
			rellenarPaginaCartas(puntero);
		}
	}

	function seleccionarColor(color: string) {
		colorSeleccionado = color;
		puntero = 0;
		rellenarPaginaCartas(0);
	}

	function limpiarFiltros() {
		colorSeleccionado = '';
		puntero = 0;
		rellenarPaginaCartas(0);
	}

	function agregarFavorito(nombre: string) {
		if (!favoritos.includes(nombre)) {
			favoritos = [...favoritos, nombre];
			localStorage.setItem('mtg_favs', JSON.stringify(favoritos));
		}
	}

	function eliminarFav(i: number) {
		favoritos = favoritos.filter((_, idx) => idx !== i);
		localStorage.setItem('mtg_favs', JSON.stringify(favoritos));
	}

	function crearMazo() {
		const nombre = nuevoMazoNombre.trim();
		if (nombre && !mazos[nombre]) {
			mazos = { ...mazos, [nombre]: [] };
			nuevoMazoNombre = '';
			localStorage.setItem('mtg_mazos', JSON.stringify(mazos));
		}
	}

	function agregarAlMazo(nombreCarta: string) {
		if (!mazoSeleccionado) {
			alert('Selecciona un mazo primero.');
			return;
		}
		mazos[mazoSeleccionado] = [...(mazos[mazoSeleccionado] || []), nombreCarta];
		mazos = { ...mazos };
		localStorage.setItem('mtg_mazos', JSON.stringify(mazos));
	}

	function quitarDelMazo(i: number) {
		mazos[mazoSeleccionado] = mazos[mazoSeleccionado].filter((_, idx) => idx !== i);
		mazos = { ...mazos };
		localStorage.setItem('mtg_mazos', JSON.stringify(mazos));
	}

	function getImageUrl(carta: any): string {
		if (carta.image_uris?.png) return carta.image_uris.png;
		if (carta.card_faces?.[0]?.image_uris?.png) return carta.card_faces[0].image_uris.png;
		return '';
	}

	const manaColors = [
		{ code: 'w', label: 'Blanco', symbol: 'W', cls: 'mana-w' },
		{ code: 'u', label: 'Azul',   symbol: 'U', cls: 'mana-u' },
		{ code: 'b', label: 'Negro',  symbol: 'B', cls: 'mana-b' },
		{ code: 'r', label: 'Rojo',   symbol: 'R', cls: 'mana-r' },
		{ code: 'g', label: 'Verde',  symbol: 'G', cls: 'mana-g' }
	];
</script>

<svelte:head>
	<title>AMS · MTG — Card Browser</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<!-- HEADER -->
<header class="site-header">
	<div class="header-inner">
		<div class="brand">
			<span class="brand-logo" aria-hidden="true">◆</span>
			<span class="brand-name">AMS <span class="brand-accent">MTG</span></span>
		</div>

		<div class="search-row">
			<div class="search-field">
				<svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
				</svg>
				<input
					type="text"
					bind:value={textoBusqueda}
					placeholder="Buscar carta..."
					onkeydown={(e) => e.key === 'Enter' && buscar()}
				/>
			</div>
			<button class="btn btn-primary" onclick={buscar}>Buscar</button>
			<button class="btn btn-ghost" onclick={cartaAleatoria}>Aleatoria</button>
		</div>

		<div class="header-actions">
			<a href="/partida" class="btn btn-danger">Modo Partida</a>
			<button class="btn btn-logout" onclick={logout}>Cerrar sesión</button>
		</div>
	</div>

	<!-- Mana filter bar -->
	<div class="mana-bar">
		<span class="mana-label">Color</span>
		<div class="mana-pills">
			{#each manaColors as m}
				<button
					class="mana-pip {m.cls}"
					class:active={colorSeleccionado === m.code}
					title={m.label}
					onclick={() => seleccionarColor(m.code)}
				>
					<span class="pip-symbol">{m.symbol}</span>
					<span class="pip-label">{m.label}</span>
				</button>
			{/each}
			<button
				class="mana-pip mana-clear"
				class:active={colorSeleccionado === ''}
				title="Todos los colores"
				onclick={limpiarFiltros}
			>
				<span class="pip-symbol">∅</span>
				<span class="pip-label">Todos</span>
			</button>
		</div>
	</div>
</header>

<!-- MAIN LAYOUT -->
<main class="app-layout">

	<!-- Sidebar: Favoritos -->
	<aside class="panel">
		<div class="panel-header">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="panel-icon" aria-hidden="true">
				<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
			</svg>
			<h2>Favoritos</h2>
			{#if favoritos.length > 0}
				<span class="badge">{favoritos.length}</span>
			{/if}
		</div>

		{#if favoritos.length === 0}
			<p class="empty-hint">Guarda cartas pulsando el ícono de marcador.</p>
		{:else}
			<ul class="item-list">
				{#each favoritos as nombre, i}
					<li class="item-row">
						<span class="item-name">{nombre}</span>
						<button class="btn-icon btn-remove" onclick={() => eliminarFav(i)} title="Eliminar">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
								<path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
							</svg>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="panel-divider"></div>

		<div class="panel-header">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="panel-icon" aria-hidden="true">
				<path fill-rule="evenodd" d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm6.39-2.908a.75.75 0 0 1 .766.027l3.5 2.25a.75.75 0 0 1 0 1.262l-3.5 2.25A.75.75 0 0 1 8 12.25v-4.5a.75.75 0 0 1 .39-.658Z" clip-rule="evenodd" />
			</svg>
			<h2>Página {numPagina}</h2>
		</div>
		<div class="pager">
			<button class="btn btn-ghost pager-btn" onclick={anterior} disabled={puntero === 0}>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
				</svg>
				Anterior
			</button>
			<button class="btn btn-ghost pager-btn" onclick={siguiente}>
				Siguiente
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
				</svg>
			</button>
		</div>
	</aside>

	<!-- Card Grid -->
	<section class="card-area">
		{#if cargando || statusMsg}
			<div class="status-block">
				{#if cargando}
					<div class="loader">
						<div class="loader-ring"></div>
					</div>
				{/if}
				<p class="status-text">{statusMsg}</p>
			</div>
		{/if}

		<div class="card-grid">
			{#each cartas as carta}
				{@const imgUrl = getImageUrl(carta)}
				{#if imgUrl}
					<article class="card-item">
						<img src={imgUrl} alt={carta.name} loading="lazy" />
						<div class="card-actions">
							<button
								class="card-action-btn action-fav"
								onclick={() => agregarFavorito(carta.name)}
								title="Añadir a favoritos"
							>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
									<path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z" />
									<path d="M6.97 5.678a.75.75 0 0 1 .638-.428h.784a.75.75 0 0 1 .638.428l.24.484.52-.066a.75.75 0 0 1 .853.588.75.75 0 0 1-.193.676l-.378.368.089.519a.75.75 0 0 1-1.086.79L8 8.56l-.465.479a.75.75 0 0 1-1.086-.79l.089-.52-.378-.367a.75.75 0 0 1 .66-1.264l.52.066.24-.484Z" />
								</svg>
								Favorito
							</button>
							<button
								class="card-action-btn action-deck"
								onclick={() => agregarAlMazo(carta.name)}
								title="Añadir al mazo"
							>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
									<path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
								</svg>
								Al mazo
							</button>
						</div>
					</article>
				{/if}
			{/each}
		</div>
	</section>

	<!-- Sidebar: Mazos -->
	<aside class="panel">
		<div class="panel-header">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="panel-icon" aria-hidden="true">
				<path d="M5 3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5ZM5 11a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H5ZM11 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V5ZM14 11a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0v-1h-1a1 1 0 1 1 0-2h1v-1a1 1 0 0 1 1-1Z" />
			</svg>
			<h2>Mis Mazos</h2>
			{#if Object.keys(mazos).length > 0}
				<span class="badge">{Object.keys(mazos).length}</span>
			{/if}
		</div>

		<div class="deck-new">
			<input
				type="text"
				bind:value={nuevoMazoNombre}
				placeholder="Nombre del mazo..."
				onkeydown={(e) => e.key === 'Enter' && crearMazo()}
			/>
			<button class="btn btn-primary" onclick={crearMazo}>Crear</button>
		</div>

		{#if Object.keys(mazos).length > 0}
			<div class="deck-selector">
				<label class="field-label" for="deck-select">Mazo activo</label>
				<select id="deck-select" bind:value={mazoSeleccionado}>
					<option value="">Seleccionar...</option>
					{#each Object.keys(mazos) as nombre}
						<option value={nombre}>{nombre}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if mazoSeleccionado && mazos[mazoSeleccionado]}
			<div class="deck-count">
				{mazos[mazoSeleccionado].length} {mazos[mazoSeleccionado].length === 1 ? 'carta' : 'cartas'}
			</div>
			{#if mazos[mazoSeleccionado].length === 0}
				<p class="empty-hint">Este mazo está vacío.</p>
			{:else}
				<ul class="item-list">
					{#each mazos[mazoSeleccionado] as carta, i}
						<li class="item-row">
							<span class="item-name">{carta}</span>
							<button class="btn-icon btn-remove" onclick={() => quitarDelMazo(i)} title="Quitar">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
									<path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
								</svg>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</aside>
</main>

<style>
	/* ── Design tokens ─────────────────────────────────────────────── */
	:global(:root) {
		--bg:           #0c0c10;
		--surface:      #14141c;
		--surface-2:    #1c1c28;
		--surface-3:    #24243200;
		--border:       #2a2a38;
		--border-focus: #6d5acd;

		--text-primary:   #f0eff6;
		--text-secondary: #8e8da8;
		--text-muted:     #5a596e;

		--accent:       #7c5cf6;
		--accent-light: #9b7cff;
		--accent-dim:   rgba(124, 92, 246, 0.15);

		--gold:         #c9a840;
		--gold-dim:     rgba(201, 168, 64, 0.18);

		--danger:       #e0434a;
		--danger-dim:   rgba(224, 67, 74, 0.15);

		--green:        #3db37a;
		--green-dim:    rgba(61, 179, 122, 0.18);

		--radius-sm:    6px;
		--radius:       10px;
		--radius-lg:    14px;

		--shadow-sm:  0 1px 3px rgba(0,0,0,0.4);
		--shadow-md:  0 4px 16px rgba(0,0,0,0.55);
		--shadow-lg:  0 12px 36px rgba(0,0,0,0.7);

		--font: 'Inter', system-ui, -apple-system, sans-serif;
	}

	/* ── Reset / Base ──────────────────────────────────────────────── */
	:global(*) { box-sizing: border-box; }

	:global(body) {
		background: var(--bg);
		color: var(--text-primary);
		font-family: var(--font);
		font-size: 14px;
		line-height: 1.5;
		margin: 0;
		-webkit-font-smoothing: antialiased;
	}

	:global(input[type='text'], select) {
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text-primary);
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		font-family: var(--font);
		font-size: 13px;
		outline: none;
		transition: border-color 0.15s;
	}

	:global(input[type='text']:focus, select:focus) {
		border-color: var(--border-focus);
	}

	:global(select option) {
		background: var(--surface-2);
	}

	/* ── Buttons ───────────────────────────────────────────────────── */
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
		transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
		white-space: nowrap;
		text-decoration: none;
	}

	.btn-primary {
		background: var(--accent);
		color: #fff;
		border-color: var(--accent);
	}

	.btn-primary:hover {
		background: var(--accent-light);
		border-color: var(--accent-light);
	}

	.btn-ghost {
		background: transparent;
		color: var(--text-secondary);
		border-color: var(--border);
	}

	.btn-ghost:hover {
		background: var(--surface-2);
		color: var(--text-primary);
		border-color: var(--border-focus);
	}

	.btn-ghost:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.header-actions {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.btn-logout {
		background: transparent;
		border: 1px solid #555;
		color: #aaa;
		font-size: 0.85rem;
		padding: 8px 14px;
		font-weight: normal;
		text-transform: none;
	}

	.btn-logout:hover {
		background: #2a2a2a;
		border-color: #888;
		color: var(--text);
		transform: none;
		box-shadow: none;
	}

	.btn-danger {
		background: var(--danger-dim);
		color: var(--danger);
		border-color: rgba(224, 67, 74, 0.35);
	}

	.btn-danger:hover {
		background: var(--danger);
		color: #fff;
	}

	/* ── Header ────────────────────────────────────────────────────── */
	.site-header {
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.header-inner {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 24px;
		max-width: 1600px;
		margin: 0 auto;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.brand-logo {
		color: var(--gold);
		font-size: 1.1rem;
	}

	.brand-name {
		font-size: 15px;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--text-primary);
		text-transform: uppercase;
	}

	.brand-accent {
		color: var(--accent-light);
	}

	.search-row {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.search-field {
		flex: 1;
		position: relative;
		max-width: 480px;
	}

	.search-icon {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		width: 15px;
		height: 15px;
		color: var(--text-muted);
		pointer-events: none;
	}

	.search-field input {
		padding-left: 34px;
	}

	/* ── Mana filter bar ───────────────────────────────────────────── */
	.mana-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 24px;
		border-top: 1px solid var(--border);
		background: var(--surface);
		max-width: 1600px;
		margin: 0 auto;
	}

	.mana-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.mana-pills {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.mana-pip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px 4px 6px;
		border-radius: 20px;
		border: 1px solid transparent;
		cursor: pointer;
		font-family: var(--font);
		font-size: 12px;
		font-weight: 600;
		transition: all 0.15s;
		background: var(--surface-2);
	}

	.pip-symbol {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		font-size: 10px;
		font-weight: 800;
		color: #fff;
		flex-shrink: 0;
	}

	.pip-label {
		color: var(--text-secondary);
		transition: color 0.15s;
	}

	.mana-w .pip-symbol { background: #c8b47c; color: #1a1000; }
	.mana-u .pip-symbol { background: #2c6fad; }
	.mana-b .pip-symbol { background: #48484e; }
	.mana-r .pip-symbol { background: #c93c1c; }
	.mana-g .pip-symbol { background: #2e7d4f; }
	.mana-clear .pip-symbol { background: var(--surface-3); border: 1px solid var(--border); color: var(--text-secondary); font-size: 12px; }

	.mana-pip:hover {
		background: var(--surface-2);
		border-color: var(--border-focus);
	}

	.mana-pip:hover .pip-label { color: var(--text-primary); }

	.mana-w.active { background: rgba(200,180,124,0.12); border-color: #c8b47c; }
	.mana-u.active { background: rgba(44,111,173,0.18); border-color: #2c6fad; }
	.mana-b.active { background: rgba(72,72,78,0.25); border-color: #888; }
	.mana-r.active { background: rgba(201,60,28,0.18); border-color: #c93c1c; }
	.mana-g.active { background: rgba(46,125,79,0.18); border-color: #2e7d4f; }
	.mana-clear.active { background: var(--accent-dim); border-color: var(--accent); }

	.mana-pip.active .pip-label { color: var(--text-primary); }

	/* ── App layout ────────────────────────────────────────────────── */
	.app-layout {
		display: flex;
		gap: 0;
		padding: 0;
		align-items: flex-start;
		max-width: 1600px;
		margin: 0 auto;
		min-height: calc(100vh - 97px);
	}

	/* ── Side panels ───────────────────────────────────────────────── */
	.panel {
		width: 240px;
		flex-shrink: 0;
		background: var(--surface);
		border-right: 1px solid var(--border);
		padding: 16px;
		position: sticky;
		top: 97px;
		max-height: calc(100vh - 97px);
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}

	.panel:last-child {
		border-right: none;
		border-left: 1px solid var(--border);
	}

	.panel-header {
		display: flex;
		align-items: center;
		gap: 7px;
		margin-bottom: 12px;
	}

	.panel-header h2 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary);
		flex: 1;
	}

	.panel-icon {
		width: 14px;
		height: 14px;
		color: var(--accent);
		flex-shrink: 0;
	}

	.badge {
		background: var(--accent-dim);
		color: var(--accent-light);
		font-size: 11px;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 10px;
		border: 1px solid rgba(124, 92, 246, 0.3);
	}

	.panel-divider {
		height: 1px;
		background: var(--border);
		margin: 16px 0;
	}

	.empty-hint {
		font-size: 12px;
		color: var(--text-muted);
		text-align: center;
		margin: 12px 0;
		line-height: 1.5;
	}

	/* ── Item list (favs / deck cards) ────────────────────────────── */
	.item-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.item-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 8px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		border: 1px solid var(--border);
		transition: border-color 0.15s;
	}

	.item-row:hover {
		border-color: var(--border-focus);
	}

	.item-name {
		flex: 1;
		font-size: 12px;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.btn-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		border: none;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s;
		padding: 0;
	}

	.btn-icon svg {
		width: 12px;
		height: 12px;
	}

	.btn-remove {
		background: var(--danger-dim);
		color: var(--danger);
	}

	.btn-remove:hover {
		background: var(--danger);
		color: #fff;
	}

	/* ── Pagination ────────────────────────────────────────────────── */
	.pager {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 8px;
	}

	.pager-btn {
		width: 100%;
		justify-content: center;
		font-size: 12px;
	}

	.pager-btn svg {
		width: 14px;
		height: 14px;
	}

	/* ── Deck controls ─────────────────────────────────────────────── */
	.deck-new {
		display: flex;
		gap: 6px;
		align-items: center;
		margin-bottom: 12px;
	}

	.deck-new input {
		flex: 1;
	}

	.deck-new .btn {
		flex-shrink: 0;
		padding: 8px 12px;
	}

	.deck-selector {
		margin-bottom: 12px;
	}

	.field-label {
		display: block;
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-muted);
		margin-bottom: 5px;
	}

	.deck-count {
		font-size: 11px;
		color: var(--text-muted);
		margin-bottom: 8px;
		font-weight: 500;
	}

	/* ── Card area ─────────────────────────────────────────────────── */
	.card-area {
		flex: 1;
		padding: 20px;
		min-width: 0;
	}

	/* ── Status ────────────────────────────────────────────────────── */
	.status-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		gap: 16px;
	}

	.loader {
		position: relative;
		width: 36px;
		height: 36px;
	}

	.loader-ring {
		width: 36px;
		height: 36px;
		border: 3px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.status-text {
		font-size: 13px;
		color: var(--text-secondary);
		text-align: center;
		margin: 0;
	}

	/* ── Card grid ─────────────────────────────────────────────────── */
	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
		gap: 16px;
	}

	.card-item {
		position: relative;
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--surface-2);
		border: 1px solid var(--border);
		transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s;
		cursor: default;
	}

	.card-item:hover {
		transform: translateY(-4px) scale(1.02);
		box-shadow: var(--shadow-lg);
		border-color: var(--border-focus);
		z-index: 10;
	}

	.card-item img {
		width: 100%;
		display: block;
	}

	/* Action buttons appear on hover */
	.card-actions {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		gap: 6px;
		padding: 10px 10px 12px;
		background: linear-gradient(to top, rgba(8,8,14,0.92) 60%, transparent);
		opacity: 0;
		transition: opacity 0.2s ease;
		justify-content: center;
	}

	.card-item:hover .card-actions {
		opacity: 1;
	}

	.card-action-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 11px;
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
		font-family: var(--font);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}

	.card-action-btn svg {
		width: 13px;
		height: 13px;
	}

	.action-fav {
		background: var(--gold-dim);
		color: var(--gold);
		border-color: rgba(201, 168, 64, 0.3);
	}

	.action-fav:hover {
		background: var(--gold);
		color: #1a1000;
	}

	.action-deck {
		background: var(--green-dim);
		color: var(--green);
		border-color: rgba(61, 179, 122, 0.3);
	}

	.action-deck:hover {
		background: var(--green);
		color: #fff;
	}
</style>
