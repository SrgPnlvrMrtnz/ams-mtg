<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();

	let mostrarRegistro = $state(false);

	$effect(() => {
		if (form?.registered) mostrarRegistro = false;
	});
</script>

<div class="contenedor">
	<div class="card">
		<div class="logo">🃏 AMS MTG</div>

		{#if !mostrarRegistro}
			<h2>Iniciar sesión</h2>
			<form method="POST" action="?/login" use:enhance>
				<div class="campo">
					<label for="email">Email</label>
					<input id="email" name="email" type="email" placeholder="tu@email.com" required />
				</div>
				<div class="campo">
					<label for="password">Contraseña</label>
					<input id="password" name="password" type="password" placeholder="••••••••" required />
				</div>
				{#if form?.registered}
					<p class="success">Cuenta creada. Inicia sesión.</p>
				{/if}
				{#if form?.error}
					<p class="error">{form.error}</p>
				{/if}
				<button type="submit" class="btn-primary">Iniciar sesión</button>
			</form>
			<p class="toggle">
				¿No tienes cuenta?
				<button type="button" class="btn-link" onclick={() => (mostrarRegistro = true)}>
					Registrarse
				</button>
			</p>
		{:else}
			<h2>Crear cuenta</h2>
			<form method="POST" action="?/register" use:enhance>
				<div class="campo">
					<label for="reg-email">Email</label>
					<input id="reg-email" name="email" type="email" placeholder="tu@email.com" required />
				</div>
				<div class="campo">
					<label for="reg-password">Contraseña</label>
					<input
						id="reg-password"
						name="password"
						type="password"
						placeholder="Mínimo 8 caracteres"
						required
					/>
				</div>
				<div class="campo">
					<label for="reg-confirm">Confirmar contraseña</label>
					<input
						id="reg-confirm"
						name="confirmPassword"
						type="password"
						placeholder="••••••••"
						required
					/>
				</div>
				{#if form?.error}
					<p class="error">{form.error}</p>
				{/if}
				<button type="submit" class="btn-primary">Crear cuenta</button>
			</form>
			<p class="toggle">
				¿Ya tienes cuenta?
				<button type="button" class="btn-link" onclick={() => (mostrarRegistro = false)}>
					Iniciar sesión
				</button>
			</p>
		{/if}
	</div>
</div>

<style>
	.contenedor {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.card {
		background: var(--bg-panel);
		border: 1px solid #2a2a2a;
		border-radius: 12px;
		padding: 40px 36px;
		width: 100%;
		max-width: 400px;
		box-shadow: var(--shadow);
	}

	.logo {
		text-align: center;
		font-size: 1.4rem;
		font-weight: bold;
		color: var(--gold);
		margin-bottom: 8px;
		letter-spacing: 1px;
	}

	h2 {
		text-align: center;
		margin: 0 0 24px;
		font-size: 1.1rem;
		color: var(--text);
		font-weight: 500;
	}

	.campo {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 16px;
	}

	label {
		font-size: 0.85rem;
		color: #aaa;
	}

	input {
		background: #222;
		border: 1px solid #3a3a3a;
		border-radius: 6px;
		color: var(--text);
		padding: 10px 12px;
		font-size: 0.95rem;
		width: 100%;
		box-sizing: border-box;
		transition: border-color 0.2s;
	}

	input:focus {
		outline: none;
		border-color: var(--primary);
	}

	.btn-primary {
		width: 100%;
		padding: 11px;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.95rem;
		font-weight: bold;
		cursor: pointer;
		margin-top: 4px;
		transition: background 0.2s;
		text-transform: none;
	}

	.btn-primary:hover {
		background: var(--primary-hover);
		transform: none;
	}

	.error {
		color: var(--danger);
		font-size: 0.85rem;
		margin: -4px 0 12px;
	}

	.success {
		color: #4caf50;
		font-size: 0.85rem;
		margin: -4px 0 12px;
	}

	.toggle {
		text-align: center;
		margin-top: 20px;
		font-size: 0.85rem;
		color: #888;
	}

	.btn-link {
		background: none;
		border: none;
		color: var(--primary);
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
		font-weight: normal;
		text-transform: none;
	}

	.btn-link:hover {
		background: none;
		color: var(--primary-hover);
		transform: none;
		box-shadow: none;
	}
</style>
