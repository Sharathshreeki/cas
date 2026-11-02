import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CalendarClockIcon, CircleCheckBigIcon, StoreIcon, WalletIcon } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { FadeIn } from "@/components/motion";
import { OrderProgress } from "@/components/orders/order-progress";
import { CancelOrderButton, SimulatedPayButton } from "@/components/orders/student-order-actions";
import { OrderStatusBadge, PAYMENT_METHOD_LABEL, PaymentBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/dal";
import { canTransition, isTerminal, STATUS_LABEL } from "@/lib/domain/order-status";
import { formatINR } from "@/lib/domain/money";
import { getStudentOrder } from "@/lib/services/order-queries";
import { campusDateKey, formatDateTime, formatSlot, relativeDayLabel } from "@/lib/time";

export default function OrderPage(props: PageProps<"/orders/[code]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      }
    >
      <OrderDetail {...props} />
    </Suspense>
  );
}

async function OrderDetail({ params, searchParams }: PageProps<"/orders/[code]">) {
  const { code } = await params;
  const user = await requireUser(["STUDENT"], `/orders/${code}`);
  // Scoped to the signed-in student: another student's code is a 404 (NFR-47).
  const order = await getStudentOrder(user.id, code.toUpperCase());
  if (!order) notFound();
  const justPlaced = (await searchParams).placed === "1";

  const live = !isTerminal(order.status);
  const needsOnlinePayment =
    order.paymentMethod === "SIMULATED_ONLINE" &&
    (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED") &&
    live;
  const pickupDay = relativeDayLabel(campusDateKey(new Date(order.slotStart)));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {live ? <AutoRefresh /> : null}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/orders">
          <ArrowLeftIcon data-icon="inline-start" /> All orders
        </Link>
      </Button>

      {justPlaced ? (
        <FadeIn className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
          <CircleCheckBigIcon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="font-medium">Order placed — your pickup slot is reserved.</p>
            <p className="text-sm text-muted-foreground">
              Collect it {pickupDay.toLowerCase()} between {formatSlot(order.slotStart, order.slotEnd)} at {order.stallName}.
              {needsOnlinePayment ? " Complete the payment below to confirm it." : null}
            </p>
          </div>
        </FadeIn>
      ) : null}

      <FadeIn>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">#{order.code}</h1>
          <OrderStatusBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} method={order.paymentMethod} orderStatus={order.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Placed {formatDateTime(order.placedAt)}</p>
      </FadeIn>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoTile icon={StoreIcon} label="Stall" value={order.stallName} />
        <InfoTile icon={CalendarClockIcon} label={`Pickup · ${pickupDay}`} value={formatSlot(order.slotStart, order.slotEnd)} />
        <InfoTile icon={WalletIcon} label={PAYMENT_METHOD_LABEL[order.paymentMethod]} value={formatINR(order.total)} />
      </div>

      <Card>
        <CardContent className="pt-2">
          {order.status === "CANCELLED" || order.status === "REJECTED" ? (
            <div className="text-center">
              <OrderStatusBadge status={order.status} className="text-sm" />
              <p className="mt-2 text-sm text-muted-foreground">
                {order.status === "REJECTED" ? "The stall could not fulfil this order." : "This order was cancelled."}
                {order.cancelReason ? ` Reason: ${order.cancelReason}.` : null}
                {order.paymentStatus === "REFUNDED" ? " Your online payment has been refunded." : null}
              </p>
            </div>
          ) : (
            <OrderProgress status={order.status} timestamps={order.timestamps} />
          )}
        </CardContent>
      </Card>

      {needsOnlinePayment || canTransition(order.status, "CANCELLED", "STUDENT") ? (
        <div className="flex flex-wrap gap-2">
          {needsOnlinePayment ? (
            <SimulatedPayButton orderId={order.id} amount={order.total} retry={order.paymentStatus === "FAILED"} />
          ) : null}
          {canTransition(order.status, "CANCELLED", "STUDENT") ? <CancelOrderButton orderId={order.id} code={order.code} /> : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {order.items.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span>
                  <span className="text-muted-foreground tabular-nums">{item.quantity}×</span> {item.name}
                </span>
                <span className="tabular-nums">{formatINR(item.unitPrice * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <Separator className="my-2" />
          <div className="flex items-center justify-between pt-1 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatINR(order.total)}</span>
          </div>
          {order.note ? <p className="mt-4 rounded-lg bg-muted p-3 text-sm">Note: {order.note}</p> : null}
          {order.transactionRef ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Transaction reference: <span className="font-mono">{order.transactionRef}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {order.history.map((h, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" aria-hidden />
                <div>
                  <p>{STATUS_LABEL[h.to]}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(h.at)}
                    {h.note ? ` · ${h.note}` : null}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof StoreIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {label}
      </p>
      <p className="mt-1 font-medium tabular-nums">{value}</p>
    </div>
  );
}
