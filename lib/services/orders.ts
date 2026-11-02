import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { OrderStatus, PaymentStatus } from "@/lib/generated/prisma/enums";
import {
  canTransition,
  releasesSlot,
  STATUS_TIMESTAMP_FIELD,
  statusNotification,
  type ActorRole,
} from "@/lib/domain/order-status";
import { fromPaise, orderTotalPaise, toPaise } from "@/lib/domain/money";
import { validateSlotStart } from "@/lib/domain/slots";
import { isInsideFence } from "@/lib/domain/geo";
import { getSettings } from "@/lib/settings";
import { formatTime } from "@/lib/time";
import type { PlaceOrderInput } from "@/lib/validation";

// Order placement and lifecycle (SRS §3.4–3.6, UC-01, UC-02).

export type OrderErrorCode =
  | "ORDERING_DISABLED"
  | "LOCATION_REQUIRED"
  | "OUTSIDE_CAMPUS"
  | "STALL_CLOSED"
  | "ITEM_UNAVAILABLE"
  | "PRICE_CHANGED"
  | "INVALID_SLOT"
  | "SLOT_FULL"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_TRANSITION"
  | "CONFLICT"
  | "PAYMENT_REQUIRED"
  | "INVALID_PAYMENT";

export class OrderError extends Error {
  constructor(
    public code: OrderErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateOrderCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  if (!field) return true;
  return JSON.stringify(error.meta ?? {}).includes(field);
}

export type PlacedOrder = { id: string; code: string; duplicate: boolean };

/**
 * Validates and atomically creates an order (BR-01…BR-06, NFR-16, NFR-17).
 * The server recomputes the total from current menu prices; client prices are
 * only used to detect a price change since the cart was built (FR-24).
 */
export async function placeOrder(studentId: string, input: PlaceOrderInput): Promise<PlacedOrder> {
  // Retried submission: return the order created by the first attempt (FR-37).
  const previous = await db.order.findUnique({
    where: { studentId_idempotencyKey: { studentId, idempotencyKey: input.idempotencyKey } },
    select: { id: true, code: true },
  });
  if (previous) return { ...previous, duplicate: true };

  const settings = await getSettings();
  if (!settings.orderingEnabled) {
    throw new OrderError("ORDERING_DISABLED", "Online ordering is paused right now. Please try again later.");
  }

  if (settings.geofence.enabled) {
    if (!input.location) {
      throw new OrderError(
        "LOCATION_REQUIRED",
        "Ordering is limited to campus. Allow location access to continue.",
      );
    }
    if (!isInsideFence(input.location, settings.geofence)) {
      throw new OrderError("OUTSIDE_CAMPUS", "You appear to be outside the PES campus, where ordering is allowed.");
    }
  }

  const stall = await db.stall.findUnique({ where: { id: input.stallId } });
  if (!stall) throw new OrderError("NOT_FOUND", "This stall no longer exists.");
  if (!stall.isOpen) throw new OrderError("STALL_CLOSED", `${stall.name} is not accepting orders right now.`);

  // Merge duplicate lines so quantity limits apply per item.
  const requested = new Map<string, { quantity: number; expectedPrice: number }>();
  for (const line of input.items) {
    const existing = requested.get(line.menuItemId);
    requested.set(line.menuItemId, {
      quantity: (existing?.quantity ?? 0) + line.quantity,
      expectedPrice: line.expectedPrice,
    });
  }

  const menuItems = await db.menuItem.findMany({
    where: { id: { in: [...requested.keys()] }, stallId: stall.id, isArchived: false },
  });
  const byId = new Map(menuItems.map((m) => [m.id, m]));

  const unavailable: string[] = [];
  const priceChanges: { menuItemId: string; price: number }[] = [];
  const lines = [...requested.entries()].map(([menuItemId, line]) => {
    const item = byId.get(menuItemId);
    if (!item || !item.isAvailable) {
      unavailable.push(menuItemId);
      return null;
    }
    const price = fromPaise(toPaise(item.price));
    if (toPaise(price) !== toPaise(line.expectedPrice)) priceChanges.push({ menuItemId, price });
    return { item, quantity: line.quantity, unitPrice: price };
  });

  if (unavailable.length) {
    throw new OrderError(
      "ITEM_UNAVAILABLE",
      "Some items in your cart are no longer available. Remove them to continue.",
      { menuItemIds: unavailable },
    );
  }
  if (priceChanges.length) {
    throw new OrderError("PRICE_CHANGED", "Some prices changed since you added them. Review your cart.", {
      prices: priceChanges,
    });
  }

  const validLines = lines.filter((l) => l !== null);
  const slotCheck = validateSlotStart(new Date(input.slotStart), stall, settings);
  if (!slotCheck.ok) throw new OrderError("INVALID_SLOT", slotCheck.reason);

  const totalPaise = orderTotalPaise(validLines);
  const total = new Prisma.Decimal(fromPaise(totalPaise).toFixed(2));

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateOrderCode();
    try {
      const order = await db.$transaction(async (tx) => {
        // Create the slot row on first booking; concurrent creators are harmless.
        await tx.$executeRaw`
          INSERT INTO pickup_slot (id, stall_id, starts_at, ends_at, capacity, booked_count, created_at)
          VALUES (${`slot_${randomBytes(10).toString("hex")}`}, ${stall.id}, ${slotCheck.window.startsAt},
                  ${slotCheck.window.endsAt}, ${stall.slotCapacity}, 0, now())
          ON CONFLICT (stall_id, starts_at) DO NOTHING`;
        const slot = await tx.pickupSlot.findUniqueOrThrow({
          where: { stallId_startsAt: { stallId: stall.id, startsAt: slotCheck.window.startsAt } },
        });

        // Conditional increment: the row lock taken by UPDATE serializes
        // concurrent bookings, so capacity can never be exceeded (FR-42).
        const reserved = await tx.pickupSlot.updateMany({
          where: { id: slot.id, bookedCount: { lt: tx.pickupSlot.fields.capacity } },
          data: { bookedCount: { increment: 1 } },
        });
        if (reserved.count === 0) {
          throw new OrderError("SLOT_FULL", "That pickup slot just filled up. Please choose another slot.");
        }

        const created = await tx.order.create({
          data: {
            code,
            studentId,
            stallId: stall.id,
            slotId: slot.id,
            totalAmount: total,
            paymentMethod: input.paymentMethod,
            note: input.note || null,
            idempotencyKey: input.idempotencyKey,
            items: {
              create: validLines.map((l) => ({
                menuItemId: l.item.id,
                itemName: l.item.name,
                unitPrice: new Prisma.Decimal(l.unitPrice.toFixed(2)),
                quantity: l.quantity,
              })),
            },
            payment: {
              create: { amount: total, method: input.paymentMethod, status: "PENDING" },
            },
            history: { create: { toStatus: "PLACED", actorId: studentId } },
          },
          select: { id: true, code: true },
        });

        await tx.notification.create({
          data: {
            stallId: stall.id,
            orderId: created.id,
            message: `New order ${code} · pickup ${formatTime(slotCheck.window.startsAt)}`,
          },
        });
        return created;
      });
      return { ...order, duplicate: false };
    } catch (error) {
      if (isUniqueViolation(error, "idempotency_key")) {
        const existing = await db.order.findUniqueOrThrow({
          where: { studentId_idempotencyKey: { studentId, idempotencyKey: input.idempotencyKey } },
          select: { id: true, code: true },
        });
        return { ...existing, duplicate: true };
      }
      if (isUniqueViolation(error, "code")) continue; // order-code collision; retry
      throw error;
    }
  }
  throw new OrderError("CONFLICT", "Could not place the order. Please try again.");
}

export type Actor = { id: string; role: ActorRole; stallId: string | null };

/**
 * Applies a status transition with authorization and optimistic concurrency
 * (FR-34, FR-35, FR-36, BR-07, BR-08, BR-15).
 */
export async function transitionOrder(
  actor: Actor,
  orderId: string,
  to: OrderStatus,
  note?: string,
): Promise<{ code: string; status: OrderStatus }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      status: true,
      stallId: true,
      studentId: true,
      slotId: true,
      paymentMethod: true,
      paymentStatus: true,
    },
  });
  if (!order) throw new OrderError("NOT_FOUND", "Order not found.");

  // Ownership checks happen before revealing anything about the order.
  if (actor.role === "STUDENT" && order.studentId !== actor.id) throw new OrderError("NOT_FOUND", "Order not found.");
  if (actor.role === "STAFF" && order.stallId !== actor.stallId) {
    throw new OrderError("FORBIDDEN", "You can only manage orders for your own stall.");
  }

  if (!canTransition(order.status, to, actor.role)) {
    throw new OrderError(
      "INVALID_TRANSITION",
      actor.role === "STUDENT" && to === "CANCELLED"
        ? "This order can no longer be cancelled because the stall has already accepted it."
        : `An order that is ${order.status.toLowerCase()} cannot be moved to ${to.toLowerCase()}.`,
    );
  }

  let paymentStatus: PaymentStatus = order.paymentStatus;
  let transactionRef: string | undefined;
  if (to === "COMPLETED") {
    if (order.paymentMethod === "CASH_ON_PICKUP" && order.paymentStatus !== "PAID") {
      // Handing over a cash order means staff collected the cash (FR-52).
      paymentStatus = "PAID";
      transactionRef = `CASH-${order.code}`;
    } else if (order.paymentStatus !== "PAID") {
      throw new OrderError("PAYMENT_REQUIRED", "This order has not been paid online yet. Ask the student to complete payment.");
    }
  }
  if (releasesSlot(to) && order.paymentStatus === "PAID") paymentStatus = "REFUNDED";

  const now = new Date();
  await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: {
        status: to,
        [STATUS_TIMESTAMP_FIELD[to]]: now,
        paymentStatus,
        ...(releasesSlot(to) ? { cancelReason: note || null } : {}),
      },
    });
    if (updated.count === 0) {
      throw new OrderError("CONFLICT", "This order was just updated by someone else. Refresh and try again.");
    }

    if (releasesSlot(to)) {
      await tx.pickupSlot.updateMany({
        where: { id: order.slotId, bookedCount: { gt: 0 } },
        data: { bookedCount: { decrement: 1 } },
      });
    }
    if (paymentStatus !== order.paymentStatus) {
      await tx.payment.update({
        where: { orderId: order.id },
        data: { status: paymentStatus, ...(transactionRef ? { transactionRef } : {}) },
      });
    }
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: to, actorId: actor.id, note: note || null },
    });
    if (actor.role === "STUDENT") {
      await tx.notification.create({
        data: { stallId: order.stallId, orderId: order.id, message: `Order ${order.code} was cancelled by the student.` },
      });
    } else {
      await tx.notification.create({
        data: { userId: order.studentId, orderId: order.id, message: statusNotification(order.code, to) },
      });
    }
  });

  return { code: order.code, status: to };
}

/**
 * Simulated online payment (FR-49, FR-51). No real gateway is integrated — the
 * outcome is chosen in the demo dialog and recorded server-side only for the
 * owning student's unpaid, active order. See decisions/0004-payments.md.
 */
export async function simulateOnlinePayment(
  studentId: string,
  orderId: string,
  outcome: "SUCCESS" | "FAILURE",
): Promise<PaymentStatus> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, code: true, studentId: true, stallId: true, status: true, paymentMethod: true, paymentStatus: true },
  });
  if (!order || order.studentId !== studentId) throw new OrderError("NOT_FOUND", "Order not found.");
  if (order.paymentMethod !== "SIMULATED_ONLINE") {
    throw new OrderError("INVALID_PAYMENT", "This order is paid in cash at pickup.");
  }
  if (order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED") {
    throw new OrderError("INVALID_PAYMENT", "This order is already paid.");
  }
  if (order.status === "CANCELLED" || order.status === "REJECTED" || order.status === "COMPLETED") {
    throw new OrderError("INVALID_PAYMENT", "This order can no longer be paid.");
  }

  const status: PaymentStatus = outcome === "SUCCESS" ? "PAID" : "FAILED";
  await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: order.paymentStatus },
      data: { paymentStatus: status },
    });
    if (updated.count === 0) throw new OrderError("CONFLICT", "Payment status changed. Refresh and try again.");
    await tx.payment.update({
      where: { orderId: order.id },
      data: {
        status,
        transactionRef: status === "PAID" ? `SIM-${randomBytes(6).toString("hex").toUpperCase()}` : undefined,
      },
    });
    if (status === "PAID") {
      await tx.notification.create({
        data: { stallId: order.stallId, orderId: order.id, message: `Order ${order.code} was paid online.` },
      });
    }
  });
  return status;
}
