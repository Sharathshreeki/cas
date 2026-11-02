import "server-only";
import { db } from "@/lib/db";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";

// Read models for orders. Every query is scoped by the caller's identity
// (NFR-08, NFR-09, NFR-47): students see their own orders, staff their stall's.

export type OrderSummaryDTO = {
  id: string;
  code: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  total: number;
  placedAt: string;
  slotStart: string;
  slotEnd: string;
  stallName: string;
  studentName: string;
  note: string | null;
  items: { name: string; quantity: number; unitPrice: number }[];
};

const summarySelect = {
  id: true,
  code: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  totalAmount: true,
  placedAt: true,
  note: true,
  slot: { select: { startsAt: true, endsAt: true } },
  stall: { select: { name: true } },
  student: { select: { name: true } },
  items: { select: { itemName: true, quantity: true, unitPrice: true } },
} satisfies Prisma.OrderSelect;

type SummaryRow = Prisma.OrderGetPayload<{ select: typeof summarySelect }>;

function toSummary(o: SummaryRow): OrderSummaryDTO {
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    total: Number(o.totalAmount.toString()),
    placedAt: o.placedAt.toISOString(),
    slotStart: o.slot.startsAt.toISOString(),
    slotEnd: o.slot.endsAt.toISOString(),
    stallName: o.stall.name,
    studentName: o.student.name,
    note: o.note,
    items: o.items.map((i) => ({ name: i.itemName, quantity: i.quantity, unitPrice: Number(i.unitPrice.toString()) })),
  };
}

export async function listStudentOrders(studentId: string): Promise<OrderSummaryDTO[]> {
  const orders = await db.order.findMany({
    where: { studentId },
    orderBy: { placedAt: "desc" },
    take: 100,
    select: summarySelect,
  });
  return orders.map(toSummary);
}

export type OrderDetailDTO = OrderSummaryDTO & {
  cancelReason: string | null;
  transactionRef: string | null;
  timestamps: Partial<Record<OrderStatus, string>>;
  history: { from: OrderStatus | null; to: OrderStatus; at: string; note: string | null }[];
};

/** Order detail for its owning student. Returns null for anyone else's order. */
export async function getStudentOrder(studentId: string, code: string): Promise<OrderDetailDTO | null> {
  const order = await db.order.findFirst({
    where: { code, studentId },
    select: {
      ...summarySelect,
      cancelReason: true,
      acceptedAt: true,
      preparingAt: true,
      readyAt: true,
      completedAt: true,
      cancelledAt: true,
      payment: { select: { transactionRef: true } },
      history: { orderBy: { createdAt: "asc" }, select: { fromStatus: true, toStatus: true, createdAt: true, note: true } },
    },
  });
  if (!order) return null;
  const iso = (d: Date | null) => (d ? d.toISOString() : undefined);
  return {
    ...toSummary(order),
    cancelReason: order.cancelReason,
    transactionRef: order.payment?.transactionRef ?? null,
    timestamps: {
      PLACED: order.placedAt.toISOString(),
      ACCEPTED: iso(order.acceptedAt),
      PREPARING: iso(order.preparingAt),
      READY: iso(order.readyAt),
      COMPLETED: iso(order.completedAt),
      CANCELLED: order.status === "CANCELLED" ? iso(order.cancelledAt) : undefined,
      REJECTED: order.status === "REJECTED" ? iso(order.cancelledAt) : undefined,
    },
    history: order.history.map((h) => ({ from: h.fromStatus, to: h.toStatus, at: h.createdAt.toISOString(), note: h.note })),
  };
}

/**
 * Orders for the staff board (FR-33, FR-54, FR-55, FR-57): every active order
 * plus orders finished today, ordered by pickup time.
 */
export async function listStallBoardOrders(stallId: string, since: Date): Promise<OrderSummaryDTO[]> {
  const orders = await db.order.findMany({
    where: {
      stallId,
      OR: [
        { status: { in: ["PLACED", "ACCEPTED", "PREPARING", "READY"] } },
        { updatedAt: { gte: since } },
      ],
    },
    orderBy: [{ slot: { startsAt: "asc" } }, { placedAt: "asc" }],
    take: 300,
    select: summarySelect,
  });
  return orders.map(toSummary);
}
