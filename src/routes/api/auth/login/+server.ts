import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { verifyPassword, createSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { email, password } = await request.json();

	if (!email || !password) {
		return json({ error: 'Email y contraseña son obligatorios' }, { status: 400 });
	}

	const user = await db.user.findUnique({ where: { email } });
	if (!user) {
		return json({ error: 'Credenciales incorrectas' }, { status: 401 });
	}

	const valid = await verifyPassword(password, user.password);
	if (!valid) {
		return json({ error: 'Credenciales incorrectas' }, { status: 401 });
	}

	const session = await createSession(user.id);

	cookies.set('session_id', session.id, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		maxAge: 60 * 60 * 24 * 7
	});

	return json({ id: user.id, email: user.email });
};
