<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	//$state es el PROTAGONISTA: Es el dato original. Tú decides cuándo cambia, tú lo modificas directamente.
	//$derived es el ESPECTADOR: Solo mira. Él nunca cambia el valor por sí mismo; simplemente "calcula" el resultado basándose en lo que dice el protagonista.

	//a state le asignas algo, a derived  le asignas por ejemplo (precio * 0,21) y ya ella te va dando los resultados, es para calculos o logica
	let { data } = $props();

	// 1. $state: Declaramos variables que Svelte va a "vigilar".
    // Si cambian, la interfaz se actualiza sola.

	let deckName = $state('');
	let mazos: Record<string, string[]> = $state({});
	let cartasDatos: Record<string, any> = $state({});
	let cargando = $state(true);
	let busquedaTexto = $state('');
	let resultadosBusqueda: any[] = $state([]);
	let buscando = $state(false);
	let editandoNombre = $state(false);
	let nuevoNombreInput = $state('');
	let cartaSeleccionada = $state<any>(null);

	function verDetalle(carta: any) { cartaSeleccionada = carta; }
	function cerrarDetalle() { cartaSeleccionada = null; }
	
	// 1. $derived está "escuchando" constantemente los cambios en la variable 'mazos'.
	// Si 'mazos' cambia (por ejemplo, si añades o quitas una carta), 
	// Svelte vuelve a ejecutar automáticamente esta lógica.

	// 'cartasEnMazo' siempre tendrá el valor actualizado de la lista de cartas,
	// o un array vacío [] si 'mazos[deckName]' aún no existe.
	const cartasEnMazo = $derived(mazos[deckName] || []);

	// 2. 'totalCartas' depende directamente de 'cartasEnMazo'.
	// Como 'cartasEnMazo' ya es reactivo (gracias a la línea anterior),
	// Svelte sabe que cuando 'cartasEnMazo' cambie, 'totalCartas' también debe cambiar.
	const totalCartas = $derived(cartasEnMazo.length);

	//derived.by es para funciones

	const cartasAgrupadas = $derived.by(() => {
    // 1. Inicializamos un objeto vacío para contar las cartas
    const conteo: Record<string, number> = {};

    // 2. Bucle: recorremos el array de cartas
    // Svelte sabe que si 'mazos[deckName]' cambia, esto debe ejecutarse de nuevo.
    for (const c of mazos[deckName] || []) {
        conteo[c] = (conteo[c] || 0) + 1; // Sumamos 1 cada vez que aparece la carta 'c'
    }

    // 3. Transformación y Orden:
    // Convertimos el objeto a un array de objetos { nombre, cantidad }
    // y lo ordenamos alfabéticamente.
    return Object.entries(conteo)
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
	});

	onMount(async () => {
		deckName = data.nombre;
		nuevoNombreInput = data.nombre;
		mazos = JSON.parse(localStorage.getItem('mtg_mazos') || '{}');
		if (!(data.nombre in mazos)) {
			goto('/');
			return;
		}
		await cargarDatosCartas();
	});

	async function cargarDatosCartas() {
		cargando = true;
		const nombres = [...new Set(mazos[deckName] || [])];
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

	function agregarCopia(nombreCarta: string) {
		mazos = { ...mazos, [deckName]: [...(mazos[deckName] || []), nombreCarta] };
		localStorage.setItem('mtg_mazos', JSON.stringify(mazos));
	}

	function quitarCopia(nombreCarta: string) {
		const lista = [...(mazos[deckName] || [])];
		const idx = lista.lastIndexOf(nombreCarta);
		if (idx !== -1) lista.splice(idx, 1);
		mazos = { ...mazos, [deckName]: lista };
		localStorage.setItem('mtg_mazos', JSON.stringify(mazos));
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
		mazos = { ...mazos, [deckName]: [...(mazos[deckName] || []), carta.name] };
		localStorage.setItem('mtg_mazos', JSON.stringify(mazos));
		if (!cartasDatos[carta.name]) {
			cartasDatos = { ...cartasDatos, [carta.name]: carta };
		}
	}

	function eliminarMazo() {
		if (!confirm(`¿Eliminar el mazo "${deckName}"? Esta acción no se puede deshacer.`)) return;
		const m = { ...mazos };
		delete m[deckName];
		localStorage.setItem('mtg_mazos', JSON.stringify(m));
		goto('/');
	}

	function guardarNombre() {
		const nuevo = nuevoNombreInput.trim();
		if (!nuevo || nuevo === deckName) {
			editandoNombre = false;
			return;
		}
		if (mazos[nuevo]) {
			alert('Ya existe un mazo con ese nombre.');
			return;
		}
		const m = { ...mazos };
		m[nuevo] = m[deckName];
		delete m[deckName];
		localStorage.setItem('mtg_mazos', JSON.stringify(m));
		goto(`/mazo/${encodeURIComponent(nuevo)}`);
	}
</script>

<svelte:head>
	<title>{deckName} — AMS MTG</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<!-- HEADER -->
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
						nuevoNombreInput = deckName;
						editandoNombre = true;
					}}
					title="Haz clic para renombrar"
				>
					<h1 class="deck-name">{deckName}</h1>
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

		<span class="card-count-badge"
			>{totalCartas}
			{totalCartas === 1 ? 'carta' : 'cartas'}</span
		>

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
</header>

<!-- MAIN LAYOUT -->
<main class="deck-layout">
	<!-- Card Grid -->
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
							<img src={imgUrl} alt={nombre} loading="lazy" onclick={() => carta && verDetalle(carta)} style="cursor:pointer;" />
						{:else}
							<div class="card-placeholder">
								<span>{nombre}</span>
							</div>
						{/if}

						<div class="card-overlay">
							<div class="qty-controls">
								<button
									class="qty-btn qty-minus"
									onclick={() => quitarCopia(nombre)}
									title="Quitar una copia"
								>
									−
								</button>
								<span class="qty-num">×{cantidad}</span>
								<button
									class="qty-btn qty-plus"
									onclick={() => agregarCopia(nombre)}
									title="Añadir una copia"
								>
									+
								</button>
							</div>
							{#if carta}
								<div class="card-meta">
									{#if carta.mana_cost}
										<span class="meta-mana">{carta.mana_cost}</span>
									{/if}
									<span class="meta-type">{carta.type_line?.split('—')[0]?.trim() || ''}</span>
								</div>
							{/if}
						</div>

						{#if cantidad > 1}
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
						<path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
					</svg>
				</button>
				<div class="detalle-body">
					{#if img}
						<img class="detalle-img" src={img} alt={cartaSeleccionada.name} />
					{/if}
					<div class="detalle-info">
						<h2 class="detalle-nombre">{cartaSeleccionada.name}</h2>
						{#if cartaSeleccionada.mana_cost}
							<div class="detalle-fila">
								<span class="detalle-label">Coste</span>
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
						{#if cartaSeleccionada.power}
							<div class="detalle-fila">
								<span class="detalle-label">F/R</span>
								<span class="detalle-valor">{cartaSeleccionada.power}/{cartaSeleccionada.toughness}</span>
							</div>
						{/if}
						{#if cartaSeleccionada.loyalty}
							<div class="detalle-fila">
								<span class="detalle-label">Lealtad</span>
								<span class="detalle-valor">{cartaSeleccionada.loyalty}</span>
							</div>
						{/if}
						<div class="detalle-fila">
							<span class="detalle-label">Rareza</span>
							<span class="detalle-valor rarity-{cartaSeleccionada.rarity}">{cartaSeleccionada.rarity}</span>
						</div>
						{#if cartaSeleccionada.set_name}
							<div class="detalle-fila">
								<span class="detalle-label">Set</span>
								<span class="detalle-valor">{cartaSeleccionada.set_name}</span>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Search Sidebar -->
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
			<div class="search-loading">
				<div class="loader-ring loader-sm"></div>
			</div>
		{:else if resultadosBusqueda.length > 0}
			<ul class="result-list">
				{#each resultadosBusqueda as carta}
					{@const imgUrl = getImageUrl(carta)}
					<li class="result-item">
						{#if imgUrl}
							<img class="result-thumb" src={imgUrl} alt={carta.name} loading="lazy" />
						{/if}
						<div class="result-info">
							<span class="result-name">{carta.name}</span>
							<span class="result-type">{carta.type_line?.split('—')[0]?.trim() || ''}</span>
						</div>
						<button
							class="btn-add"
							onclick={() => agregarDesdeBusqueda(carta)}
							title="Añadir al mazo"
						>
							+
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</aside>
</main>

<style>
	/* ── Tokens ─────────────────────────────────────────────────────── */
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
		--shadow-lg: 0 12px 36px rgba(0, 0, 0, 0.7);
		--font: 'Inter', system-ui, -apple-system, sans-serif;
	}

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
	:global(input[type='text']) {
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
	:global(input[type='text']:focus) {
		border-color: var(--border-focus);
	}

	/* ── Buttons ────────────────────────────────────────────────────── */
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
			border-color 0.15s;
		white-space: nowrap;
		text-decoration: none;
	}
	.btn svg {
		width: 14px;
		height: 14px;
	}
	.btn-primary {
		background: var(--accent);
		color: #fff;
		border-color: var(--accent);
	}
	.btn-primary:hover {
		background: var(--accent-light);
	}
	.btn-ghost {
		background: transparent;
		color: var(--text-secondary);
		border-color: var(--border);
	}
	.btn-ghost:hover {
		background: var(--surface-2);
		color: var(--text-primary);
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

	/* ── Header ─────────────────────────────────────────────────────── */
	.deck-header {
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 100;
	}
	.header-inner {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 24px;
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
		padding: 4px 8px;
		transition: border-color 0.15s;
	}
	.deck-name-btn:hover {
		border-color: var(--border);
	}
	.deck-name-btn:hover .edit-icon {
		opacity: 1;
	}
	.deck-name {
		margin: 0;
		font-size: 17px;
		font-weight: 700;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.edit-icon {
		width: 13px;
		height: 13px;
		color: var(--text-muted);
		opacity: 0;
		transition: opacity 0.15s;
		flex-shrink: 0;
	}
	.deck-name-input {
		font-size: 16px;
		font-weight: 700;
		max-width: 300px;
	}
	.card-count-badge {
		background: var(--accent-dim);
		color: var(--accent-light);
		font-size: 12px;
		font-weight: 600;
		padding: 3px 10px;
		border-radius: 20px;
		border: 1px solid rgba(124, 92, 246, 0.3);
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* ── Layout ─────────────────────────────────────────────────────── */
	.deck-layout {
		display: flex;
		align-items: flex-start;
		max-width: 1600px;
		margin: 0 auto;
		min-height: calc(100vh - 57px);
	}

	/* ── Cards section ──────────────────────────────────────────────── */
	.cards-section {
		flex: 1;
		padding: 20px;
		min-width: 0;
	}
	.centered-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80px 24px;
		gap: 12px;
		color: var(--text-secondary);
	}
	.empty-icon {
		width: 48px;
		height: 48px;
		color: var(--text-muted);
	}
	.empty-title {
		font-size: 16px;
		font-weight: 600;
		margin: 0;
		color: var(--text-secondary);
	}
	.empty-hint {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0;
		text-align: center;
	}
	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 14px;
	}
	.card-item {
		position: relative;
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--surface-2);
		border: 1px solid var(--border);
		transition:
			transform 0.2s,
			box-shadow 0.2s,
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
	.card-placeholder {
		aspect-ratio: 488 / 680;
		background: var(--surface-2);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12px;
		text-align: center;
		font-size: 12px;
		color: var(--text-muted);
	}

	/* Overlay with controls */
	.card-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 10px;
		background: linear-gradient(to top, rgba(8, 8, 14, 0.95) 60%, transparent);
		opacity: 0;
		transition: opacity 0.2s;
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-items: center;
	}
	.card-item:hover .card-overlay {
		opacity: 1;
	}
	.qty-controls {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.qty-btn {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		font-size: 16px;
		font-weight: 700;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
	}
	.qty-minus {
		background: var(--danger-dim);
		color: var(--danger);
	}
	.qty-minus:hover {
		background: var(--danger);
		color: #fff;
	}
	.qty-plus {
		background: var(--green-dim);
		color: var(--green);
	}
	.qty-plus:hover {
		background: var(--green);
		color: #fff;
	}
	.qty-num {
		font-size: 14px;
		font-weight: 700;
		color: #fff;
		min-width: 28px;
		text-align: center;
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
		font-weight: 600;
	}
	.meta-type {
		font-size: 10px;
		color: var(--text-secondary);
	}

	/* Quantity badge (top-right corner) */
	.qty-badge {
		position: absolute;
		top: 6px;
		right: 6px;
		background: rgba(8, 8, 14, 0.85);
		color: var(--accent-light);
		font-size: 11px;
		font-weight: 700;
		padding: 2px 7px;
		border-radius: 10px;
		border: 1px solid rgba(124, 92, 246, 0.4);
		backdrop-filter: blur(4px);
	}

	/* ── Search panel ───────────────────────────────────────────────── */
	.search-panel {
		width: 280px;
		flex-shrink: 0;
		background: var(--surface);
		border-left: 1px solid var(--border);
		padding: 16px;
		position: sticky;
		top: 57px;
		max-height: calc(100vh - 57px);
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
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
	}
	.panel-icon {
		width: 14px;
		height: 14px;
		color: var(--accent);
		flex-shrink: 0;
	}
	.search-row {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
	}
	.search-row .btn {
		width: 100%;
		justify-content: center;
	}
	.search-loading {
		display: flex;
		justify-content: center;
		padding: 16px 0;
	}

	/* ── Loader ─────────────────────────────────────────────────────── */
	.loader-ring {
		width: 36px;
		height: 36px;
		border: 3px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
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

	/* ── Search results ─────────────────────────────────────────────── */
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
		gap: 8px;
		padding: 6px 8px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		border: 1px solid var(--border);
		transition: border-color 0.15s;
	}
	.result-item:hover {
		border-color: var(--border-focus);
	}
	.result-thumb {
		width: 36px;
		border-radius: 3px;
		flex-shrink: 0;
		object-fit: cover;
	}
	.result-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.result-name {
		font-size: 12px;
		font-weight: 500;
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
		width: 24px;
		height: 24px;
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
		transition: background 0.15s;
	}
	.btn-add:hover {
		background: var(--green);
		color: #fff;
	}

	/* ── Card detail overlay ───────────────────────────────────────── */
	.detalle-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		padding: 20px;
	}

	.detalle-panel {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		width: 100%;
		max-width: 680px;
		max-height: 90vh;
		overflow-y: auto;
		position: relative;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}

	.detalle-cerrar {
		position: absolute;
		top: 12px;
		right: 12px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s, color 0.15s;
		z-index: 1;
	}

	.detalle-cerrar:hover { background: var(--danger); color: #fff; border-color: var(--danger); }
	.detalle-cerrar svg { width: 14px; height: 14px; }

	.detalle-body {
		display: flex;
		gap: 20px;
		padding: 20px;
	}

	.detalle-img {
		width: 220px;
		flex-shrink: 0;
		border-radius: var(--radius);
		align-self: flex-start;
	}

	.detalle-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-top: 4px;
	}

	.detalle-nombre {
		margin: 0 0 4px;
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.3;
	}

	.detalle-fila { display: flex; flex-direction: column; gap: 2px; }

	.detalle-label {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.detalle-valor { font-size: 13px; color: var(--text-primary); line-height: 1.5; }
	.detalle-valor.mana { color: var(--gold); font-weight: 600; }
	.detalle-valor.oracle { color: var(--text-secondary); white-space: pre-wrap; }

	.rarity-common { color: var(--text-secondary); }
	.rarity-uncommon { color: #a8c4d4; }
	.rarity-rare { color: var(--gold); }
	.rarity-mythic { color: #e87c3e; }
</style>
