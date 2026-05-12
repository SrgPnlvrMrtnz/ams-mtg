import type { Handle } from '@sveltejs/kit';
import { getSessionUser } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session_id') ?? null;

	event.locals.sessionId = sessionId;
	event.locals.user = null;

	if (sessionId) {
		const user = await getSessionUser(sessionId);
		if (user) {
			event.locals.user = { id: user.id, email: user.email };
		}
	}

	return resolve(event);
};
