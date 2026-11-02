"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { AuthError, authorizeAction } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { changePasswordSchema, fieldErrors, profileSchema } from "@/lib/validation";
import { audit } from "@/lib/services/audit";
import type { FormState } from "@/lib/action-result";

// FR-06: users may update their name and phone. Email, SRN and role are
// identity fields managed by administrators.
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await authorizeAction();
    const parsed = profileSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    }
    await db.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name, phone: parsed.data.phone || null },
    });
    refresh();
    return { ok: true, message: "Profile updated." };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await authorizeAction();
    const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    }
    const record = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    if (!(await verifyPassword(parsed.data.currentPassword, record.passwordHash))) {
      return { ok: false, error: "Current password is incorrect.", fieldErrors: { currentPassword: ["Incorrect password."] } };
    }
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } });
    await audit(user.id, "auth.password_changed", "user", user.id);
    return { ok: true, message: "Password changed." };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function markNotificationsRead(): Promise<void> {
  const user = await authorizeAction();
  await db.notification.updateMany({
    where: user.role === "STAFF" && user.stallId ? { stallId: user.stallId, isRead: false } : { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  refresh();
}
