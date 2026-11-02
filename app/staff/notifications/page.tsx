import type { Metadata } from "next";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { NotificationList } from "@/components/notification-list";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/dal";
import { listNotifications } from "@/lib/services/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default function StaffNotificationsPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Notifications" description="New orders, payments and cancellations for your stall." />
      <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
        <Feed />
      </Suspense>
    </div>
  );
}

async function Feed() {
  const user = await requireStaff();
  const items = await listNotifications(user);
  return (
    <>
      <AutoRefresh intervalMs={15_000} />
      <NotificationList items={items} />
    </>
  );
}
