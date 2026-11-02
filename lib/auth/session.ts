import "server-only";
import { cookies } from "next/headers";
import { decryptSession, encryptSession, SESSION_COOKIE, SESSION_TTL_SECONDS, type SessionPayload } from "@/lib/auth/token";

// Stateless signed session cookie (NFR-13). The cookie only carries the user id
// and role; the DAL re-reads the user on every request so deactivation takes
// effect immediately. See decisions/0002-session-authentication.md.

export type { SessionPayload, SessionRole } from "@/lib/auth/token";

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
