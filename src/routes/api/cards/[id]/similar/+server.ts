import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const card = await db.card.findUnique({
		where: { id: params.id },
		select: { cluster_id: true }
	});

	if (!card) throw error(404, 'Card not found');

	if (card.cluster_id === null) {
		return json({ cards: [], message: 'Clustering not yet run' });
	}

	const similar = await db.card.findMany({
		where: { cluster_id: card.cluster_id, id: { not: params.id } },
		select: {
			id: true,
			name: true,
			mana_cost: true,
			cmc: true,
			type_line: true,
			colors: true,
			rarity: true,
			cluster_id: true
		},
		take: 6,
		orderBy: { name: 'asc' }
	});

	return json({ cards: similar });
};
