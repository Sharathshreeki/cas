"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BellRingIcon, ClipboardListIcon, Loader2Icon, MessageSquareTextIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { OrderStatusBadge, PaymentBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateOrderStatus } from "@/app/actions/orders";
import { allowedTransitions, TRANSITION_ACTION_LABEL, type OrderStatusValue } from "@/lib/domain/order-status";
import { formatINR } from "@/lib/domain/money";
import type { OrderSummaryDTO } from "@/lib/services/order-queries";
import { campusDateKey, formatSlot, relativeDayLabel } from "@/lib/time";
import { cn } from "@/lib/utils";

const TABS: { key: string; label: string; statuses: OrderStatusValue[] }[] = [
  { key: "new", label: "New", statuses: ["PLACED"] },
  { key: "accepted", label: "Accepted", statuses: ["ACCEPTED"] },
  { key: "preparing", label: "Preparing", statuses: ["PREPARING"] },
  { key: "ready", label: "Ready", statuses: ["READY"] },
  { key: "done", label: "Done today", statuses: ["COMPLETED", "CANCELLED", "REJECTED"] },
];

// FR-33, FR-34, FR-54, FR-55, FR-57, FR-91
export function OrderBoard({ orders }: { orders: OrderSummaryDTO[] }) {
  const [tab, setTab] = useState("new");
  const seen = useRef<Set<string> | null>(null);

  // Announce orders that arrived since the last refresh.
  useEffect(() => {
    const placed = orders.filter((o) => o.status === "PLACED");
    if (seen.current) {
      const fresh = placed.filter((o) => !seen.current!.has(o.id));
      if (fresh.length) {
        toast(`${fresh.length === 1 ? `New order #${fresh[0].code}` : `${fresh.length} new orders`}`, {
          icon: <BellRingIcon className="size-4 text-primary" />,
          description: fresh.length === 1 ? `Pickup ${formatSlot(fresh[0].slotStart, fresh[0].slotEnd)}` : undefined,
        });
      }
    }
    seen.current = new Set(placed.map((o) => o.id));
  }, [orders]);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, orders.filter((o) => t.statuses.includes(o.status)).length])),
    [orders],
  );
  const visible = orders.filter((o) => TABS.find((t) => t.key === tab)!.statuses.includes(o.status));

  return (
    <div>
      <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Order status">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab === t.key ? (
              <motion.span layoutId="board-tab" className="absolute inset-0 -z-10 rounded-lg border bg-card shadow-sm" />
            ) : null}
            {t.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                t.key === "new" && counts[t.key] > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={ClipboardListIcon}
          title={tab === "new" ? "No new orders" : "Nothing here"}
          description={tab === "new" ? "New orders appear here automatically." : "Orders move here as you update them."}
        />
      ) : (
        <motion.div layout className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: OrderSummaryDTO }) {
  const [pending, startTransition] = useTransition();
  const [reasonFor, setReasonFor] = useState<OrderStatusValue | null>(null);
  const [reason, setReason] = useState("");
  const transitions = allowedTransitions(order.status, "STAFF");
  const forward = transitions.find((t) => t !== "CANCELLED" && t !== "REJECTED");
  const negative = transitions.filter((t) => t === "CANCELLED" || t === "REJECTED");
  const day = campusDateKey(new Date(order.slotStart));
  const isToday = day === campusDateKey();

  function move(to: OrderStatusValue, note?: string) {
    startTransition(async () => {
      const result = await updateOrderStatus(order.id, to, note);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  const blockedHandover =
    forward === "COMPLETED" && order.paymentMethod === "SIMULATED_ONLINE" && order.paymentStatus !== "PAID";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className={cn("flex flex-col rounded-xl border bg-card p-4", order.status === "PLACED" && "border-primary/40")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold">#{order.code}</p>
          <p className="text-sm text-muted-foreground">{order.studentName}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums">{formatSlot(order.slotStart, order.slotEnd)}</p>
          {!isToday ? <p className="text-xs text-muted-foreground">{relativeDayLabel(day)}</p> : null}
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {order.items.map((item, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span>
              <span className="font-semibold tabular-nums">{item.quantity}×</span> {item.name}
            </span>
          </li>
        ))}
      </ul>
      {order.note ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs">
          <MessageSquareTextIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {order.note}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <OrderStatusBadge status={order.status} />
        <PaymentBadge status={order.paymentStatus} method={order.paymentMethod} orderStatus={order.status} />
        <span className="ml-auto text-sm font-medium tabular-nums">{formatINR(order.total)}</span>
      </div>

      {transitions.length ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
          {forward ? (
            <Button size="sm" className="flex-1" disabled={pending || blockedHandover} onClick={() => move(forward)}>
              {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
              {TRANSITION_ACTION_LABEL[forward]}
              {forward === "COMPLETED" && order.paymentMethod === "CASH_ON_PICKUP" && order.paymentStatus !== "PAID"
                ? ` · collect ${formatINR(order.total)}`
                : null}
            </Button>
          ) : null}
          {negative.map((to) => (
            <Button key={to} size="sm" variant="outline" disabled={pending} onClick={() => setReasonFor(to)}>
              {TRANSITION_ACTION_LABEL[to]}
            </Button>
          ))}
          {blockedHandover ? (
            <p className="w-full text-xs text-muted-foreground">Waiting for the student&apos;s online payment.</p>
          ) : null}
        </div>
      ) : null}

      <Dialog open={reasonFor !== null} onOpenChange={(open) => !open && setReasonFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reasonFor === "REJECTED" ? "Reject" : "Cancel"} order #{order.code}?
            </DialogTitle>
            <DialogDescription>
              The student is notified, the pickup slot is released and any online payment is refunded.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={`reason-${order.id}`}>Reason</Label>
            <Textarea
              id={`reason-${order.id}`}
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Item ran out"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonFor(null)}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const to = reasonFor!;
                setReasonFor(null);
                move(to, reason.trim() || undefined);
                setReason("");
              }}
            >
              {reasonFor === "REJECTED" ? "Reject order" : "Cancel order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.article>
  );
}
