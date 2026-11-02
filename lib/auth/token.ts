import { SignJWT, jwtVerify } from "jose";

// Signing and verification of the session token. Kept free of request APIs so
// it can run in both the proxy and server code.

export const SESSION_COOKIE = "cas_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

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
