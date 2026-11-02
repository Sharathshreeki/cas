"use client";

import Link from "next/link";
import { useTransition } from "react";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { markNotificationsRead } from "@/app/actions/profile";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  orderCode: string | null;
};

/** `orderBasePath` (e.g. "/orders") adds a "View" link to each order's page. */
export function NotificationList({ items, orderBasePath }: { items: NotificationItem[]; orderBasePath?: string }) {
  const [pending, startTransition] = useTransition();
  const unread = items.filter((i) => !i.isRead).length;

  if (!items.length) {
    return <EmptyState icon={BellIcon} title="No notifications" description="Order updates will show up here." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{unread ? `${unread} unread` : "All caught up"}</p>
        {unread ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(() => markNotificationsRead())}>
            <CheckCheckIcon data-icon="inline-start" /> Mark all read
          </Button>
        ) : null}
      </div>
      <Stagger className="divide-y rounded-xl border bg-card" stagger={0.03}>
        {items.map((n) => (
          <StaggerItem key={n.id} className="flex items-start gap-3 p-4">
            <span
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-primary")}
              aria-label={n.isRead ? undefined : "Unread"}
            />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", !n.isRead && "font-medium")}>{n.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
            </div>
            {n.orderCode && orderBasePath ? (
              <Button asChild size="sm" variant="ghost">
                <Link href={`${orderBasePath}/${n.orderCode}`}>View</Link>
              </Button>
            ) : null}
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
