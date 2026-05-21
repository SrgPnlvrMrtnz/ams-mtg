import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'No autenticado' }, { status: 401 });
	}

	const decks = await db.deck.findMany({
		where: { userId: locals.user.id },
		orderBy: { updatedAt: 'desc' },
		select: { id: true, name: true, format: true, cards: true, createdAt: true, updatedAt: true }
	});

	return json(decks);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autenticado' }, { status: 401 });
	}

	const { name, format, cards } = await request.json();

	if (!name || typeof name !== 'string' || name.trim() === '') {
		return json({ error: 'El nombre del mazo es obligatorio' }, { status: 400 });
	}

	const deck = await db.deck.create({
		data: {
			name: name.trim(),
			format: format ?? null,
			cards: JSON.stringify(Array.isArray(cards) ? cards : []),
			userId: locals.user.id
		}
	});

	return json(deck, { status: 201 });
};
