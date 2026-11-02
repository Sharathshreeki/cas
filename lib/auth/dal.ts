import "server-only";
import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readSession, type SessionRole } from "@/lib/auth/session";

// Data Access Layer: the single place that turns a session cookie into a
// verified, active user (NFR-07). Every page, Server Action and Route Handler
// authorizes through these helpers, close to the data.

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: SessionRole;
  stallId: string | null;
  stallName: string | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      stallId: true,
      stall: { select: { name: true } },
    },
  });
  if (!user || user.status !== "ACTIVE") return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    stallId: user.stallId,
    stallName: user.stall?.name ?? null,
  };
});

/** For pages: redirect anonymous users to login, forbid wrong roles. */
export async function requireUser(roles?: SessionRole[], returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  if (roles && !roles.includes(user.role)) forbidden();
  return user;
}

/** Staff must have an assigned stall to use the staff dashboard (FR-07). */
export async function requireStaff(): Promise<CurrentUser & { stallId: string; stallName: string }> {
  const user = await requireUser(["STAFF"], "/staff");
  if (!user.stallId || !user.stallName) redirect("/staff/unassigned");
  return user as CurrentUser & { stallId: string; stallName: string };
}

export class AuthError extends Error {}

/** For Server Actions: throw instead of redirecting so the action can report it. */
export async function authorizeAction(roles?: SessionRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Please sign in again.");
  if (roles && !roles.includes(user.role)) throw new AuthError("You are not allowed to do that.");
  return user;
}
