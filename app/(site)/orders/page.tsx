import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRightIcon, ReceiptTextIcon } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState } from "@/components/empty-state";
import { Stagger, StaggerItem } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { OrderStatusBadge, PaymentBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/dal";
import { isTerminal } from "@/lib/domain/order-status";
import { formatINR } from "@/lib/domain/money";
import { listStudentOrders, type OrderSummaryDTO } from "@/lib/services/order-queries";
import { campusDateKey, formatSlot, relativeDayLabel } from "@/lib/time";

export const metadata: Metadata = { title: "My orders" };

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="My orders" description="Track current orders and look back at previous ones." />
      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        }
      >
        <OrderList />
      </Suspense>
    </>
  );
}

async function OrderList() {
  const user = await requireUser(["STUDENT"], "/orders");
  const orders = await listStudentOrders(user.id);

  if (!orders.length) {
    return (
      <EmptyState
        icon={ReceiptTextIcon}
        title="No orders yet"
        description="When you place an order, you can track it here."
        action={
          <Button asChild>
            <Link href="/stalls">Browse stalls</Link>
          </Button>
        }
      />
    );
  }

  const current = orders.filter((o) => !isTerminal(o.status));
  const past = orders.filter((o) => isTerminal(o.status));

  return (
    <div className="space-y-8">
      {current.length ? <AutoRefresh intervalMs={15_000} /> : null}
      {current.length ? <OrderSection title="Current" orders={current} /> : null}
      {past.length ? <OrderSection title="Past orders" orders={past} /> : null}
    </div>
  );
}

function OrderSection({ title, orders }: { title: string; orders: OrderSummaryDTO[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <Stagger className="space-y-3">
        {orders.map((o) => (
          <StaggerItem key={o.id}>
            <Link
              href={`/orders/${o.code}`}
              className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">#{o.code}</span>
                  <span className="text-sm text-muted-foreground">· {o.stallName}</span>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={o.status} />
                  <PaymentBadge status={o.paymentStatus} method={o.paymentMethod} orderStatus={o.status} />
                  <span className="text-xs text-muted-foreground">
                    Pickup {relativeDayLabel(campusDateKey(new Date(o.slotStart)))}, {formatSlot(o.slotStart, o.slotEnd)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{formatINR(o.total)}</span>
                <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
