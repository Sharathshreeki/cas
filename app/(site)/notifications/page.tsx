import type { Metadata } from "next";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { NotificationList } from "@/components/notification-list";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/dal";
import { listNotifications } from "@/lib/services/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" description="Updates about your orders." />
      <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
        <Notifications />
      </Suspense>
    </div>
  );
}

async function Notifications() {
  const user = await requireUser(["STUDENT"], "/notifications");
  const items = await listNotifications(user);
  return (
    <>
      <AutoRefresh intervalMs={20_000} />
      <NotificationList items={items} orderHref={(code) => `/orders/${code}`} />
    </>
  );
}
