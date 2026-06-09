<script lang="ts">
	import { onMount } from 'svelte';

	interface Jugador {
		id: number;
		nombre: string;
		comandante: string;
		foto: string;
		vida: number;
		veneno: number;
		monarca: boolean;
		tax: number;
		eliminado: boolean;
		cmdDmg: Record<number, number>;
	}

	let jugadores: Jugador[] = $state([]);
	let logPartida: string[] = $state([]);
	let logOpen = $state(false);

	// Setup form
	let nombreJugador = $state('');
	let nombreComandante = $state('');
	let vidasIniciales = $state(40);
	let comandanteSeleccionado = $state({ name: '', art: '' });
	let searchResults: any[] = $state([]);
	let showResults = $state(false);

	// Overlay
	let overlayVisible: boolean = $state(false);
	let overlayType: 'dice' | 'coin' | null = $state(null);
	let overlayResult: string | number = $state('');
	let spinning: boolean = $state(false);
	let overlayFinal: boolean = $state(false);

	// Long-press state
	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let pressInterval: ReturnType<typeof setInterval> | null = null;
	let vidaAlEmpezar = 0;
	let cambiandoId = -1;

	onMount(() => {
		jugadores = JSON.parse(localStorage.getItem('mtg_players') || '[]');
	});

	function addLog(msg: string) {
		const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		logPartida = [`[${time}] ${msg}`, ...logPartida].slice(0, 60);
	}

	async function buscarComandante(query: string) {
		if (query.length < 2) { showResults = false; return; }
		try {
			const res = await fetch(
				`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}+is%3Acommander`
			);
			const data = await res.json();
			if (data.data) {
				searchResults = data.data.slice(0, 8);
				showResults = true;
			}
		} catch { /* silencioso */ }
	}

	function seleccionarComandante(card: any) {
		comandanteSeleccionado = {
			name: card.name,
			art: card.image_uris?.art_crop ?? card.card_faces?.[0]?.image_uris?.art_crop ?? ''
		};
		nombreComandante = card.name;
		showResults = false;
	}

	function agregarJugador() {
		const nom = nombreJugador.trim();
		if (!nom) return;
		const nuevo: Jugador = {
			id: Date.now(),
			nombre: nom,
			comandante: comandanteSeleccionado.name || 'Sin Comandante',
			foto: comandanteSeleccionado.art,
			vida: vidasIniciales,
			veneno: 0,
			monarca: false,
			tax: 0,
			eliminado: false,
			cmdDmg: {}
		};
		jugadores = [...jugadores, nuevo];
		addLog(`${nom} se une con ${vidasIniciales} vidas.`);
		nombreJugador = '';
		nombreComandante = '';
		comandanteSeleccionado = { name: '', art: '' };
		guardar();
	}

	function quitarJugador(id: number) {
		jugadores = jugadores.filter((j) => j.id !== id);
		guardar();
	}

	function cambiarVida(id: number, cantidad: number) {
		jugadores = jugadores.map((j) => {
			if (j.id !== id || j.eliminado) return j;
			const nuevaVida = Math.max(0, j.vida + cantidad);
			const eliminado = nuevaVida <= 0;
			return { ...j, vida: nuevaVida, eliminado };
		});
	}

	function iniciarCambio(id: number, cantidad: number) {
		const j = jugadores.find((x) => x.id === id);
		if (!j || cambiandoId !== -1) return;
		vidaAlEmpezar = j.vida;
		cambiandoId = id;
		cambiarVida(id, cantidad);
		pressTimer = setTimeout(() => {
			pressInterval = setInterval(() => cambiarVida(id, cantidad), 90);
		}, 400);
	}

	function detenerCambio(id: number) {
		if (cambiandoId !== id) return;
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
		if (pressInterval) { clearInterval(pressInterval); pressInterval = null; }
		cambiandoId = -1;
		const j = jugadores.find((x) => x.id === id);
		if (!j) return;
		const diff = j.vida - vidaAlEmpezar;
		if (diff !== 0) {
			addLog(`${j.nombre}: ${diff > 0 ? '+' : ''}${diff} vida → ${j.vida}`);
			if (j.eliminado) addLog(`${j.nombre} ha sido derrotado.`);
		}
		guardar();
	}

	function cambiarVeneno(id: number, cant: number) {
		jugadores = jugadores.map((j) => {
			if (j.id !== id || j.eliminado) return j;
			const veneno = Math.max(0, Math.min(10, j.veneno + cant));
			const eliminado = veneno >= 10;
			if (eliminado && !j.eliminado) addLog(`${j.nombre} muere por veneno (${veneno}/10).`);
			return { ...j, veneno, eliminado: eliminado || j.eliminado, vida: eliminado ? 0 : j.vida };
		});
		guardar();
	}

	function serMonarca(id: number) {
		jugadores = jugadores.map((j) => ({ ...j, monarca: j.id === id }));
		const j = jugadores.find((x) => x.id === id);
		if (j) addLog(`${j.nombre} es el Monarca.`);
		guardar();
	}

	function cambiarTax(id: number) {
		jugadores = jugadores.map((j) => {
			if (j.id !== id) return j;
			const tax = j.tax + 2;
			addLog(`${j.nombre} Tax: +${tax}`);
			return { ...j, tax };
		});
		guardar();
	}

	function cambiarCmdDmg(victimaId: number, agresorId: number, cant: number) {
		jugadores = jugadores.map((j) => {
			if (j.id !== victimaId || j.eliminado) return j;
			const cmdDmg = { ...j.cmdDmg, [agresorId]: (j.cmdDmg[agresorId] || 0) + cant };
			const dmgTotal = cmdDmg[agresorId];
			let vida = j.vida;
			let eliminado: boolean = j.eliminado;
			if (cant > 0) vida = Math.max(0, vida - cant);
			if (dmgTotal >= 21) {
				eliminado = true;
				const a = jugadores.find((x) => x.id === agresorId);
				addLog(`${j.nombre} muere por daño de comandante de ${a?.nombre ?? '?'}.`);
			}
			return { ...j, vida, eliminado, cmdDmg };
		});
		guardar();
	}

	function reiniciarPartida() {
		jugadores = jugadores.map((j) => ({
			...j,
			vida: vidasIniciales,
			veneno: 0,
			monarca: false,
			tax: 0,
			eliminado: false,
			cmdDmg: {}
		}));
		logPartida = [];
		addLog(`--- Reinicio a ${vidasIniciales} vidas ---`);
		guardar();
	}

	function borrarTodo() {
		if (!confirm('¿Borrar todos los jugadores y el historial?')) return;
		jugadores = [];
		logPartida = [];
		localStorage.clear();
	}

	function guardar() {
		localStorage.setItem('mtg_players', JSON.stringify(jugadores));
	}

	// Dice / Coin
	function lanzarDado() {
		const resultado = Math.floor(Math.random() * 20) + 1;
		overlayType = 'dice';
		overlayResult = '?';
		overlayFinal = false;
		overlayVisible = true;
		spinning = true;
		setTimeout(() => {
			spinning = false;
			overlayResult = resultado;
			overlayFinal = true;
			addLog(`D20: ${resultado}`);
			setTimeout(() => { overlayVisible = false; }, 2200);
		}, 1100);
	}

	function lanzarMoneda() {
		const esCruz = Math.random() < 0.5;
		overlayType = 'coin';
		overlayResult = '?';
		overlayFinal = false;
		overlayVisible = true;
		spinning = true;
		setTimeout(() => {
			spinning = false;
			overlayResult = esCruz ? 'CRUZ' : 'CARA';
			overlayFinal = true;
			addLog(`Moneda: ${esCruz ? 'CRUZ' : 'CARA'}`);
			setTimeout(() => { overlayVisible = false; }, 2200);
		}, 1100);
	}

	const vivos = $derived(jugadores.filter((j) => !j.eliminado));
	const ganador = $derived(vivos.length === 1 && jugadores.length > 1 ? vivos[0] : null);
</script>

<svelte:head>
	<title>AMS · MTG — Battle Arena</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<!-- Overlay: dado / moneda -->
{#if overlayVisible}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="overlay" onclick={() => (overlayVisible = false)}>
		<div class="overlay-card {overlayType} {spinning ? 'spin' : ''} {overlayFinal ? 'final' : ''}">
			{#if overlayType === 'coin'}
				<div class="coin-face">{overlayFinal ? (overlayResult as string) : '?'}</div>
			{:else}
				<span class="dice-value">{overlayResult}</span>
			{/if}
		</div>
	</div>
{/if}

<!-- Log lateral -->
<aside class="log-panel" class:log-open={logOpen}>
	<div class="log-header">
		<span>Historial</span>
		<button class="btn-icon-sm" onclick={() => (logOpen = false)}>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
				<path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
			</svg>
		</button>
	</div>
	<div class="log-entries">
		{#each logPartida as entrada}
			<div class="log-entry">{entrada}</div>
		{:else}
			<p class="log-empty">Sin eventos aún.</p>
		{/each}
	</div>
</aside>

<!-- Botón flotante de log -->
<button class="fab-log" onclick={() => (logOpen = !logOpen)} title="Historial de combate">
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
		<path fill-rule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" />
	</svg>
</button>

<!-- HEADER -->
<header class="arena-header">
	<div class="arena-header-inner">
		<div class="brand">
			<a href="/" class="back-link">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
				</svg>
				Buscador
			</a>
			<span class="header-sep">·</span>
			<span class="header-title">Battle Arena</span>
		</div>

		<div class="header-tools">
			<button class="tool-btn" onclick={lanzarDado} title="Lanzar D20">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
					<path d="M12 2v20M2 7l10 5 10-5"/>
				</svg>
				D20
			</button>
			<button class="tool-btn" onclick={lanzarMoneda} title="Lanzar moneda">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z" clip-rule="evenodd" />
				</svg>
				Moneda
			</button>
			<button class="tool-btn tool-btn-success" onclick={reiniciarPartida} title="Reiniciar vidas">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H5.498a.75.75 0 0 0-.75.75v3.498a.75.75 0 0 0 1.5 0v-1.633l.313.315a7 7 0 0 0 11.713-3.138.75.75 0 0 0-1.462-.34Zm-3.184-3.848a7 7 0 0 0-9.875 1.179l-.313.315V7.498a.75.75 0 0 0-1.5 0v3.498a.75.75 0 0 0 .75.75h3.498a.75.75 0 0 0 0-1.5H2.254l.312-.311a5.5 5.5 0 0 1 8.512-.79.75.75 0 1 0 1.05-1.07Z" clip-rule="evenodd" />
				</svg>
				Reiniciar
			</button>
			<button class="tool-btn tool-btn-danger" onclick={borrarTodo} title="Borrar todo">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd" />
				</svg>
				Limpiar
			</button>
		</div>
	</div>
</header>

<!-- SETUP PANEL -->
<div class="setup-panel">
	<div class="setup-inner">
		<div class="setup-field">
			<label class="field-label" for="input-nombre">Jugador</label>
			<input
				id="input-nombre"
				type="text"
				bind:value={nombreJugador}
				placeholder="Nombre..."
				onkeydown={(e) => e.key === 'Enter' && agregarJugador()}
			/>
		</div>

		<div class="setup-field" style="position:relative">
			<label class="field-label" for="input-commander">Comandante</label>
			<input
				id="input-commander"
				type="text"
				bind:value={nombreComandante}
				placeholder="Buscar comandante..."
				oninput={(e) => buscarComandante((e.target as HTMLInputElement).value)}
				onblur={() => setTimeout(() => (showResults = false), 200)}
			/>
			{#if showResults && searchResults.length > 0}
				<ul class="cmd-results">
					{#each searchResults as card}
						<li>
							<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
							<button class="cmd-result-item" onmousedown={() => seleccionarComandante(card)}>
								{card.name}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="setup-field">
			<label class="field-label" for="select-vidas">Vidas iniciales</label>
			<select id="select-vidas" bind:value={vidasIniciales}>
				<option value={40}>40 vidas</option>
				<option value={20}>20 vidas</option>
			</select>
		</div>

		<button class="btn btn-primary" onclick={agregarJugador}>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
				<path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
			</svg>
			Añadir jugador
		</button>
	</div>
</div>

<!-- ARENA -->
<main class="arena">
	{#if jugadores.length === 0}
		<div class="arena-empty">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
				<path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
				<path d="M12 2v20M2 7l10 5 10-5"/>
			</svg>
			<p>Añade jugadores para comenzar la partida.</p>
		</div>
	{/if}

	{#each jugadores as j (j.id)}
		{@const esGanador = ganador?.id === j.id}
		<div
			class="player-card"
			class:eliminado={j.eliminado}
			class:ganador={esGanador}
			class:monarca={j.monarca}
			style={j.foto ? `background-image: url('${j.foto}')` : ''}
		>
			<!-- Overlay de imagen -->
			<div class="card-bg-overlay"></div>

			<!-- Quitar jugador -->
			<button class="btn-remove" onclick={() => quitarJugador(j.id)} title="Quitar jugador">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
					<path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
				</svg>
			</button>

			<!-- Cabecera del jugador -->
			<div class="card-top">
				<div class="player-info">
					<span class="player-name">{j.nombre}</span>
					{#if j.comandante !== 'Sin Comandante'}
						<span class="commander-name">{j.comandante}</span>
					{/if}
				</div>
				<div class="card-badges">
					{#if j.tax > 0}
						<button class="badge-tax" onclick={() => cambiarTax(j.id)} title="Tax acumulado">
							+{j.tax} Tax
						</button>
					{:else}
						<button class="badge-tax badge-tax-inactive" onclick={() => cambiarTax(j.id)} title="Añadir Tax">
							Tax
						</button>
					{/if}
					<button
						class="badge-monarch"
						class:monarch-active={j.monarca}
						onclick={() => serMonarca(j.id)}
						title="Ser el Monarca"
					>
						{j.monarca ? 'Monarca' : 'Corona'}
					</button>
				</div>
			</div>

			<!-- Vida -->
			<div class="life-section">
				<button
					class="life-btn life-minus"
					onmousedown={() => iniciarCambio(j.id, -1)}
					onmouseup={() => detenerCambio(j.id)}
					onmouseleave={() => detenerCambio(j.id)}
					ontouchstart={(e) => { e.preventDefault(); iniciarCambio(j.id, -1); }}
					ontouchend={() => detenerCambio(j.id)}
				>−</button>

				<span class="life-number" class:vida-baja={j.vida <= 5 && !j.eliminado}>{j.vida}</span>

				<button
					class="life-btn life-plus"
					onmousedown={() => iniciarCambio(j.id, 1)}
					onmouseup={() => detenerCambio(j.id)}
					onmouseleave={() => detenerCambio(j.id)}
					ontouchstart={(e) => { e.preventDefault(); iniciarCambio(j.id, 1); }}
					ontouchend={() => detenerCambio(j.id)}
				>+</button>
			</div>

			<!-- Trackers -->
			<div class="trackers-row">
				<div class="tracker">
					<span class="tracker-label">Veneno</span>
					<div class="tracker-controls">
						<button class="tracker-btn" onclick={() => cambiarVeneno(j.id, -1)}>−</button>
						<span class="tracker-val" class:veneno-peligro={j.veneno >= 7}>{j.veneno}/10</span>
						<button class="tracker-btn" onclick={() => cambiarVeneno(j.id, 1)}>+</button>
					</div>
				</div>
			</div>

			<!-- Daño de comandante -->
			{#if jugadores.length > 1}
				<div class="cmd-section">
					<span class="cmd-title">Daño de comandante</span>
					{#each jugadores.filter((op) => op.id !== j.id) as agresor}
						<div class="cmd-row">
							<span class="cmd-name">{agresor.nombre}</span>
							<div class="cmd-controls">
								<button class="tracker-btn" onclick={() => cambiarCmdDmg(j.id, agresor.id, -1)}>−</button>
								<span class="cmd-val" class:cmd-peligro={(j.cmdDmg[agresor.id] || 0) >= 18}>
									{j.cmdDmg[agresor.id] || 0}/21
								</span>
								<button class="tracker-btn" onclick={() => cambiarCmdDmg(j.id, agresor.id, 1)}>+</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Estado final -->
			{#if j.eliminado}
				<div class="status-tag tag-eliminado">Derrotado</div>
			{/if}
			{#if esGanador}
				<div class="status-tag tag-ganador">Victoria</div>
			{/if}
		</div>
	{/each}
</main>

<style>
	/* ── Tokens (mismos que +page.svelte) ─────────────────────────── */
	:global(:root) {
		--bg:           #0c0c10;
		--surface:      #14141c;
		--surface-2:    #1c1c28;
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
		--font: 'Inter', system-ui, -apple-system, sans-serif;
	}

	:global(*) { box-sizing: border-box; }

	:global(body) {
		background: var(--bg);
		color: var(--text-primary);
		font-family: var(--font);
		font-size: 14px;
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

	:global(input[type='text']:focus, select:focus) { border-color: var(--border-focus); }
	:global(select option) { background: var(--surface-2); }

	/* ── Header ────────────────────────────────────────────────────── */
	.arena-header {
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.arena-header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 24px;
		max-width: 1600px;
		margin: 0 auto;
		flex-wrap: wrap;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 13px;
		font-weight: 500;
		transition: color 0.15s;
	}

	.back-link:hover { color: var(--text-primary); }

	.back-link svg { width: 16px; height: 16px; }

	.header-sep { color: var(--text-muted); }

	.header-title {
		font-size: 14px;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: 0.03em;
	}

	.header-tools {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.tool-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 7px 12px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text-secondary);
		font-family: var(--font);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.tool-btn svg { width: 14px; height: 14px; }

	.tool-btn:hover {
		background: var(--surface-2);
		color: var(--text-primary);
		border-color: var(--border-focus);
	}

	.tool-btn-success:hover { background: var(--green-dim); color: var(--green); border-color: rgba(61,179,122,0.4); }
	.tool-btn-danger:hover  { background: var(--danger-dim); color: var(--danger); border-color: rgba(224,67,74,0.4); }

	/* ── Buttons genéricos ─────────────────────────────────────────── */
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
		transition: background 0.15s, border-color 0.15s;
		white-space: nowrap;
	}

	.btn svg { width: 14px; height: 14px; }

	.btn-primary {
		background: var(--accent);
		color: #fff;
		border-color: var(--accent);
	}

	.btn-primary:hover {
		background: var(--accent-light);
		border-color: var(--accent-light);
	}

	.btn-icon-sm {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn-icon-sm:hover { background: var(--surface-2); color: var(--text-primary); }
	.btn-icon-sm svg { width: 14px; height: 14px; }

	.field-label {
		display: block;
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-muted);
		margin-bottom: 4px;
	}

	/* ── Setup panel ───────────────────────────────────────────────── */
	.setup-panel {
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		padding: 14px 24px;
	}

	.setup-inner {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		max-width: 1600px;
		margin: 0 auto;
		flex-wrap: wrap;
	}

	.setup-field {
		flex: 1;
		min-width: 160px;
		max-width: 280px;
	}

	.cmd-results {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		margin-top: 4px;
		z-index: 200;
		max-height: 220px;
		overflow-y: auto;
		list-style: none;
		padding: 4px;
	}

	.cmd-result-item {
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 8px 10px;
		border-radius: 4px;
		color: var(--text-primary);
		font-family: var(--font);
		font-size: 13px;
		cursor: pointer;
		transition: background 0.1s;
	}

	.cmd-result-item:hover { background: var(--accent-dim); }

	/* ── Arena grid ────────────────────────────────────────────────── */
	.arena {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 20px;
		padding: 20px 24px;
		max-width: 1600px;
		margin: 0 auto;
	}

	.arena-empty {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80px 24px;
		color: var(--text-muted);
		gap: 16px;
	}

	.empty-icon {
		width: 48px;
		height: 48px;
		opacity: 0.3;
	}

	/* ── Player card ───────────────────────────────────────────────── */
	.player-card {
		position: relative;
		background: var(--surface);
		background-size: cover;
		background-position: center 20%;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 16px;
		overflow: hidden;
		transition: border-color 0.3s, box-shadow 0.3s;
	}

	.player-card.monarca {
		border-color: var(--gold);
		box-shadow: 0 0 20px rgba(201, 168, 64, 0.3);
	}

	.player-card.eliminado {
		opacity: 0.5;
		filter: grayscale(0.7);
	}

	.player-card.ganador {
		border-color: var(--green);
		box-shadow: 0 0 24px rgba(61, 179, 122, 0.35);
		animation: pulse-win 2s ease-in-out infinite;
	}

	@keyframes pulse-win {
		0%, 100% { box-shadow: 0 0 24px rgba(61, 179, 122, 0.35); }
		50%       { box-shadow: 0 0 40px rgba(61, 179, 122, 0.6); }
	}

	.card-bg-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(12,12,16,0.72) 0%, rgba(12,12,16,0.96) 70%);
		pointer-events: none;
		z-index: 0;
	}

	/* Everything inside card needs z-index > 0 */
	.card-top, .life-section, .trackers-row, .cmd-section,
	.status-tag, .btn-remove { position: relative; z-index: 1; }

	.btn-remove {
		position: absolute;
		top: 12px;
		right: 12px;
		width: 26px;
		height: 26px;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: var(--danger-dim);
		color: var(--danger);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-remove:hover { background: var(--danger); color: #fff; }
	.btn-remove svg { width: 13px; height: 13px; }

	.card-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		padding-right: 30px;
		margin-bottom: 12px;
	}

	.player-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.player-name {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-primary);
	}

	.commander-name {
		font-size: 11px;
		color: var(--gold);
		font-weight: 500;
	}

	.card-badges {
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: flex-end;
		flex-shrink: 0;
	}

	.badge-tax {
		background: rgba(214, 51, 132, 0.18);
		color: #d63384;
		border: 1px solid rgba(214, 51, 132, 0.35);
		border-radius: 20px;
		padding: 3px 8px;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		font-family: var(--font);
		transition: all 0.15s;
	}

	.badge-tax:hover { background: rgba(214, 51, 132, 0.35); }
	.badge-tax-inactive { opacity: 0.45; }

	.badge-monarch {
		background: transparent;
		border: 1px solid var(--gold);
		color: var(--gold);
		border-radius: 20px;
		padding: 3px 8px;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		font-family: var(--font);
		transition: all 0.15s;
	}

	.monarch-active {
		background: var(--gold);
		color: #1a1000;
	}

	.badge-monarch:hover { background: var(--gold-dim); }

	/* ── Life counter ──────────────────────────────────────────────── */
	.life-section {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 20px;
		padding: 8px 0 16px;
	}

	.life-number {
		font-size: 5rem;
		font-weight: 800;
		color: var(--text-primary);
		line-height: 1;
		letter-spacing: -2px;
		min-width: 3ch;
		text-align: center;
		transition: color 0.3s;
	}

	.vida-baja { color: var(--danger); }

	.life-btn {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		border: none;
		font-size: 1.8rem;
		font-weight: 300;
		cursor: pointer;
		user-select: none;
		-webkit-user-select: none;
		transition: transform 0.1s, opacity 0.15s;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		font-family: var(--font);
	}

	.life-btn:active { transform: scale(0.9); }

	.life-minus {
		background: var(--danger-dim);
		color: var(--danger);
		border: 1px solid rgba(224,67,74,0.35);
	}

	.life-minus:hover { background: var(--danger); color: #fff; }

	.life-plus {
		background: var(--green-dim);
		color: var(--green);
		border: 1px solid rgba(61,179,122,0.35);
	}

	.life-plus:hover { background: var(--green); color: #fff; }

	/* ── Trackers ──────────────────────────────────────────────────── */
	.trackers-row {
		display: flex;
		gap: 10px;
		background: rgba(0,0,0,0.25);
		border-radius: var(--radius-sm);
		padding: 10px;
		margin-bottom: 10px;
	}

	.tracker {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.tracker-label {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.tracker-controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.tracker-btn {
		width: 26px;
		height: 26px;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-secondary);
		font-size: 1rem;
		cursor: pointer;
		font-family: var(--font);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.1s;
	}

	.tracker-btn:hover { border-color: var(--border-focus); color: var(--text-primary); }

	.tracker-val {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
		min-width: 36px;
		text-align: center;
	}

	.veneno-peligro { color: #00e676; }

	/* ── Commander damage ──────────────────────────────────────────── */
	.cmd-section {
		border-top: 1px solid var(--border);
		padding-top: 10px;
	}

	.cmd-title {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		display: block;
		margin-bottom: 6px;
	}

	.cmd-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: rgba(0,0,0,0.2);
		border-radius: 4px;
		padding: 5px 8px;
		margin-bottom: 4px;
	}

	.cmd-name {
		font-size: 12px;
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100px;
	}

	.cmd-controls {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.cmd-val {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary);
		min-width: 32px;
		text-align: center;
	}

	.cmd-peligro { color: var(--danger); }

	/* ── Status tags ───────────────────────────────────────────────── */
	.status-tag {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		text-align: center;
		padding: 8px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		z-index: 2;
	}

	.tag-eliminado {
		background: rgba(224, 67, 74, 0.25);
		color: var(--danger);
		border-top: 1px solid rgba(224,67,74,0.3);
	}

	.tag-ganador {
		background: rgba(61, 179, 122, 0.25);
		color: var(--green);
		border-top: 1px solid rgba(61,179,122,0.3);
		animation: blink-win 1.2s ease-in-out infinite;
	}

	@keyframes blink-win {
		0%, 100% { opacity: 1; }
		50%       { opacity: 0.65; }
	}

	/* ── Combat log ────────────────────────────────────────────────── */
	.log-panel {
		position: fixed;
		right: -320px;
		top: 0;
		width: 300px;
		height: 100%;
		background: var(--surface);
		border-left: 1px solid var(--border);
		z-index: 5000;
		transition: right 0.3s ease;
		display: flex;
		flex-direction: column;
	}

	.log-open { right: 0; }

	.log-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		border-bottom: 1px solid var(--border);
		font-size: 13px;
		font-weight: 600;
		flex-shrink: 0;
	}

	.log-entries {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}

	.log-entry {
		font-size: 12px;
		font-family: 'SF Mono', 'Consolas', monospace;
		color: var(--text-secondary);
		padding: 8px 6px;
		border-bottom: 1px solid rgba(255,255,255,0.04);
		line-height: 1.4;
	}

	.log-empty {
		font-size: 12px;
		color: var(--text-muted);
		text-align: center;
		margin-top: 24px;
	}

	/* ── FAB log ───────────────────────────────────────────────────── */
	.fab-log {
		position: fixed;
		bottom: 24px;
		right: 24px;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--accent);
		color: #fff;
		border: none;
		cursor: pointer;
		z-index: 4999;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--shadow-md, 0 4px 16px rgba(0,0,0,0.55));
		transition: background 0.15s, transform 0.15s;
	}

	.fab-log:hover { background: var(--accent-light); transform: scale(1.08); }
	.fab-log svg { width: 20px; height: 20px; }

	/* ── Dice / Coin overlay ───────────────────────────────────────── */
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.8);
		backdrop-filter: blur(6px);
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.overlay-card {
		width: 140px;
		height: 140px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 20px;
		font-weight: 800;
		position: relative;
		transform-style: preserve-3d;
	}

	.overlay-card.dice {
		background: #4a2fd4;
		border: 4px solid #fff;
		box-shadow: 0 0 40px #4a2fd4;
	}

	.overlay-card.coin {
		border-radius: 50%;
		background: linear-gradient(135deg, #f0c040, #b8860b);
		border: 6px solid #b8860b;
		box-shadow: 0 0 30px rgba(240,192,64,0.5);
	}

	.dice-value {
		font-size: 4rem;
		color: #fff;
		line-height: 1;
	}

	.coin-face {
		font-size: 1.4rem;
		font-weight: 800;
		color: #4a3000;
	}

	.overlay-card.spin {
		animation: spin3d 1.1s cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards;
	}

	@keyframes spin3d {
		from { transform: rotateX(0deg) rotateY(0deg); }
		to   { transform: rotateX(1440deg) rotateY(1440deg); }
	}

	.overlay-card.final {
		animation: land 0.3s ease-out;
	}

	@keyframes land {
		from { transform: scale(1.3); }
		to   { transform: scale(1); }
	}
</style>
