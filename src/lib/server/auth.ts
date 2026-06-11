import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { JWT_SECRET } from '$env/static/private';

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

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 4);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}
