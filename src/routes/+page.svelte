<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	type ApiCard = {
		id: string;
		name: string;
		mana_cost: string | null;
		cmc: number;
		type_line: string;
		colors: string;
		rarity: string | null;
		tags: string;
	};

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
	let cartas: ApiCard[] = $state([]);
	let imagenesCartas: Record<string, string> = $state({});
	let imagenesCartasBack: Record<string, string> = $state({});
	let cartasGiradas: Set<string> = $state(new Set());
	let hayMas = $state(false);

	let cartaSeleccionada = $state<any>(null);

	function verDetalle(carta: any) {
		cartaSeleccionada = carta;
	}
	async function verDetalleCompleto(carta: ApiCard) {
		// Fetch full card data from Scryfall for oracle text, etc.
		try {
			const res = await fetch(
				`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(carta.name)}`
			);
			if (res.ok) cartaSeleccionada = await res.json();
			else cartaSeleccionada = carta;
		} catch {
			cartaSeleccionada = carta;
		}
	}
	function cerrarDetalle() {
		cartaSeleccionada = null;
	}

	type Deck = {
		id: string;
		name: string;
		format: string | null;
		description: string | null;
		colorIdentity: string;
		commander: string | null;
		cards: string;
	};

	let favoritos: string[] = $state([]);
	let mazos: Deck[] = $state([]);
	let mazoSeleccionadoId = $state('');

	// Modal de creación
	let modalAbierto = $state(false);
	let modalNombre = $state('');
	let modalFormato = $state('');
	let modalDescripcion = $state('');
	let modalColores: string[] = $state([]);
	let modalComandantes: string[] = $state([]);
	let modalComandanteInput = $state('');
	let modalComandanteValido = $state(false);
	let modalComandanteError = $state('');
	let modalComandanteSugerencias: string[] = $state([]);
	let modalCargando = $state(false);
	let modalImportText = $state('');

	function parseImportList(text: string): string[] {
		const result: string[] = [];
		for (const raw of text.split('\n')) {
			const line = raw.trim();
			if (!line || line.startsWith('//') || line.startsWith('#')) continue;
			if (/^(deck|sideboard|commander|mazo|main|mainboard)$/i.test(line)) continue;
			const cleaned = line.replace(/\s*\([A-Z0-9-]+\)\s*\d+\s*$/, '').trim();
			const m = cleaned.match(/^(\d+)[x ]?\s*(.+)$/);
			if (m) {
				const qty = Math.min(Math.max(1, parseInt(m[1])), 99);
				const name = m[2].trim();
				if (name) for (let i = 0; i < qty; i++) result.push(name);
			} else if (cleaned) {
				result.push(cleaned);
			}
		}
		return result;
	}

	const COMMANDER_FORMATS = ['Commander', 'Brawl', 'Oathbreaker'];

	const frasesMagicas = [
		'Consultando los pergaminos del oráculo...',
		'Canalizando maná de las tierras lejanas...',
		'Invocando criaturas del Multiverso...',
		'Tejiendo los hilos del Éter...',
		'Buscando reliquias en las ruinas de Dominaria...',
		'Leyendo los tomos olvidados...',
		'Explorando los planos de existencia...'
	];

	function fraseMagicaAleatoria() {
		return frasesMagicas[Math.floor(Math.random() * frasesMagicas.length)];
	}

	onMount(async () => {
		favoritos = JSON.parse(localStorage.getItem('mtg_favs') || '[]');
		await cargarMazos();
		rellenarPaginaCartas(0);
	});

	async function cargarMazos() {
		const res = await fetch('/api/decks');
		if (res.ok) mazos = await res.json();
	}

	const mazoSeleccionado = $derived(mazos.find((m) => m.id === mazoSeleccionadoId) ?? null);
	const cartasDelMazo = $derived<string[]>(
		mazoSeleccionado ? JSON.parse(mazoSeleccionado.cards) : []
	);

	const cartasDelMazoAgrupadas = $derived.by(() => {
		const conteo: Record<string, number> = {};
		for (const c of cartasDelMazo) conteo[c] = (conteo[c] || 0) + 1;
		return Object.entries(conteo)
			.map(([nombre, cantidad]) => ({ nombre, cantidad }))
			.sort((a, b) => a.nombre.localeCompare(b.nombre));
	});

	async function fetchImages(
		names: string[]
	): Promise<{ front: Record<string, string>; back: Record<string, string> }> {
		if (names.length === 0) return { front: {}, back: {} };
		try {
			const res = await fetch('https://api.scryfall.com/cards/collection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					identifiers: names.map((name) => ({ name: name.split(' // ')[0] }))
				})
			});
			if (!res.ok) return { front: {}, back: {} };
			const data = await res.json();
			const front: Record<string, string> = {};
			const back: Record<string, string> = {};
			for (const card of data.data ?? []) {
				const frontImg = card.image_uris?.png ?? card.card_faces?.[0]?.image_uris?.png;
				if (frontImg) front[card.name] = frontImg;
				const backImg = card.card_faces?.[1]?.image_uris?.png;
				if (backImg) back[card.name] = backImg;
			}
			return { front, back };
		} catch {
			return { front: {}, back: {} };
		}
	}

	async function buscarCartas(texto: string, p: number) {
		const params = new URLSearchParams();
		if (texto) params.set('q', texto);
		if (colorSeleccionado) params.set('colors', colorSeleccionado);
		params.set('page', String(p + 1));
		const res = await fetch(`/api/cards?${params}`);
		if (!res.ok) throw new Error('API error');
		return res.json();
	}

	async function rellenarPaginaCartas(p: number) {
		cartas = [];
		imagenesCartas = {};
		cargando = true;
		statusMsg = fraseMagicaAleatoria();
		try {
			const data = await buscarCartas(textoBusqueda, p);
			if (!data.cards || data.cards.length === 0) {
				statusMsg = 'No se encontraron cartas.';
			} else {
				statusMsg = '';
				cartas = data.cards;
				hayMas = data.hasMore;
				cartasGiradas = new Set();
				const imgs = await fetchImages(cartas.map((c) => c.name));
				imagenesCartas = imgs.front;
				imagenesCartasBack = imgs.back;
			}
		} catch {
			statusMsg = 'Error de red. Inténtalo de nuevo.';
		} finally {
			cargando = false;
		}
	}

	async function cartaAleatoria() {
		cartas = [];
		imagenesCartas = {};
		imagenesCartasBack = {};
		cartasGiradas = new Set();
		cargando = true;
		statusMsg = 'Buscando una carta aleatoria...';
		try {
			const res = await fetch('https://api.scryfall.com/cards/random');
			const sc = await res.json();
			statusMsg = '';
			const frontImg = sc.image_uris?.png ?? sc.card_faces?.[0]?.image_uris?.png ?? '';
			const backImg = sc.card_faces?.[1]?.image_uris?.png ?? '';

			// Try to find in our catalog
			const apiRes = await fetch(`/api/cards?q=${encodeURIComponent(sc.name)}&page=1`);
			if (apiRes.ok) {
				const apiData = await apiRes.json();
				const found = apiData.cards?.find((c: ApiCard) => c.name === sc.name);
				if (found) {
					cartas = [found];
					hayMas = false;
					if (frontImg) imagenesCartas = { [found.name]: frontImg };
					if (backImg) imagenesCartasBack = { [found.name]: backImg };
					return;
				}
			}
			// Fallback for cards not in our catalog
			cartas = [
				{
					id: sc.oracle_id ?? '',
					name: sc.name,
					mana_cost: sc.mana_cost ?? null,
					cmc: sc.cmc ?? 0,
					type_line: sc.type_line ?? '',
					colors: JSON.stringify(sc.colors ?? []),
					rarity: sc.rarity ?? null,
					tags: '[]'
				}
			];
			hayMas = false;
			if (frontImg) imagenesCartas = { [sc.name]: frontImg };
			if (backImg) imagenesCartasBack = { [sc.name]: backImg };
		} catch {
			statusMsg = 'Error de red. Inténtalo de nuevo.';
		} finally {
			cargando = false;
		}
	}

	function buscar() {
		puntero = 0;
		numPagina = 1;
		rellenarPaginaCartas(0);
	}

	function siguiente() {
		if (!hayMas) return;
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

	function abrirModal() {
		modalNombre = '';
		modalFormato = '';
		modalDescripcion = '';
		modalColores = [];
		modalComandantes = [];
		modalComandanteInput = '';
		modalComandanteValido = false;
		modalComandanteError = '';
		modalComandanteSugerencias = [];
		modalImportText = '';
		modalAbierto = true;
	}

	function toggleColorModal(color: string) {
		modalColores = modalColores.includes(color)
			? modalColores.filter((c) => c !== color)
			: [...modalColores, color];
	}

	let _comandanteTimer: ReturnType<typeof setTimeout>;
	async function buscarComandante(q: string) {
		modalComandanteInput = q;
		modalComandanteValido = false;
		modalComandanteError = '';
		clearTimeout(_comandanteTimer);
		if (q.length < 2) {
			modalComandanteSugerencias = [];
			return;
		}
		_comandanteTimer = setTimeout(async () => {
			try {
				const res = await fetch(
					`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(q)}`
				);
				const data = await res.json();
				modalComandanteSugerencias = data.data?.slice(0, 6) ?? [];
			} catch {
				modalComandanteSugerencias = [];
			}
		}, 300);
	}

	function agregarComandante(nombre: string) {
		if (!modalComandantes.includes(nombre)) {
			modalComandantes = [...modalComandantes, nombre];
		}
		modalComandanteInput = '';
		modalComandanteValido = true;
		modalComandanteError = '';
		modalComandanteSugerencias = [];
	}

	function quitarComandante(i: number) {
		modalComandantes = modalComandantes.filter((_, idx) => idx !== i);
	}

	async function confirmarCrearMazo() {
		if (!modalNombre.trim()) return;

		// Validate commander input if format requires it
		if (
			COMMANDER_FORMATS.includes(modalFormato) &&
			modalComandanteInput.trim() &&
			!modalComandanteValido
		) {
			modalComandanteError = 'Selecciona el nombre exacto de la lista de sugerencias.';
			return;
		}

		modalCargando = true;
		try {
			const res = await fetch('/api/decks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: modalNombre.trim(),
					format: modalFormato || null,
					description: modalDescripcion || null,
					colorIdentity: modalColores,
					commander: modalComandantes.length > 0 ? JSON.stringify(modalComandantes) : null,
					cards: [...modalComandantes, ...parseImportList(modalImportText)]
				})
			});
			if (res.ok) {
				const nuevo = await res.json();
				mazos = [nuevo, ...mazos];
				mazoSeleccionadoId = nuevo.id;
				modalAbierto = false;
			}
		} finally {
			modalCargando = false;
		}
	}

	async function agregarAlMazo(nombreCarta: string) {
		if (!mazoSeleccionadoId || !mazoSeleccionado) {
			alert('Selecciona un mazo primero.');
			return;
		}
		const nuevasCartas = [...cartasDelMazo, nombreCarta];
		const res = await fetch(`/api/decks/${mazoSeleccionadoId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cards: nuevasCartas })
		});
		if (res.ok) {
			const updated = await res.json();
			mazos = mazos.map((m) => (m.id === mazoSeleccionadoId ? updated : m));
		}
	}

	async function quitarDelMazo(nombre: string) {
		if (!mazoSeleccionadoId || !mazoSeleccionado) return;
		const lista = [...cartasDelMazo];
		const idx = lista.lastIndexOf(nombre);
		if (idx === -1) return;
		lista.splice(idx, 1);
		const res = await fetch(`/api/decks/${mazoSeleccionadoId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ cards: lista })
		});
		if (res.ok) {
			const updated = await res.json();
			mazos = mazos.map((m) => (m.id === mazoSeleccionadoId ? updated : m));
		}
	}

	async function eliminarMazo() {
		if (!mazoSeleccionadoId) return;
		if (!confirm('¿Eliminar este mazo? Esta acción no se puede deshacer.')) return;
		const res = await fetch(`/api/decks/${mazoSeleccionadoId}`, { method: 'DELETE' });
		if (res.ok) {
			mazos = mazos.filter((m) => m.id !== mazoSeleccionadoId);
			mazoSeleccionadoId = '';
		}
	}

	const FORMATOS = [
		'Standard',
		'Pioneer',
		'Modern',
		'Legacy',
		'Vintage',
		'Commander',
		'Pauper',
		'Casual'
	];

	const manaColors = [
		{ code: 'W', label: 'Blanco', symbol: 'W', cls: 'mana-w' },
		{ code: 'U', label: 'Azul', symbol: 'U', cls: 'mana-u' },
		{ code: 'B', label: 'Negro', symbol: 'B', cls: 'mana-b' },
		{ code: 'R', label: 'Rojo', symbol: 'R', cls: 'mana-r' },
		{ code: 'G', label: 'Verde', symbol: 'G', cls: 'mana-g' }
	];
</script>

<svelte:head>
	<title>AMS · MTG — Card Browser</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
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
				<svg
					class="search-icon"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
						clip-rule="evenodd"
					/>
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
			<a href="/partida" class="btn btn-logout">Modo Partida</a>
			<button class="btn btn-danger" onclick={logout}>Cerrar sesión</button>
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
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="panel-icon"
				aria-hidden="true"
			>
				<path
					d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
				/>
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
								<path
									d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"
								/>
							</svg>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="panel-divider"></div>
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

		{#if !cargando}
			<div class="card-grid">
				{#each cartas as carta}
					{@const estaGirada = cartasGiradas.has(carta.name)}
					{@const imgFront = imagenesCartas[carta.name]}
					{@const imgBack = imagenesCartasBack[carta.name]}
					{@const imgUrl = estaGirada ? imgBack : imgFront}
					{@const tieneDosCaras = !!imgBack}
					<article
						class="card-item"
						onclick={() => verDetalleCompleto(carta)}
						style="cursor:pointer;"
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && verDetalleCompleto(carta)}
					>
						{#if imgUrl}
							<img src={imgUrl} alt={carta.name} loading="lazy" />
						{:else}
							<div class="card-placeholder"><span>{carta.name}</span></div>
						{/if}
						{#if tieneDosCaras}
							<button
								class="card-flip-btn"
								onclick={(e) => {
									e.stopPropagation();
									cartasGiradas = new Set(
										estaGirada
											? [...cartasGiradas].filter((n) => n !== carta.name)
											: [...cartasGiradas, carta.name]
									);
								}}
								title={estaGirada ? 'Ver cara delantera' : 'Girar carta'}
							>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
									<path
										fill-rule="evenodd"
										d="M13.854 2.146a.5.5 0 0 1 0 .708l-1 1a.5.5 0 0 1-.708-.708l.147-.146H11a3 3 0 0 0-3 3v1.5a.5.5 0 0 1-1 0V6a4 4 0 0 1 4-4h1.293l-.147-.146a.5.5 0 0 1 .708-.708zM2.5 7.5A.5.5 0 0 1 3 8v1a3 3 0 0 0 3 3h1.293l-.147-.146a.5.5 0 0 1 .708-.708l1 1a.5.5 0 0 1 0 .708l-1 1a.5.5 0 0 1-.708-.708L7.293 13H6a4 4 0 0 1-4-4V8a.5.5 0 0 1 .5-.5z"
										clip-rule="evenodd"
									/>
								</svg>
							</button>
						{/if}
						<div class="card-actions">
							<button
								class="card-action-btn action-fav"
								onclick={(e) => {
									e.stopPropagation();
									agregarFavorito(carta.name);
								}}
								title="Añadir a favoritos"
							>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
									<path
										d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"
									/>
									<path
										d="M6.97 5.678a.75.75 0 0 1 .638-.428h.784a.75.75 0 0 1 .638.428l.24.484.52-.066a.75.75 0 0 1 .853.588.75.75 0 0 1-.193.676l-.378.368.089.519a.75.75 0 0 1-1.086.79L8 8.56l-.465.479a.75.75 0 0 1-1.086-.79l.089-.52-.378-.367a.75.75 0 0 1 .66-1.264l.52.066.24-.484Z"
									/>
								</svg>
								Favorito
							</button>
							<button
								class="card-action-btn action-deck"
								onclick={(e) => {
									e.stopPropagation();
									agregarAlMazo(carta.name);
								}}
								title="Añadir al mazo"
							>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
									<path
										d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z"
									/>
								</svg>
								Al mazo
							</button>
						</div>
					</article>
				{/each}
			</div>
		{/if}

		<div class="pager">
			<button class="btn btn-ghost pager-btn" onclick={anterior} disabled={puntero === 0}>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
						clip-rule="evenodd"
					/>
				</svg>
				Anterior
			</button>
			<span class="pager-num">Página {numPagina}</span>
			<button class="btn btn-ghost pager-btn" onclick={siguiente}>
				Siguiente
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		</div>
	</section>

	<!-- Sidebar: Mazos -->
	<aside class="panel">
		<div class="panel-header">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="panel-icon"
				aria-hidden="true"
			>
				<path
					d="M5 3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5ZM5 11a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H5ZM11 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V5ZM14 11a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0v-1h-1a1 1 0 1 1 0-2h1v-1a1 1 0 0 1 1-1Z"
				/>
			</svg>
			<h2>Mis Mazos</h2>
			{#if mazos.length > 0}
				<span class="badge">{mazos.length}</span>
			{/if}
		</div>

		<button
			class="btn btn-primary"
			style="width:100%;justify-content:center;margin-bottom:10px;"
			onclick={abrirModal}
		>
			+ Nuevo mazo
		</button>

		{#if mazos.length > 0}
			<div class="deck-selector">
				<label class="field-label" for="deck-select">Mazo activo</label>
				<select id="deck-select" bind:value={mazoSeleccionadoId}>
					<option value="">Seleccionar...</option>
					{#each mazos as m}
						<option value={m.id}>{m.name}{m.format ? ` · ${m.format}` : ''}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if mazoSeleccionado}
			{#if mazoSeleccionado.commander}
				{@const cmds = (() => {
					try {
						return JSON.parse(mazoSeleccionado.commander);
					} catch {
						return [mazoSeleccionado.commander];
					}
				})()}
				{#each cmds as cmd}
					<p class="deck-meta">⚔ {cmd}</p>
				{/each}
			{/if}
			{#if mazoSeleccionado.description}
				<p class="deck-meta deck-desc">{mazoSeleccionado.description}</p>
			{/if}
			<div class="deck-count">
				{cartasDelMazo.length}
				{cartasDelMazo.length === 1 ? 'carta' : 'cartas'}
			</div>
			{#if cartasDelMazo.length === 0}
				<p class="empty-hint">Este mazo está vacío.</p>
			{:else}
				<div class="deck-count-row">
					<a href="/mazo/{mazoSeleccionadoId}" class="btn btn-ghost ver-mazo-btn">Ver mazo</a>
				</div>
				<ul class="item-list">
					{#each cartasDelMazoAgrupadas as { nombre, cantidad } (nombre)}
						<li class="item-row">
							<span class="item-name">{cantidad > 1 ? `${nombre} ×${cantidad}` : nombre}</span>
							<button
								class="btn-icon btn-remove"
								onclick={() => quitarDelMazo(nombre)}
								title="Quitar una copia"
							>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
									<path
										d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"
									/>
								</svg>
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			<button
				class="btn btn-ghost"
				style="width:100%;justify-content:center;margin-top:8px;color:var(--danger);border-color:rgba(224,67,74,0.3);"
				onclick={eliminarMazo}
			>
				Eliminar mazo
			</button>
		{/if}
	</aside>
</main>

<!-- Detail overlay -->
{#if cartaSeleccionada}
	<div class="detalle-overlay" role="dialog" aria-modal="true" onclick={cerrarDetalle}>
		<div class="detalle-panel" onclick={(e) => e.stopPropagation()}>
			<button class="detalle-cerrar" onclick={cerrarDetalle} title="Cerrar">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
					<path
						d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"
					/>
				</svg>
			</button>
			<div class="detalle-body">
				{#if cartaSeleccionada.image_uris?.png || cartaSeleccionada.card_faces?.[0]?.image_uris?.png}
					<img
						class="detalle-img"
						src={cartaSeleccionada.image_uris?.png ??
							cartaSeleccionada.card_faces?.[0]?.image_uris?.png}
						alt={cartaSeleccionada.name}
					/>
				{/if}
				<div class="detalle-info">
					<h2 class="detalle-nombre">{cartaSeleccionada.name}</h2>
					{#if cartaSeleccionada.mana_cost}
						<div class="detalle-fila">
							<span class="detalle-label">Coste de maná</span>
							<span class="detalle-valor mana">{cartaSeleccionada.mana_cost}</span>
						</div>
					{/if}
					{#if cartaSeleccionada.type_line}
						<div class="detalle-fila">
							<span class="detalle-label">Tipo</span>
							<span class="detalle-valor">{cartaSeleccionada.type_line}</span>
						</div>
					{/if}
					{#if cartaSeleccionada.oracle_text}
						<div class="detalle-fila">
							<span class="detalle-label">Texto</span>
							<span class="detalle-valor oracle">{cartaSeleccionada.oracle_text}</span>
						</div>
					{/if}
					{#if cartaSeleccionada.power != null && cartaSeleccionada.toughness != null}
						<div class="detalle-fila">
							<span class="detalle-label">Fuerza / Resistencia</span>
							<span class="detalle-valor"
								>{cartaSeleccionada.power} / {cartaSeleccionada.toughness}</span
							>
						</div>
					{/if}
					{#if cartaSeleccionada.rarity}
						<div class="detalle-fila">
							<span class="detalle-label">Rareza</span>
							<span class="detalle-valor rarity-{cartaSeleccionada.rarity}"
								>{cartaSeleccionada.rarity}</span
							>
						</div>
					{/if}
					{#if cartaSeleccionada.set_name}
						<div class="detalle-fila">
							<span class="detalle-label">Edición</span>
							<span class="detalle-valor">{cartaSeleccionada.set_name}</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Modal: Nuevo Mazo -->
{#if modalAbierto}
	<div class="modal-overlay" role="dialog" aria-modal="true">
		<div class="modal">
			<div class="modal-header">
				<h2>Nuevo Mazo</h2>
				<button class="btn-icon btn-remove" title="Cerrar" onclick={() => (modalAbierto = false)}>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
						<path
							d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"
						/>
					</svg>
				</button>
			</div>

			<div class="modal-body">
				<div class="form-field">
					<label class="field-label" for="modal-nombre">Nombre *</label>
					<input id="modal-nombre" type="text" bind:value={modalNombre} placeholder="Mi mazo..." />
				</div>

				<div class="form-field">
					<label class="field-label" for="modal-formato">Formato</label>
					<select id="modal-formato" bind:value={modalFormato}>
						<option value="">Sin especificar</option>
						{#each FORMATOS as f}
							<option value={f}>{f}</option>
						{/each}
					</select>
				</div>

				<div class="form-field">
					<label class="field-label" for="modal-desc">Descripción</label>
					<textarea
						id="modal-desc"
						bind:value={modalDescripcion}
						placeholder="Estrategia, notas..."
						rows="2"
					></textarea>
				</div>

				<div class="form-field">
					<span class="field-label">Colores de identidad</span>
					<div class="color-picker">
						{#each manaColors as m}
							<button
								class="mana-pip {m.cls} color-toggle"
								class:active={modalColores.includes(m.code)}
								onclick={() => toggleColorModal(m.code)}
								title={m.label}
							>
								<span class="pip-symbol">{m.symbol}</span>
							</button>
						{/each}
					</div>
				</div>

				{#if COMMANDER_FORMATS.includes(modalFormato)}
					<div class="form-field">
						<label class="field-label" for="modal-comandante">
							Comandante
							<span class="field-hint">— puedes añadir varios (Partner, Background...)</span>
						</label>

						{#if modalComandantes.length > 0}
							<ul class="commander-list">
								{#each modalComandantes as cmd, i}
									<li class="commander-tag">
										<span>{cmd}</span>
										<button onclick={() => quitarComandante(i)} title="Quitar">×</button>
									</li>
								{/each}
							</ul>
						{/if}

						<div class="autocomplete-wrap">
							<input
								id="modal-comandante"
								type="text"
								value={modalComandanteInput}
								oninput={(e) => buscarComandante((e.target as HTMLInputElement).value)}
								placeholder="Buscar y seleccionar comandante..."
								class:input-error={!!modalComandanteError}
							/>
							{#if modalComandanteSugerencias.length > 0}
								<ul class="autocomplete-list">
									{#each modalComandanteSugerencias as sug}
										<li>
											<button onclick={() => agregarComandante(sug)}>{sug}</button>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
						{#if modalComandanteError}
							<p class="field-error">{modalComandanteError}</p>
						{/if}
					</div>
				{/if}

				<div class="form-field">
					<label class="field-label" for="modal-import">
						Importar lista
						<span class="field-hint">— opcional, cualquier formato (Moxfield, Arena, MTGO...)</span>
					</label>
					<textarea
						id="modal-import"
						class="import-textarea"
						bind:value={modalImportText}
						placeholder="1 Lightning Bolt&#10;4 Counterspell&#10;..."
						rows="5"
					></textarea>
				</div>
			</div>

			<div class="modal-footer">
				<button class="btn btn-ghost" onclick={() => (modalAbierto = false)}>Cancelar</button>
				<button
					class="btn btn-primary"
					onclick={confirmarCrearMazo}
					disabled={!modalNombre.trim() || modalCargando}
				>
					{modalCargando ? 'Creando...' : 'Crear Mazo →'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ── Design tokens ─────────────────────────────────────────────── */
	:global(:root) {
		--bg: #0c0c10;
		--surface: #14141c;
		--surface-2: #1c1c28;
		--surface-3: #24243200;
		--border: #2a2a38;
		--border-focus: #6d5acd;

		--text-primary: #f0eff6;
		--text-secondary: #8e8da8;
		--text-muted: #5a596e;

		--accent: #7c5cf6;
		--accent-light: #9b7cff;
		--accent-dim: rgba(124, 92, 246, 0.15);

		--gold: #c9a840;
		--gold-dim: rgba(201, 168, 64, 0.18);

		--danger: #e0434a;
		--danger-dim: rgba(224, 67, 74, 0.15);

		--green: #3db37a;
		--green-dim: rgba(61, 179, 122, 0.18);

		--radius-sm: 6px;
		--radius: 10px;
		--radius-lg: 14px;

		--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
		--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.55);
		--shadow-lg: 0 12px 36px rgba(0, 0, 0, 0.7);

		--font: 'Inter', system-ui, -apple-system, sans-serif;
	}

	/* ── Reset / Base ──────────────────────────────────────────────── */
	:global(*) {
		box-sizing: border-box;
	}

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
		transition:
			background 0.15s,
			border-color 0.15s,
			box-shadow 0.15s;
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

	.mana-w .pip-symbol {
		background: #c8b47c;
		color: #1a1000;
	}
	.mana-u .pip-symbol {
		background: #2c6fad;
	}
	.mana-b .pip-symbol {
		background: #48484e;
	}
	.mana-r .pip-symbol {
		background: #c93c1c;
	}
	.mana-g .pip-symbol {
		background: #2e7d4f;
	}
	.mana-clear .pip-symbol {
		background: var(--surface-3);
		border: 1px solid var(--border);
		color: var(--text-secondary);
		font-size: 12px;
	}

	.mana-pip:hover {
		background: var(--surface-2);
		border-color: var(--border-focus);
	}

	.mana-pip:hover .pip-label {
		color: var(--text-primary);
	}

	.mana-w.active {
		background: rgba(200, 180, 124, 0.12);
		border-color: #c8b47c;
	}
	.mana-u.active {
		background: rgba(44, 111, 173, 0.18);
		border-color: #2c6fad;
	}
	.mana-b.active {
		background: rgba(72, 72, 78, 0.25);
		border-color: #888;
	}
	.mana-r.active {
		background: rgba(201, 60, 28, 0.18);
		border-color: #c93c1c;
	}
	.mana-g.active {
		background: rgba(46, 125, 79, 0.18);
		border-color: #2e7d4f;
	}
	.mana-clear.active {
		background: var(--accent-dim);
		border-color: var(--accent);
	}

	.mana-pip.active .pip-label {
		color: var(--text-primary);
	}

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
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 16px;
		position: sticky;
		top: 97px;
		max-height: calc(100vh - 97px - 16px);
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
		margin-top: 15px;
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
	.pager-num {
		font-size: 13px;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.pager {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: 16px;
		margin-top: 32px;
		padding-bottom: 24px;
	}

	.pager-btn {
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
		to {
			transform: rotate(360deg);
		}
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
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease,
			border-color 0.2s;
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

	/* Flip button for double-faced cards */
	.card-flip-btn {
		position: absolute;
		top: 8px;
		left: 8px;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: rgba(8, 8, 14, 0.75);
		color: #e8d5a3;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		transition:
			opacity 0.2s ease,
			background 0.15s ease;
		z-index: 5;
		padding: 0;
	}

	.card-flip-btn svg {
		width: 16px;
		height: 16px;
	}

	.card-item:hover .card-flip-btn {
		opacity: 1;
	}

	.card-flip-btn:hover {
		background: rgba(139, 92, 246, 0.85);
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
		background: linear-gradient(to top, rgba(8, 8, 14, 0.92) 60%, transparent);
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

	/* ── Card placeholder ──────────────────────────────────────────── */
	.card-placeholder {
		width: 100%;
		aspect-ratio: 488 / 680;
		background: var(--surface-2);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12px;
		text-align: center;
		font-size: 11px;
		color: var(--text-muted);
	}

	.deck-count-row {
		margin-bottom: 8px;
	}

	.ver-mazo-btn {
		width: 100%;
		justify-content: center;
		font-size: 11px;
	}

	.deck-meta {
		font-size: 11px;
		color: var(--text-secondary);
		margin: 0 0 4px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.deck-desc {
		font-style: italic;
		color: var(--text-muted);
	}

	/* ── Modal ──────────────────────────────────────────────────────── */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		padding: 16px;
	}

	.modal {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		width: 100%;
		max-width: 440px;
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
		max-height: 90vh;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.modal-body {
		padding: 20px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 14px 20px;
		border-top: 1px solid var(--border);
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	:global(textarea) {
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text-primary);
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		font-family: var(--font);
		font-size: 13px;
		outline: none;
		resize: vertical;
		transition: border-color 0.15s;
		width: 100%;
		box-sizing: border-box;
	}

	:global(textarea:focus) {
		border-color: var(--border-focus);
	}

	.color-picker {
		display: flex;
		gap: 6px;
	}

	.color-toggle {
		padding: 4px 6px;
	}

	.autocomplete-wrap {
		display: flex;
		flex-direction: column;
	}

	.autocomplete-list {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-top: none;
		border-radius: 0 0 var(--radius-sm) var(--radius-sm);
		list-style: none;
		margin: 0;
		padding: 4px 0;
	}

	.autocomplete-list li button {
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 7px 12px;
		font-size: 12px;
		color: var(--text-primary);
		cursor: pointer;
		font-family: var(--font);
	}

	.autocomplete-list li button:hover {
		background: var(--accent-dim);
		color: var(--accent-light);
	}

	.field-hint {
		font-weight: 400;
		color: var(--text-muted);
		text-transform: none;
		letter-spacing: 0;
		font-size: 10px;
	}

	.field-error {
		margin: 4px 0 0;
		font-size: 11px;
		color: var(--danger);
	}

	:global(.input-error) {
		border-color: var(--danger) !important;
	}

	.import-textarea {
		width: 100%;
		background: var(--surface-2);
		border: 1px solid var(--border);
		color: var(--text-primary);
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		font-family: 'SF Mono', 'Consolas', monospace;
		font-size: 12px;
		line-height: 1.6;
		resize: vertical;
		outline: none;
		transition: border-color 0.15s;
	}
	.import-textarea:focus {
		border-color: var(--border-focus);
	}

	.commander-list {
		list-style: none;
		padding: 0;
		margin: 0 0 6px;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.commander-tag {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: var(--accent-dim);
		border: 1px solid rgba(124, 92, 246, 0.3);
		border-radius: 20px;
		padding: 3px 10px 3px 12px;
		font-size: 12px;
		color: var(--accent-light);
	}

	.commander-tag button {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 14px;
		line-height: 1;
		padding: 0;
		display: flex;
		align-items: center;
	}

	/* ── Detail overlay ────────────────────────────────────────────── */
	.detalle-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.78);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 300;
		padding: 20px;
	}
	.detalle-panel {
		background: linear-gradient(160deg, #1a1926, var(--surface));
		border: 1px solid rgba(124, 92, 246, 0.25);
		border-radius: var(--radius-lg);
		box-shadow:
			var(--shadow-lg),
			0 0 40px rgba(124, 92, 246, 0.12);
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
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
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
</style>
