"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { AccountStatus, Role } from "@/lib/generated/prisma/enums";
import { AuthError, authorizeAction } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import { createAccountSchema, fieldErrors, settingsSchema, stallSchema } from "@/lib/validation";
import { audit } from "@/lib/services/audit";
import { saveSettings } from "@/lib/settings";
import { hhmmToMinutes } from "@/lib/time";
import type { ActionResult } from "@/lib/action-result";

// Administrator operations (FR-08, FR-19, FR-60…FR-65). Each action
// re-authorizes the caller and records an audit entry.

function failure(error: unknown, uniqueField = "name"): ActionResult<never> {
  if (error instanceof AuthError) return { ok: false, error: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { ok: false, error: "That value is already in use.", fieldErrors: { [uniqueField]: ["Already in use."] } };
  }
  console.error(error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function saveStall(stallId: string | null, input: Record<string, unknown>): Promise<ActionResult> {
  try {
    const admin = await authorizeAction(["ADMIN"]);
    const parsed = stallSchema.safeParse({ ...input, isOpen: input.isOpen === true || input.isOpen === "on" });
    if (!parsed.success) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    }
    const v = parsed.data;
    const data = {
      name: v.name,
      description: v.description || null,
      location: v.location || null,
      opensAt: hhmmToMinutes(v.opensAt),
      closesAt: hhmmToMinutes(v.closesAt),
      slotCapacity: v.slotCapacity,
      isOpen: v.isOpen,
    };
    if (stallId) {
      await db.stall.update({ where: { id: stallId }, data });
      await audit(admin.id, "stall.update", "stall", stallId, data);
    } else {
      const stall = await db.stall.create({ data });
      await audit(admin.id, "stall.create", "stall", stall.id, data);
    }
    refresh();
    return { ok: true, message: stallId ? "Stall updated." : "Stall created." };
  } catch (error) {
    return failure(error);
  }
}

export async function setStallStatus(stallId: string, isOpen: boolean): Promise<ActionResult> {
  try {
    const admin = await authorizeAction(["ADMIN"]);
    await db.stall.update({ where: { id: stallId }, data: { isOpen } });
    await audit(admin.id, isOpen ? "stall.open" : "stall.close", "stall", stallId);
    refresh();
    return { ok: true, message: isOpen ? "Stall opened." : "Stall closed." };
  } catch (error) {
    return failure(error);
  }
}

export async function createAccount(input: Record<string, unknown>): Promise<ActionResult> {
  try {
    const admin = await authorizeAction(["ADMIN"]);
    const parsed = createAccountSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    }
    const v = parsed.data;
    if (v.role === "STAFF" && !v.stallId) {
      return { ok: false, error: "Staff accounts need an assigned stall.", fieldErrors: { stallId: ["Choose a stall."] } };
    }
    const user = await db.user.create({
      data: {
        name: v.name,
        email: v.email,
        phone: v.phone || null,
        role: v.role,
        stallId: v.role === "STAFF" ? v.stallId : null,
        passwordHash: await hashPassword(v.password),
      },
    });
    await audit(admin.id, "user.create", "user", user.id, { role: v.role, stallId: user.stallId });
    refresh();
    return { ok: true, message: `${v.role === "STAFF" ? "Staff" : "Admin"} account created.` };
  } catch (error) {
    return failure(error, "email");
  }
}

export async function updateUserAccess(
  userId: string,
  changes: { role?: Role; status?: AccountStatus; stallId?: string | null },
): Promise<ActionResult> {
  try {
    const admin = await authorizeAction(["ADMIN"]);
    if (userId === admin.id && (changes.status === "INACTIVE" || (changes.role && changes.role !== "ADMIN"))) {
      return { ok: false, error: "You cannot deactivate or demote your own account." };
    }
    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) return { ok: false, error: "User not found." };

    const role = changes.role ?? target.role;
    const stallId = role === "STAFF" ? (changes.stallId !== undefined ? changes.stallId : target.stallId) : null;
    if (stallId) {
      const stall = await db.stall.findUnique({ where: { id: stallId }, select: { id: true } });
      if (!stall) return { ok: false, error: "Stall not found." };
    }

    await db.user.update({
      where: { id: userId },
      data: { role, status: changes.status ?? target.status, stallId },
    });
    await audit(admin.id, "user.access", "user", userId, {
      from: { role: target.role, status: target.status, stallId: target.stallId },
      to: { role, status: changes.status ?? target.status, stallId },
    });
    refresh();
    return { ok: true, message: "Account updated." };
  } catch (error) {
    return failure(error);
  }
}

export async function updateSettings(input: Record<string, unknown>): Promise<ActionResult> {
  try {
    const admin = await authorizeAction(["ADMIN"]);
    const parsed = settingsSchema.safeParse({
      ...input,
      orderingEnabled: input.orderingEnabled === true,
      geofenceEnabled: input.geofenceEnabled === true,
    });
    if (!parsed.success) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    }
    const v = parsed.data;
    const settings = {
      orderingEnabled: v.orderingEnabled,
      minLeadMinutes: v.minLeadMinutes,
      bookingDays: v.bookingDays,
      geofence: { enabled: v.geofenceEnabled, lat: v.geofenceLat, lng: v.geofenceLng, radiusMeters: v.geofenceRadiusMeters },
    };
    await saveSettings(settings);
    await audit(admin.id, "settings.update", "system_setting", null, settings);
    refresh();
    return { ok: true, message: "Settings saved." };
  } catch (error) {
    return failure(error);
  }
}
