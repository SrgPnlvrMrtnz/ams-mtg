<script lang="ts">
	interface Message {
		role: 'user' | 'assistant' | 'system';
		content: string;
	}

	const SYSTEM: Message = {
		role: 'system',
		content: 'Eres un asistente experto en Magic: The Gathering. Responde siempre en español.'
	};

	let messages: Message[] = $state([]);
	let input = $state('');
	let loading = $state(false);

	async function send() {
		const text = input.trim();
		if (!text || loading) return;

		messages = [...messages, { role: 'user', content: text }];
		input = '';
		loading = true;

		try {
			const res = await fetch('/api/chatbot', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages: [SYSTEM, ...messages] })
			});
			const data = await res.json();
			if (data.error) {
				messages = [...messages, { role: 'assistant', content: `⚠️ ${data.error}` }];
			} else {
				messages = [...messages, { role: 'assistant', content: data.reply }];
			}
		} catch (err: any) {
			messages = [
				...messages,
				{ role: 'assistant', content: `⚠️ Error de conexión: ${err.message}` }
			];
		} finally {
			loading = false;
		}
	}

	function clear() {
		if (!confirm('¿Borrar la conversación?')) return;
		messages = [];
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

<svelte:head>
	<title>AMS · MTG — Chatbot</title>
</svelte:head>

<div class="chat-page">
	<header class="chat-header">
		<a href="/" class="back-link">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
				<path
					fill-rule="evenodd"
					d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
					clip-rule="evenodd"
				/>
			</svg>
			Buscador
		</a>
		<span class="header-title">Chatbot MTG</span>
		<button class="clear-btn" onclick={clear} title="Nueva conversación">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
				<path
					fill-rule="evenodd"
					d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
					clip-rule="evenodd"
				/>
			</svg>
			Limpiar
		</button>
	</header>

	<div class="chat-body">
		<div class="messages" id="messages-box">
			{#if messages.length === 0}
				<div class="empty-state">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
						/>
					</svg>
					<p>Pregúntame sobre Magic: The Gathering</p>
				</div>
			{/if}

			{#each messages as msg}
				{#if msg.role !== 'system'}
					<div class="message {msg.role}">
						<div class="bubble">{msg.content}</div>
						<span class="label">{msg.role === 'user' ? 'Tú' : 'Groq'}</span>
					</div>
				{/if}
			{/each}

			{#if loading}
				<div class="message assistant">
					<div class="bubble typing">
						<span></span><span></span><span></span>
					</div>
				</div>
			{/if}
		</div>

		<div class="input-area">
			<textarea
				bind:value={input}
				onkeydown={onKeydown}
				placeholder="Escribe tu mensaje... (Enter para enviar)"
				rows="1"
				disabled={loading}
			></textarea>
			<button class="send-btn" onclick={send} disabled={loading || !input.trim()}>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
					<path
						d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z"
					/>
				</svg>
			</button>
		</div>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		background: #0c0c10;
		color: #f0eff6;
		font-family: 'Inter', system-ui, sans-serif;
	}

	.chat-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	/* Header */
	.chat-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 20px;
		background: #14141c;
		border-bottom: 1px solid #2a2a38;
		flex-shrink: 0;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: #8e8da8;
		text-decoration: none;
		font-size: 13px;
		font-weight: 500;
		transition: color 0.15s;
	}

	.back-link:hover {
		color: #f0eff6;
	}
	.back-link svg {
		width: 16px;
		height: 16px;
	}

	.header-title {
		flex: 1;
		font-size: 14px;
		font-weight: 700;
		color: #f0eff6;
	}

	.clear-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 12px;
		border-radius: 6px;
		border: 1px solid #2a2a38;
		background: transparent;
		color: #8e8da8;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.clear-btn svg {
		width: 13px;
		height: 13px;
	}
	.clear-btn:hover {
		background: #1c1c28;
		color: #f0eff6;
		border-color: #5a596e;
	}

	/* Body */
	.chat-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		max-width: 760px;
		width: 100%;
		margin: 0 auto;
		padding: 0 16px 16px;
		min-height: 0;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 20px 0;
		scrollbar-width: thin;
		scrollbar-color: #2a2a38 transparent;
	}

	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: #5a596e;
		padding: 60px 0;
	}

	.empty-state svg {
		width: 48px;
		height: 48px;
		opacity: 0.5;
	}
	.empty-state p {
		font-size: 14px;
	}

	/* Messages */
	.message {
		display: flex;
		flex-direction: column;
		max-width: 80%;
	}

	.message.user {
		align-self: flex-end;
		align-items: flex-end;
	}
	.message.assistant {
		align-self: flex-start;
		align-items: flex-start;
	}

	.bubble {
		padding: 10px 16px;
		border-radius: 18px;
		font-size: 14px;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.message.user .bubble {
		background: #7c5cf6;
		color: #fff;
		border-bottom-right-radius: 4px;
	}

	.message.assistant .bubble {
		background: #1c1c28;
		color: #dde1f0;
		border: 1px solid #2a2a38;
		border-bottom-left-radius: 4px;
	}

	.label {
		font-size: 11px;
		color: #5a596e;
		margin: 4px 6px 0;
	}

	/* Typing */
	.typing {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 14px 18px;
	}

	.typing span {
		display: inline-block;
		width: 7px;
		height: 7px;
		background: #7c5cf6;
		border-radius: 50%;
		animation: bounce 1.1s infinite;
	}

	.typing span:nth-child(2) {
		animation-delay: 0.18s;
	}
	.typing span:nth-child(3) {
		animation-delay: 0.36s;
	}

	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: translateY(0);
		}
		40% {
			transform: translateY(-6px);
		}
	}

	/* Input */
	.input-area {
		display: flex;
		gap: 8px;
		align-items: flex-end;
		padding-top: 12px;
		border-top: 1px solid #2a2a38;
	}

	textarea {
		flex: 1;
		background: #14141c;
		border: 1px solid #2a2a38;
		color: #f0eff6;
		padding: 12px 16px;
		border-radius: 12px;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 14px;
		outline: none;
		resize: none;
		transition: border-color 0.15s;
		min-height: 48px;
		max-height: 160px;
	}

	textarea:focus {
		border-color: #7c5cf6;
	}
	textarea:disabled {
		opacity: 0.5;
	}

	.send-btn {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		border: none;
		background: #7c5cf6;
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.15s,
			transform 0.1s;
		flex-shrink: 0;
	}

	.send-btn svg {
		width: 18px;
		height: 18px;
	}
	.send-btn:hover:not(:disabled) {
		background: #9b7cff;
	}
	.send-btn:active:not(:disabled) {
		transform: scale(0.95);
	}
	.send-btn:disabled {
		background: #3a2a7a;
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
