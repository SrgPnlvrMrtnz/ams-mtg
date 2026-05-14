<script lang="ts">
	import { onMount } from 'svelte';
	/* El estado $state, esta pendiente de cualquier cambio que se haga en la variable, por lo tanto, gracias a esto,
	se actualiza sola */
	let puntero = $state(0);
	let colorSeleccionado = $state('');
	let textoBusqueda = $state('');
	let numPagina = $state(1);
	let cargando = $state(false);
	let statusMsg = $state('');
	let cartas = $state<any[]>([]);

	let favoritos = $state<string[]>([]);
	let mazos = $state<Record<string, string[]>>({});
	let mazoSeleccionado = $state('');
	let nuevoMazoNombre = $state('');
	let mostrarPanelMazo = $state(false);

	const frasesMagicas = [
		'Invocando hechizos del grimorio...',
		'Canalizando maná de las tierras lejanas...',
		'Consultando el Oráculo de Scryfall...',
		'Invocando criaturas del Multiverso...',
		'Tejiendo los hilos del Éter...',
		'Despertando el poder de los Planeswalkers...',
		'Buscando reliquias en las ruinas de Dominaria...',
		'Preparando tu próxima victoria...',
		'Leyendo los pergaminos antiguos...',
		'Extrayendo energía de las líneas místicas...',
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
				statusMsg = 'El hechizo ha fallado: No hay cartas.';
			} else {
				statusMsg = '';
				cartas = data.data;
			}
		} catch {
			cargando = false;
			statusMsg = 'Interferencia en el plano astral (Error de red).';
		}
	}

	async function cartaAleatoria() {
		cartas = [];
		cargando = true;
		statusMsg = 'Buscando una anomalía temporal...';
		try {
			const res = await fetch('https://api.scryfall.com/cards/random');
			const carta = await res.json();
			cargando = false;
			statusMsg = '';
			cartas = [carta];
		} catch {
			cargando = false;
			statusMsg = 'Interferencia en el plano astral (Error de red).';
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

	function abrirMazoVentanaNueva(){
		//Guardar datos del mazo en localStorage para que la otra ventana pueda leerlos. 
		localStorage.setItem('mazoAVer', JSON.stringify(mazos[mazoSeleccionado]))
		localStorage.setItem('nombreMazo', mazoSeleccionado)

		//Se abre la nueva ventana (creado en un archivo .html a parte)
		window.open('/verMazo', '_blank')
	}


	//para ver el mazo que hemos seleccionado
	function verMazo(){
		
		if(mazoSeleccionado == ''){
			alert('Hechizo fallido! Primero selecciona un mazo de los que hay en la lista.');
			return
		}else{
			mostrarPanelMazo = true;
			abrirMazoVentanaNueva()
		}
	}

	
</script>

<svelte:head>
	<title>Scryfall Magic PRO</title>
</svelte:head>

<header>
	<div class="header-top">
		<h1>Scryfall Magic PRO</h1>
		<a href="/partida" class="btn btn-danger">⚔️ Modo Partida</a>
	</div>

	<div class="search-bar">
		<input type="text" bind:value={textoBusqueda} placeholder="Nombre de la carta..." />
		<button onclick={buscar}>Buscar</button>
		<button class="btn-random" onclick={cartaAleatoria}>Random</button>
	</div>

	<div class="mana-filter">
		{#each [['w','☀️','Blanco'],['u','💧','Azul'],['b','💀','Negro'],['r','🔥','Rojo'],['g','🌳','Verde']] as [color, emoji, label]}
			<button
				class="mana-btn"
				class:active={colorSeleccionado === color}
				title={label}
				onclick={() => seleccionarColor(color)}
			>{emoji}</button>
		{/each}
		<button class="mana-btn" title="Limpiar Filtros" onclick={limpiarFiltros}>🚫</button>
	</div>
</header>

<main class="main-layout">
	<!-- Panel izquierdo: favoritos y paginación -->
	<aside class="side-panel">
		<h3>⭐ Favoritos</h3>
		<ul class="lista-items">
			{#each favoritos as nombre, i}
				<li>
					<span>{nombre}</span>
					<button class="btn-eliminar" onclick={() => eliminarFav(i)}>X</button>
				</li>
			{/each}
		</ul>
		<hr />
		<h3>Navegación</h3>
		<p>Página: <span>{numPagina}</span></p>
		<div class="nav-buttons">
			<button onclick={anterior}>←</button>
			<button onclick={siguiente}>→</button>
		</div>
	</aside>

	<!-- Grid de cartas -->
	<section class="contenedor-wrapper">
		{#if cargando || statusMsg}
			<div class="status-msg-container">
				{#if cargando}
					<div class="spinner"></div>
				{/if}
				<p class="status-msg">{statusMsg}</p>
			</div>
		{/if}
		<div class="contenedor">
			{#each cartas as carta}
				{@const imgUrl = getImageUrl(carta)}
				{#if imgUrl}
					<div class="card-wrapper">
						<img src={imgUrl} alt={carta.name} />
						<button class="btn-fav-card" onclick={() => agregarFavorito(carta.name)}>⭐</button>
						<button class="btn-deck-card" onclick={() => agregarAlMazo(carta.name)}>➕</button>
					</div>
				{/if}
			{/each}
		</div>
	</section>

	<!-- Panel derecho: mazos -->
	<aside class="side-panel">
		<h3>🗃️ Mis Mazos</h3>
		<div class="deck-controls">
			<input type="text" bind:value={nuevoMazoNombre} placeholder="Nombre del mazo..." />
			<button onclick={crearMazo}>Crear</button>
		</div>
		<select bind:value={mazoSeleccionado}>
			<option value="">-- Seleccionar Mazo --</option>
			{#each Object.keys(mazos) as nombre}
				<option value={nombre}>{nombre}</option>
			{/each}
		</select>
		<ul class="lista-items" style="margin-top: 12px;">
			{#each (mazos[mazoSeleccionado] || []) as carta, i}
				<li>
					<span>{carta}</span>
					<button class="btn-eliminar" onclick={() => quitarDelMazo(i)}>X</button>
				</li>
			{/each}
		</ul>
		<!--Ver mazo-->
		<button onclick={verMazo}>Ver Mazo</button>
	</aside>
</main>

<style>

	:global(:root) {
		--primary: #007bff;
		--primary-hover: #0056b3;
		--gold: #ffcc00;
		--green: #28a745;
		--danger: #dc3545;
		--bg-dark: #0d0d0d;
		--bg-panel: #1a1a1a;
		--text: #e0e0e0;
		--shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
	}

	:global(body) {
		background-color: var(--bg-dark);
		color: var(--text);
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		margin: 0;
		line-height: 1.6;
	}

	:global(button) {
		padding: 10px 18px;
		border-radius: 6px;
		border: none;
		background: var(--primary);
		color: white;
		font-weight: bold;
		text-transform: uppercase;
		font-size: 0.8rem;
		letter-spacing: 1px;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	:global(button:hover) {
		background: var(--primary-hover);
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
	}

	:global(button:active) {
		transform: translateY(0);
	}

	:global(input[type='text'], select) {
		background: #222;
		border: 1px solid #444;
		color: white;
		padding: 10px;
		border-radius: 6px;
		outline: none;
	}

	:global(input[type='text']:focus) {
		border-color: var(--primary);
	}

	header {
		background: linear-gradient(180deg, #222, var(--bg-dark));
		padding: 20px;
		text-align: center;
		border-bottom: 1px solid #333;
	}

	.header-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		max-width: 1200px;
		margin: 0 auto;
	}

	.btn-danger {
		background: var(--danger);
		text-decoration: none;
		padding: 10px 18px;
		border-radius: 6px;
		color: white;
		font-weight: bold;
		text-transform: uppercase;
		font-size: 0.8rem;
		letter-spacing: 1px;
	}

	.btn-random {
		background-color: #6f42c1;
	}

	.btn-random:hover {
		background-color: #59339d;
	}

	.search-bar {
		margin-top: 15px;
		display: flex;
		justify-content: center;
		gap: 10px;
	}

	.mana-filter {
		margin-top: 15px;
		display: flex;
		justify-content: center;
		gap: 12px;
	}

	.mana-btn {
		background: #252525;
		font-size: 1.3rem;
		width: 45px;
		height: 45px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid transparent;
		cursor: pointer;
		transition: 0.3s;
		padding: 0;
		text-transform: none;
		letter-spacing: 0;
	}

	.mana-btn:hover {
		transform: scale(1.1);
		background: #333;
	}

	.mana-btn.active {
		border-color: var(--primary);
		box-shadow: 0 0 10px var(--primary);
		background: #333;
	}

	.main-layout {
		display: flex;
		padding: 20px;
		gap: 20px;
		align-items: flex-start;
	}

	.side-panel {
		width: 260px;
		flex-shrink: 0;
		background: var(--bg-panel);
		padding: 15px;
		border-radius: 12px;
		border: 1px solid #333;
		position: sticky;
		top: 20px;
		max-height: 85vh;
		overflow-y: auto;
		box-shadow: var(--shadow);
	}

	.side-panel h3 {
		color: var(--primary);
		margin-top: 0;
		border-bottom: 1px solid #333;
		padding-bottom: 10px;
		font-size: 1rem;
	}

	.status-msg-container {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		min-height: 120px;
		width: 100%;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid rgba(255, 255, 255, 0.1);
		border-top: 4px solid var(--primary);
		border-radius: 50%;
		margin-bottom: 15px;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.status-msg {
		color: var(--primary);
		font-weight: bold;
		font-style: italic;
		text-align: center;
	}

	.contenedor-wrapper {
		flex-grow: 1;
	}

	.contenedor {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 20px;
	}

	.card-wrapper {
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		transition: 0.3s ease;
	}

	.card-wrapper:hover {
		transform: scale(1.05);
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8);
		z-index: 10;
	}

	.card-wrapper img {
		width: 100%;
		display: block;
	}

	.btn-fav-card,
	.btn-deck-card {
		position: absolute;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		bottom: 15px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
		z-index: 5;
		font-size: 1rem;
		text-transform: none;
		letter-spacing: 0;
	}

	.btn-fav-card {
		left: 12px;
		background: var(--gold);
		color: black;
	}

	.btn-deck-card {
		right: 12px;
		background: var(--green);
		color: white;
	}

	.lista-items {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.lista-items li {
		background: #252525;
		margin-bottom: 8px;
		padding: 10px;
		border-radius: 6px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
		border-left: 4px solid var(--primary);
	}

	.btn-eliminar {
		background: var(--danger) !important;
		padding: 2px 8px !important;
		font-size: 0.7rem !important;
	}

	.deck-controls {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 15px;
	}

	.nav-buttons {
		display: flex;
		gap: 10px;
	}

	hr {
		border-color: #333;
		margin: 15px 0;
	}
</style>
