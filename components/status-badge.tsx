import {
  BanIcon,
  CheckCheckIcon,
  CheckIcon,
  ChefHatIcon,
  CircleDotIcon,
  ClockIcon,
  PackageCheckIcon,
  RotateCcwIcon,
  WalletIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type OrderStatusValue } from "@/lib/domain/order-status";

// Status is always conveyed by text and icon, never color alone (NFR-28).

const STATUS_STYLE: Record<OrderStatusValue, { className: string; icon: typeof CheckIcon }> = {
  PLACED: { className: "bg-info/10 text-info border-info/25", icon: CircleDotIcon },
  ACCEPTED: { className: "bg-primary/10 text-primary border-primary/25", icon: CheckIcon },
  PREPARING: { className: "bg-warning/15 text-warning-foreground dark:text-warning border-warning/30", icon: ChefHatIcon },
  READY: { className: "bg-success/12 text-success border-success/30", icon: PackageCheckIcon },
  COMPLETED: { className: "bg-muted text-muted-foreground border-border", icon: CheckCheckIcon },
  CANCELLED: { className: "bg-destructive/10 text-destructive border-destructive/25", icon: XIcon },
  REJECTED: { className: "bg-destructive/10 text-destructive border-destructive/25", icon: BanIcon },
};

const badgeBase = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function OrderStatusBadge({ status, className }: { status: OrderStatusValue; className?: string }) {
  const { className: tone, icon: Icon } = STATUS_STYLE[status];
  return (
    <span className={cn(badgeBase, tone, className)}>
      <Icon className="size-3" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

type PaymentStatusValue = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

const PAYMENT_STYLE: Record<PaymentStatusValue, { label: string; className: string; icon: typeof CheckIcon }> = {
  PENDING: { label: "Payment pending", className: "bg-warning/15 text-warning-foreground dark:text-warning border-warning/30", icon: ClockIcon },
  PAID: { label: "Paid", className: "bg-success/12 text-success border-success/30", icon: WalletIcon },
  FAILED: { label: "Payment failed", className: "bg-destructive/10 text-destructive border-destructive/25", icon: XIcon },
  REFUNDED: { label: "Refunded", className: "bg-muted text-muted-foreground border-border", icon: RotateCcwIcon },
};

export function PaymentBadge({
  status,
  method,
  orderStatus,
  className,
}: {
  status: PaymentStatusValue;
  method?: "CASH_ON_PICKUP" | "SIMULATED_ONLINE";
  orderStatus?: OrderStatusValue;
  className?: string;
}) {
  const voided = status === "PENDING" && (orderStatus === "CANCELLED" || orderStatus === "REJECTED");
  const style = PAYMENT_STYLE[status];
  const label = voided
    ? "Not charged"
    : status === "PENDING" && method === "CASH_ON_PICKUP"
      ? "Pay at pickup"
      : style.label;
  const Icon = style.icon;
  return (
    <span className={cn(badgeBase, voided ? PAYMENT_STYLE.REFUNDED.className : style.className, className)}>
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}

export const PAYMENT_METHOD_LABEL = {
  CASH_ON_PICKUP: "Cash at pickup",
  SIMULATED_ONLINE: "Online (simulated)",
} as const;
