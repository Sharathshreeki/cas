import type { Metadata } from "next";
import { Suspense } from "react";
import { ClipboardListIcon, IndianRupeeIcon, PackageCheckIcon, TimerIcon } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { OrderBoard } from "@/components/staff/order-board";
import { StallOpenToggle } from "@/components/staff/stall-open-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/domain/money";
import { listStallBoardOrders } from "@/lib/services/order-queries";
import { periodRange, salesReport } from "@/lib/services/reports";
import { campusDateKey, campusDayRange } from "@/lib/time";

export const metadata: Metadata = { title: "Orders" };

export default function StaffOrdersPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <Board />
    </Suspense>
  );
}

async function Board() {
  const user = await requireStaff();
  const today = campusDayRange(campusDateKey());
  const [stall, orders, report] = await Promise.all([
    db.stall.findUniqueOrThrow({ where: { id: user.stallId }, select: { isOpen: true } }),
    listStallBoardOrders(user.stallId, today.start),
    salesReport(periodRange("today"), user.stallId),
  ]);
  const s = report.summary;

  return (
    <>
      <AutoRefresh intervalMs={10_000} />
      <PageHeader
        title={user.stallName}
        description="Incoming orders refresh automatically every few seconds."
        actions={<StallOpenToggle isOpen={stall.isOpen} />}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={ClipboardListIcon} label="Orders today" value={s.orders} hint={`${s.cancelled} cancelled or rejected`} />
        <StatTile icon={TimerIcon} label="In progress" value={s.active} />
        <StatTile icon={PackageCheckIcon} label="Completed" value={s.completed} hint={`${s.itemsSold} items sold`} />
        <StatTile icon={IndianRupeeIcon} label="Paid sales today" value={formatINR(s.paidSales)} hint={`${s.pendingPayments} payments pending`} />
      </div>
      <OrderBoard orders={orders} />
    </>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
