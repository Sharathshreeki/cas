"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { AuthError, authorizeAction, type CurrentUser } from "@/lib/auth/dal";
import { fieldErrors, menuItemSchema, slotCapacitySchema } from "@/lib/validation";
import { audit } from "@/lib/services/audit";
import type { ActionResult } from "@/lib/action-result";

// Staff operations, always scoped to the caller's assigned stall (FR-07,
// FR-15…FR-18, FR-43, FR-56, BR-07).

async function staffWithStall(): Promise<CurrentUser & { stallId: string }> {
  const user = await authorizeAction(["STAFF"]);
  if (!user.stallId) throw new AuthError("Your account is not assigned to a stall.");
  return user as CurrentUser & { stallId: string };
}

function failure(error: unknown): ActionResult<never> {
  if (error instanceof AuthError) return { ok: false, error: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { ok: false, error: "An item with this name already exists.", fieldErrors: { name: ["Name already used."] } };
  }
  console.error(error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function parseMenuForm(input: Record<string, unknown>) {
  return menuItemSchema.safeParse({
    ...input,
    isVeg: input.isVeg === true || input.isVeg === "on" || input.isVeg === "true",
    isAvailable: input.isAvailable === true || input.isAvailable === "on" || input.isAvailable === "true",
  });
}

export async function saveMenuItem(itemId: string | null, input: Record<string, unknown>): Promise<ActionResult> {
  try {
    const user = await staffWithStall();
    const parsed = parseMenuForm(input);
    if (!parsed.success) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    }
    const data = { ...parsed.data, description: parsed.data.description || null };

    if (itemId) {
      const updated = await db.menuItem.updateMany({ where: { id: itemId, stallId: user.stallId }, data });
      if (updated.count === 0) return { ok: false, error: "Menu item not found." };
      await audit(user.id, "menu.update", "menu_item", itemId, { price: data.price, isAvailable: data.isAvailable });
    } else {
      const created = await db.menuItem.create({ data: { ...data, stallId: user.stallId } });
      await audit(user.id, "menu.create", "menu_item", created.id, { name: data.name, price: data.price });
    }
    refresh();
    return { ok: true, message: itemId ? "Menu item updated." : "Menu item added." };
  } catch (error) {
    return failure(error);
  }
}

export async function setItemAvailability(itemId: string, isAvailable: boolean): Promise<ActionResult> {
  try {
    const user = await staffWithStall();
    const updated = await db.menuItem.updateMany({ where: { id: itemId, stallId: user.stallId }, data: { isAvailable } });
    if (updated.count === 0) return { ok: false, error: "Menu item not found." };
    refresh();
    return { ok: true, message: isAvailable ? "Marked available." : "Marked unavailable." };
  } catch (error) {
    return failure(error);
  }
}

/** Archive instead of delete so historical orders keep their references (§8.1.7). */
export async function archiveMenuItem(itemId: string): Promise<ActionResult> {
  try {
    const user = await staffWithStall();
    const updated = await db.menuItem.updateMany({
      where: { id: itemId, stallId: user.stallId },
      data: { isArchived: true, isAvailable: false },
    });
    if (updated.count === 0) return { ok: false, error: "Menu item not found." };
    await audit(user.id, "menu.archive", "menu_item", itemId);
    refresh();
    return { ok: true, message: "Item removed from the menu." };
  } catch (error) {
    return failure(error);
  }
}

export async function setStallOpen(isOpen: boolean): Promise<ActionResult> {
  try {
    const user = await staffWithStall();
    await db.stall.update({ where: { id: user.stallId }, data: { isOpen } });
    await audit(user.id, isOpen ? "stall.open" : "stall.close", "stall", user.stallId);
    refresh();
    return { ok: true, message: isOpen ? "Stall is now accepting orders." : "Stall paused — no new orders." };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Updates the default orders-per-slot capacity (FR-43). Future slots that
 * already have bookings get the new capacity too, but never below what is
 * already booked, so existing orders are never invalidated.
 */
export async function updateSlotCapacity(input: Record<string, unknown>): Promise<ActionResult> {
  try {
    const user = await staffWithStall();
    const parsed = slotCapacitySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    }
    const capacity = parsed.data.slotCapacity;
    await db.$transaction([
      db.stall.update({ where: { id: user.stallId }, data: { slotCapacity: capacity } }),
      db.$executeRaw`
        UPDATE pickup_slot SET capacity = GREATEST(${capacity}, booked_count)
        WHERE stall_id = ${user.stallId} AND starts_at > now()`,
    ]);
    await audit(user.id, "slots.capacity", "stall", user.stallId, { capacity });
    refresh();
    return { ok: true, message: `Each slot now takes up to ${capacity} orders.` };
  } catch (error) {
    return failure(error);
  }
}
