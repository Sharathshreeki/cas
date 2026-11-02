import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { addDays, campusDateKey, campusDayRange } from "@/lib/time";

// Order and sales summaries (FR-58, FR-63, FR-87…FR-89, FR-92).
// Reporting policy: "sales" counts only orders whose payment is PAID; order
// counts and item quantities count every non-cancelled, non-rejected order.
// Forecasts are never mixed into these figures (BR-12).

export type ReportPeriod = "today" | "7d" | "30d";

export function periodRange(period: ReportPeriod): { start: Date; end: Date; label: string } {
  const today = campusDateKey();
  const end = campusDayRange(today).end;
  if (period === "today") return { start: campusDayRange(today).start, end, label: "Today" };
  const days = period === "7d" ? 7 : 30;
  return { start: campusDayRange(addDays(today, -(days - 1))).start, end, label: `Last ${days} days` };
}

export type SalesSummary = {
  orders: number;
  active: number;
  completed: number;
  cancelled: number;
  itemsSold: number;
  paidSales: number;
  pendingPayments: number;
  averageOrderValue: number;
};

export type ItemSales = { menuItemId: string; name: string; stallName: string; quantity: number; paidSales: number };
export type DailyPoint = { date: string; orders: number; paidSales: number };
export type StallSales = { stallId: string; stallName: string; orders: number; paidSales: number; cancelled: number };

export async function salesReport(range: { start: Date; end: Date }, stallId?: string) {
  const where: Prisma.OrderWhereInput = { placedAt: { gte: range.start, lt: range.end }, ...(stallId ? { stallId } : {}) };

  const validOrder = { ...where, status: { notIn: ["CANCELLED", "REJECTED"] as const } } satisfies Prisma.OrderWhereInput;
  const [byStatus, byPayment, paid, itemRows, orderRows, quantity] = await Promise.all([
    db.order.groupBy({ by: ["status"], where, _count: { _all: true } }),
    db.order.groupBy({
      by: ["paymentStatus"],
      where: validOrder,
      _count: { _all: true },
    }),
    db.order.aggregate({ where: { ...where, paymentStatus: "PAID" }, _sum: { totalAmount: true }, _count: { _all: true } }),
    db.orderItem.groupBy({
      by: ["menuItemId"],
      where: { order: validOrder },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
    db.order.findMany({
      where,
      select: { placedAt: true, status: true, paymentStatus: true, totalAmount: true, stallId: true },
    }),
    db.orderItem.aggregate({ where: { order: validOrder }, _sum: { quantity: true } }),
  ]);

  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const orders = byStatus.reduce((sum, b) => sum + b._count._all, 0);
  const cancelled = count("CANCELLED") + count("REJECTED");
  const paidSales = Number(paid._sum.totalAmount ?? 0);

  const itemMeta = await db.menuItem.findMany({
    where: { id: { in: itemRows.map((i) => i.menuItemId) } },
    select: { id: true, name: true, stall: { select: { name: true } } },
  });
  const paidByItem = await db.orderItem.findMany({
    where: { menuItemId: { in: itemRows.map((i) => i.menuItemId) }, order: { ...where, paymentStatus: "PAID" } },
    select: { menuItemId: true, quantity: true, unitPrice: true },
  });

  const topItems: ItemSales[] = itemRows.map((row) => {
    const meta = itemMeta.find((m) => m.id === row.menuItemId);
    return {
      menuItemId: row.menuItemId,
      name: meta?.name ?? "Unknown item",
      stallName: meta?.stall.name ?? "",
      quantity: row._sum.quantity ?? 0,
      paidSales: paidByItem
        .filter((p) => p.menuItemId === row.menuItemId)
        .reduce((sum, p) => sum + Number(p.unitPrice) * p.quantity, 0),
    };
  });

  const daily = new Map<string, DailyPoint>();
  for (let d = campusDateKey(range.start); d < campusDateKey(range.end); d = addDays(d, 1)) {
    daily.set(d, { date: d, orders: 0, paidSales: 0 });
  }
  const perStall = new Map<string, { orders: number; paidSales: number; cancelled: number }>();
  for (const o of orderRows) {
    const point = daily.get(campusDateKey(o.placedAt));
    const stall = perStall.get(o.stallId) ?? { orders: 0, paidSales: 0, cancelled: 0 };
    stall.orders++;
    if (point) point.orders++;
    if (o.status === "CANCELLED" || o.status === "REJECTED") stall.cancelled++;
    if (o.paymentStatus === "PAID") {
      const amount = Number(o.totalAmount);
      stall.paidSales += amount;
      if (point) point.paidSales += amount;
    }
    perStall.set(o.stallId, stall);
  }

  const stallNames = await db.stall.findMany({ select: { id: true, name: true } });
  const byStall: StallSales[] = stallNames
    .filter((s) => !stallId || s.id === stallId)
    .map((s) => ({ stallId: s.id, stallName: s.name, ...(perStall.get(s.id) ?? { orders: 0, paidSales: 0, cancelled: 0 }) }))
    .sort((a, b) => b.paidSales - a.paidSales);

  const summary: SalesSummary = {
    orders,
    active: count("PLACED") + count("ACCEPTED") + count("PREPARING") + count("READY"),
    completed: count("COMPLETED"),
    cancelled,
    itemsSold: quantity._sum.quantity ?? 0,
    paidSales,
    pendingPayments: byPayment.find((p) => p.paymentStatus === "PENDING")?._count._all ?? 0,
    averageOrderValue: paid._count._all ? paidSales / paid._count._all : 0,
  };

  return { summary, topItems, daily: [...daily.values()], byStall };
}
