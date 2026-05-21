import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { hashPassword, createSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { email, password } = await request.json();

	if (!email || !password) {
		return json({ error: 'Email y contraseña son obligatorios' }, { status: 400 });
	}

	if (password.length < 8) {
		return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
	}

	const existing = await db.user.findUnique({ where: { email } });
	if (existing) {
		return json({ error: 'Ya existe una cuenta con ese email' }, { status: 409 });
	}

	const hashedPassword = await hashPassword(password);
	const user = await db.user.create({
		data: { email, password: hashedPassword }
	});

	const session = await createSession(user.id);

	cookies.set('session_id', session.id, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		maxAge: 60 * 60 * 24 * 7
	});

	return json({ id: user.id, email: user.email }, { status: 201 });
};
