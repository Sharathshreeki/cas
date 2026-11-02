import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/dal";
import type { Prisma } from "@/lib/generated/prisma/client";

// Dashboard notifications (FR-90, FR-91). Students receive their own; staff
// share their stall's feed.

function scope(user: CurrentUser): Prisma.NotificationWhereInput {
  return user.role === "STAFF" && user.stallId ? { stallId: user.stallId } : { userId: user.id };
}

export function unreadCount(user: CurrentUser): Promise<number> {
  return db.notification.count({ where: { ...scope(user), isRead: false } });
}

export async function listNotifications(user: CurrentUser, take = 50) {
  const rows = await db.notification.findMany({
    where: scope(user),
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, message: true, isRead: true, createdAt: true, order: { select: { code: true } } },
  });
  return rows.map((n) => ({
    id: n.id,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
    orderCode: n.order?.code ?? null,
  }));
}
