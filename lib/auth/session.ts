import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Stateless signed session cookie (NFR-13). The cookie only carries the user id
// and role; the DAL re-reads the user on every request so deactivation takes
// effect immediately. See decisions/0002-session-authentication.md.

export const SESSION_COOKIE = "cas_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionRole = "STUDENT" | "STAFF" | "ADMIN";
export type SessionPayload = { userId: string; role: SessionRole };

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const role = payload.role;
    if (!payload.sub || (role !== "STUDENT" && role !== "STAFF" && role !== "ADMIN")) return null;
    return { userId: payload.sub, role };
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encryptSession(payload);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  return decryptSession((await cookies()).get(SESSION_COOKIE)?.value);
}
