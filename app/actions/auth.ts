"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, deleteSession, readSession } from "@/lib/auth/session";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/auth/password";
import { fieldErrors, loginSchema, registerSchema } from "@/lib/validation";
import { audit } from "@/lib/services/audit";
import type { FormState } from "@/lib/action-result";

const HOME_BY_ROLE = { STUDENT: "/", STAFF: "/staff", ADMIN: "/admin" } as const;

/** Only allow same-origin relative redirects after login. */
function safeNext(value: FormDataEntryValue | null): string | null {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

function echo(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

// FR-01, FR-02
export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = echo(formData, ["name", "email", "srn", "phone"]);
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  }
  const { name, email, srn, phone, password } = parsed.data;

  const existing = await db.user.findFirst({ where: { OR: [{ email }, { srn }] }, select: { email: true } });
  if (existing) {
    const field = existing.email === email ? "email" : "srn";
    return {
      ok: false,
      error: "An account already exists with these details.",
      values,
      fieldErrors: { [field]: [field === "email" ? "This email is already registered." : "This SRN is already registered."] },
    };
  }

  const user = await db.user.create({
    data: { name, email, srn, phone, passwordHash: await hashPassword(password), role: "STUDENT" },
  });
  await audit(user.id, "auth.register", "user", user.id);
  await createSession({ userId: user.id, role: user.role });
  redirect(safeNext(formData.get("next")) ?? "/");
}

// FR-03, FR-09
export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = echo(formData, ["email"]);
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  }
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  // Always run bcrypt so timing does not reveal whether the email exists.
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    await audit(null, "auth.login_failed", "user", user?.id ?? null);
    return { ok: false, error: "Incorrect email or password.", values };
  }
  if (user.status !== "ACTIVE") {
    return { ok: false, error: "This account has been deactivated. Contact the canteen administrator.", values };
  }

  await createSession({ userId: user.id, role: user.role });
  await audit(user.id, "auth.login", "user", user.id);
  const next = safeNext(formData.get("next"));
  redirect(user.role === "STUDENT" ? (next ?? "/") : HOME_BY_ROLE[user.role]);
}

// FR-04
export async function logout(): Promise<void> {
  const session = await readSession();
  await deleteSession();
  if (session) await audit(session.userId, "auth.logout", "user", session.userId);
  redirect("/login");
}
