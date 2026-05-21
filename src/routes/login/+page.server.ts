import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import db from '$lib/server/db';
import { hashPassword, verifyPassword, createJwt } from '$lib/server/auth';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) {
		redirect(302, '/');
	}
};

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email') as string;
		const password = data.get('password') as string;

		if (!email || !password) {
			return fail(400, { error: 'Email y contraseña son obligatorios' });
		}

		const user = await db.user.findUnique({ where: { email } });
		if (!user) {
			return fail(401, { error: 'Credenciales incorrectas' });
		}

		const valid = await verifyPassword(password, user.password);
		if (!valid) {
			return fail(401, { error: 'Credenciales incorrectas' });
		}

		const token = await createJwt(user.id, user.email);
		cookies.set('token', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 * 7
		});

		redirect(302, '/');
	},

	register: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email') as string;
		const password = data.get('password') as string;
		const confirmPassword = data.get('confirmPassword') as string;

		if (!email || !password || !confirmPassword) {
			return fail(400, { error: 'Todos los campos son obligatorios' });
		}

		if (password.length < 8) {
			return fail(400, { error: 'La contraseña debe tener al menos 8 caracteres' });
		}

		if (password !== confirmPassword) {
			return fail(400, { error: 'Las contraseñas no coinciden' });
		}

		const existing = await db.user.findUnique({ where: { email } });
		if (existing) {
			return fail(409, { error: 'Ya existe una cuenta con ese email' });
		}

		const hashedPassword = await hashPassword(password);
		const user = await db.user.create({
			data: { email, password: hashedPassword }
		});

		const token = await createJwt(user.id, user.email);
		cookies.set('token', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 * 7
		});

		redirect(302, '/');
	}
};
