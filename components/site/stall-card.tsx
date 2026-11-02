import Link from "next/link";
import { ArrowRightIcon, ClockIcon, MapPinIcon } from "lucide-react";
import { isServingNow, type StallSummary } from "@/lib/services/catalog";
import { minutesToLabel } from "@/lib/time";
import { cn } from "@/lib/utils";

export function StallStatus({ stall }: { stall: Pick<StallSummary, "isOpen" | "opensAt" | "closesAt"> }) {
  const serving = isServingNow(stall);
  const label = !stall.isOpen ? "Closed" : serving ? "Open now" : "Pre-order";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        !stall.isOpen ? "bg-muted text-muted-foreground" : serving ? "bg-success/12 text-success" : "bg-info/10 text-info",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", !stall.isOpen ? "bg-muted-foreground" : serving ? "bg-success" : "bg-info")}
        aria-hidden
      />
      {label}
    </span>
  );
}

export function StallCard({ stall }: { stall: StallSummary }) {
  return (
    <Link
      href={`/stalls/${stall.id}`}
      className="group flex h-full flex-col rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold tracking-tight">{stall.name}</h3>
        <StallStatus stall={stall} />
      </div>
      {stall.description ? <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{stall.description}</p> : null}
      <div className="mt-auto space-y-1.5 pt-4 text-xs text-muted-foreground">
        {stall.location ? (
          <p className="flex items-center gap-1.5">
            <MapPinIcon className="size-3.5" aria-hidden /> {stall.location}
          </p>
        ) : null}
        <p className="flex items-center gap-1.5">
          <ClockIcon className="size-3.5" aria-hidden /> {minutesToLabel(stall.opensAt)} – {minutesToLabel(stall.closesAt)}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">
          {stall.availableCount} of {stall.itemCount} items available
        </span>
        <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
  );
}
