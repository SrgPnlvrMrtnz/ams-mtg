import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MODEL = 'llama-3.3-70b-versatile';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) {
		return json({ error: 'No autorizado' }, { status: 401 });
	}

	const apiKey = (platform?.env as any)?.GROQ_API_KEY;
	if (!apiKey) {
		return json({ error: 'API key no configurada.' }, { status: 500 });
	}

	const { messages } = await request.json();

	const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: MODEL,
			messages,
			max_tokens: 800,
			temperature: 0.7
		})
	});

	const data = await res.json();

	if (!res.ok) {
		return json({ error: data.error?.message ?? 'Error de Groq.' }, { status: res.status });
	}

	return json({ reply: data.choices[0].message.content });
};
