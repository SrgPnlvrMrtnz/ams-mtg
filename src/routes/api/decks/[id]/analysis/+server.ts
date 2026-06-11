import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const TAG_LABELS: Record<string, string> = {
	'bajo-coste': 'Bajo coste (cmc ≤ 2)',
	'coste-medio': 'Coste medio (cmc 3-4)',
	'alto-coste': 'Alto coste (cmc ≥ 5)',
	criatura: 'Criaturas',
	instantaneo: 'Instantáneos',
	conjuro: 'Conjuros',
	artefacto: 'Artefactos',
	encantamiento: 'Encantamientos',
	tierra: 'Tierras',
	planeswalker: 'Planeswalkers',
	destruccion: 'Destrucción',
	'robo-cartas': 'Robo de cartas',
	ramp: 'Aceleración de maná',
	contrahechizo: 'Contrahechizos',
	tokens: 'Generación de tokens',
	evasion: 'Evasión',
	proteccion: 'Protección',
	vida: 'Ganancia de vida',
	'daño-directo': 'Daño directo'
};

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'No autenticado');

	const deck = await locals.db.deck.findUnique({ where: { id: params.id } });
	if (!deck) throw error(404, 'Mazo no encontrado');
	if (deck.userId !== locals.user.id) throw error(403, 'Sin permiso');

	const cardNames: string[] = JSON.parse(deck.cards);
	if (cardNames.length === 0) return json({ distribution: [], alerts: [] });

	const cards = await locals.db.card.findMany({
		where: { name: { in: cardNames } },
		select: { name: true, tags: true }
	});

	const total = cards.length;
	const tagCounts: Record<string, number> = {};
	let untagged = 0;

	for (const card of cards) {
		const tags: string[] = JSON.parse(card.tags);
		if (tags.length === 0) {
			untagged++;
		} else {
			for (const tag of tags) {
				tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
			}
		}
	}

	const distribution = Object.entries(tagCounts)
		.map(([tag, count]) => ({
			tag,
			label: TAG_LABELS[tag] ?? tag,
			count,
			percentage: Math.round((count / total) * 100)
		}))
		.sort((a, b) => b.count - a.count);

	const alerts: string[] = [];

	if (!tagCounts['destruccion']) alerts.push('Tu mazo no tiene destrucción.');
	if (!tagCounts['robo-cartas']) alerts.push('Tu mazo no tiene robo de cartas.');
	if (!tagCounts['ramp']) alerts.push('Tu mazo no tiene aceleración de maná.');
	if (!tagCounts['bajo-coste'])
		alerts.push('Tu mazo carece de jugadas tempranas (sin cartas de bajo coste).');

	const highCostPct = ((tagCounts['alto-coste'] ?? 0) / total) * 100;
	if (highCostPct > 50) {
		alerts.push(
			`Demasiadas cartas de alto coste (${Math.round(highCostPct)}%). Considera añadir más ramp o reducir el coste medio.`
		);
	}

	if (untagged > 0) {
		alerts.push(`${untagged} carta(s) no encontradas en el catálogo.`);
	}

	return json({ distribution, alerts, total, untagged });
};
