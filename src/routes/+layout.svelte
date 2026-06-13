<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();

	interface Msg {
		role: 'user' | 'assistant';
		content: string;
	}

	const SYSTEM = {
		role: 'system',
		content:
			'Eres un asistente experto en Magic: The Gathering. Responde siempre en español. Responde solo preguntas sobre Magic: The Gathering, NADA MAS'
	};

	let open = $state(false);
	let messages: Msg[] = $state([]);
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
			messages = [
				...messages,
				{ role: 'assistant', content: data.error ? `⚠️ ${data.error}` : data.reply }
			];
		} catch (e: any) {
			messages = [...messages, { role: 'assistant', content: `⚠️ Error de conexión.` }];
		} finally {
			loading = false;
		}
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}

<!-- Chatbot flotante -->
{#if data.user}
<div class="chat-widget">
	{#if open}
		<div class="chat-panel">
			<div class="chat-panel-header">
				<span>Asistente MTG</span>
				<button class="close-btn" onclick={() => (open = false)}>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
						<path
							d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"
						/>
					</svg>
				</button>
			</div>

			<div class="chat-messages">
				{#if messages.length === 0}
					<div class="chat-empty">Pregúntame sobre Magic: The Gathering</div>
				{/if}
				{#each messages as msg}
					<div class="chat-msg {msg.role}">
						<div class="chat-bubble">{msg.content}</div>
					</div>
				{/each}
				{#if loading}
					<div class="chat-msg assistant">
						<div class="chat-bubble typing">
							<span></span><span></span><span></span>
						</div>
					</div>
				{/if}
			</div>

			<div class="chat-input-row">
				<textarea
					bind:value={input}
					onkeydown={onKey}
					placeholder="Escribe aquí..."
					rows="1"
					disabled={loading}
				></textarea>
				<button class="chat-send" onclick={send} disabled={loading || !input.trim()}>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
						<path
							d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z"
						/>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<button class="chat-fab" onclick={() => (open = !open)} title="Asistente MTG">
		{#if open}
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
				<path
					d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
				/>
			</svg>
		{:else}
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
				<path
					d="M8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9 9 0 0 0 8 15"
				/>
			</svg>
		{/if}
	</button>
</div>
{/if}

<style>
	.chat-widget {
		position: fixed;
		bottom: 24px;
		right: 24px;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 12px;
	}

	/* Panel */
	.chat-panel {
		width: 340px;
		height: 480px;
		background: #14141c;
		border: 1px solid #2a2a38;
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.7),
			0 0 0 1px rgba(124, 92, 246, 0.15);
	}

	.chat-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px;
		background: #1c1c28;
		border-bottom: 1px solid #2a2a38;
		font-size: 13px;
		font-weight: 700;
		color: #f0eff6;
		font-family: 'Inter', system-ui, sans-serif;
		flex-shrink: 0;
	}

	.close-btn {
		width: 24px;
		height: 24px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: #8e8da8;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.15s,
			color 0.15s;
	}
	.close-btn:hover {
		background: rgba(224, 67, 74, 0.15);
		color: #e0434a;
	}
	.close-btn svg {
		width: 13px;
		height: 13px;
	}

	/* Messages */
	.chat-messages {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		scrollbar-width: thin;
		scrollbar-color: #2a2a38 transparent;
	}

	.chat-empty {
		text-align: center;
		color: #5a596e;
		font-size: 12px;
		font-family: 'Inter', system-ui, sans-serif;
		margin-top: 40px;
	}

	.chat-msg {
		display: flex;
		flex-direction: column;
		max-width: 85%;
	}
	.chat-msg.user {
		align-self: flex-end;
	}
	.chat-msg.assistant {
		align-self: flex-start;
	}

	.chat-bubble {
		padding: 9px 13px;
		border-radius: 14px;
		font-size: 13px;
		line-height: 1.55;
		white-space: pre-wrap;
		word-break: break-word;
		font-family: 'Inter', system-ui, sans-serif;
	}

	.chat-msg.user .chat-bubble {
		background: #7c5cf6;
		color: #fff;
		border-bottom-right-radius: 4px;
	}

	.chat-msg.assistant .chat-bubble {
		background: #1c1c28;
		color: #dde1f0;
		border: 1px solid #2a2a38;
		border-bottom-left-radius: 4px;
	}

	/* Typing */
	.typing {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 12px 16px;
	}
	.typing span {
		width: 6px;
		height: 6px;
		background: #7c5cf6;
		border-radius: 50%;
		display: inline-block;
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
			transform: translateY(-5px);
		}
	}

	/* Input */
	.chat-input-row {
		display: flex;
		gap: 8px;
		align-items: flex-end;
		padding: 10px;
		border-top: 1px solid #2a2a38;
		flex-shrink: 0;
	}

	textarea {
		flex: 1;
		background: #1c1c28;
		border: 1px solid #2a2a38;
		color: #f0eff6;
		padding: 9px 12px;
		border-radius: 10px;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 13px;
		outline: none;
		resize: none;
		min-height: 38px;
		max-height: 120px;
		transition: border-color 0.15s;
	}
	textarea:focus {
		border-color: #7c5cf6;
	}
	textarea:disabled {
		opacity: 0.5;
	}

	.chat-send {
		width: 38px;
		height: 38px;
		border-radius: 10px;
		border: none;
		background: #7c5cf6;
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition:
			background 0.15s,
			transform 0.1s;
	}
	.chat-send svg {
		width: 16px;
		height: 16px;
	}
	.chat-send:hover:not(:disabled) {
		background: #9b7cff;
	}
	.chat-send:active:not(:disabled) {
		transform: scale(0.93);
	}
	.chat-send:disabled {
		background: #3a2a7a;
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* FAB */
	.chat-fab {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		border: none;
		background: #7c5cf6;
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 20px rgba(124, 92, 246, 0.5);
		transition:
			background 0.15s,
			transform 0.15s,
			box-shadow 0.15s;
	}
	.chat-fab svg {
		width: 22px;
		height: 22px;
	}
	.chat-fab:hover {
		background: #9b7cff;
		transform: scale(1.08);
		box-shadow: 0 6px 28px rgba(124, 92, 246, 0.65);
	}
	.chat-fab:active {
		transform: scale(0.95);
	}
</style>
