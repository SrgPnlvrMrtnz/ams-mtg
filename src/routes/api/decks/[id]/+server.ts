import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autenticado' }, { status: 401 });
	}

	const deck = await db.deck.findUnique({ where: { id: params.id } });

	if (!deck) {
		return json({ error: 'Mazo no encontrado' }, { status: 404 });
	}

	if (deck.userId !== locals.user.id) {
		return json({ error: 'Sin permiso' }, { status: 403 });
	}

	const { name, format, cards } = await request.json();

	const updated = await db.deck.update({
		where: { id: params.id },
		data: {
			...(name !== undefined && { name: name.trim() }),
			...(format !== undefined && { format }),
			...(cards !== undefined && { cards: JSON.stringify(Array.isArray(cards) ? cards : []) })
		}
	});

	return json(updated);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'No autenticado' }, { status: 401 });
	}

	const deck = await db.deck.findUnique({ where: { id: params.id } });

	if (!deck) {
		return json({ error: 'Mazo no encontrado' }, { status: 404 });
	}

	if (deck.userId !== locals.user.id) {
		return json({ error: 'Sin permiso' }, { status: 403 });
	}

	await db.deck.delete({ where: { id: params.id } });

	return new Response(null, { status: 204 });
};
