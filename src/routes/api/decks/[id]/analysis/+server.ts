import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import type { RequestHandler } from './$types';

const CLUSTER_NAMES: Record<number, string> = {
	0: 'Cluster 0',
	1: 'Cluster 1',
	2: 'Cluster 2',
	3: 'Cluster 3',
	4: 'Cluster 4',
	5: 'Cluster 5',
	6: 'Cluster 6',
	7: 'Cluster 7',
	8: 'Cluster 8',
	9: 'Cluster 9'
};

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'No autenticado');

	const deck = await db.deck.findUnique({ where: { id: params.id } });
	if (!deck) throw error(404, 'Mazo no encontrado');
	if (deck.userId !== locals.user.id) throw error(403, 'Sin permiso');

	const cardNames: string[] = JSON.parse(deck.cards);
	if (cardNames.length === 0) return json({ distribution: [], alerts: [] });

	const cards = await db.card.findMany({
		where: { name: { in: cardNames } },
		select: { name: true, cluster_id: true }
	});

	const total = cards.length;
	const counts: Record<number, number> = {};
	let untagged = 0;

	for (const card of cards) {
		if (card.cluster_id === null) {
			untagged++;
		} else {
			counts[card.cluster_id] = (counts[card.cluster_id] ?? 0) + 1;
		}
	}

	const distribution = Object.entries(counts)
		.map(([clusterId, count]) => ({
			cluster_id: Number(clusterId),
			name: CLUSTER_NAMES[Number(clusterId)] ?? `Cluster ${clusterId}`,
			count,
			percentage: Math.round((count / total) * 100)
		}))
		.sort((a, b) => b.count - a.count);

	const alerts: string[] = [];

	for (const entry of distribution) {
		if (entry.percentage > 60) {
			alerts.push(
				`El mazo tiene demasiadas cartas de "${entry.name}" (${entry.percentage}%). Considera diversificar.`
			);
		}
	}

	if (untagged > 0) {
		alerts.push(
			`${untagged} carta(s) no encontradas en el catálogo o sin cluster asignado.`
		);
	}

	return json({ distribution, alerts, total, untagged });
};
