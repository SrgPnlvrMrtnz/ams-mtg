import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { JWT_SECRET } from '$env/static/private';
import db from './db';

const jwtSecret = (JWT_SECRET ?? '').trim();

if (!jwtSecret) {
	throw new Error('Missing JWT_SECRET. Set JWT_SECRET in .env before starting the app.');
}

const secret = new TextEncoder().encode(jwtSecret);

export async function createJwt(userId: string, email: string): Promise<string> {
	return new SignJWT({ email })
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(userId)
		.setIssuedAt()
		.setExpirationTime('7d')
		.sign(secret);
}

export async function verifyJwt(token: string): Promise<{ userId: string; email: string } | null> {
	try {
		const { payload } = await jwtVerify(token, secret);
		return { userId: payload.sub as string, email: payload.email as string };
	} catch {
		return null;
	}
}

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 12); //12 es un valor, le dice a bcrypt cuanto trabajo tiene que hacer, a mayor valor, más lento pero seguro, 12 es un valor estándar
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
	return db.session.create({
		data: { userId, expiresAt }
	});
}

export async function getSessionUser(sessionId: string) {
	const session = await db.session.findUnique({
		where: { id: sessionId },
		include: { user: true }
	});

	if (!session || session.expiresAt < new Date()) {
		if (session) await db.session.delete({ where: { id: sessionId } });
		return null;
	}

	return session.user;
}

export async function deleteSession(sessionId: string): Promise<void> {
	await db.session.deleteMany({ where: { id: sessionId } });
}
