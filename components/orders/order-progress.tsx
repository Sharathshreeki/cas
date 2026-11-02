"use client";

import { motion } from "motion/react";
import { CheckIcon } from "lucide-react";
import { PROGRESS_STEPS, STATUS_LABEL, type OrderStatusValue } from "@/lib/domain/order-status";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Animated lifecycle tracker for a student's order (FR-32, NFR-25). */
export function OrderProgress({
  status,
  timestamps,
}: {
  status: OrderStatusValue;
  timestamps: Partial<Record<OrderStatusValue, string>>;
}) {
  const current = PROGRESS_STEPS.indexOf(status);
  const progress = current <= 0 ? 0 : current / (PROGRESS_STEPS.length - 1);

  return (
    <ol className="relative grid grid-cols-5" aria-label="Order progress">
      <div className="absolute top-3.5 right-[10%] left-[10%] h-0.5 bg-border" aria-hidden>
        <motion.div
          className="h-full origin-left bg-primary"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progress }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {PROGRESS_STEPS.map((step, i) => {
        const done = i < current || status === "COMPLETED";
        const active = i === current && status !== "COMPLETED";
        return (
          <li key={step} className="relative flex flex-col items-center gap-2 text-center" aria-current={active ? "step" : undefined}>
            <motion.span
              initial={false}
              animate={{ scale: active ? 1.1 : 1 }}
              className={cn(
                "relative z-10 grid size-7 place-items-center rounded-full border-2 bg-background text-xs font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary",
                !done && !active && "text-muted-foreground",
              )}
            >
              {active ? (
                <motion.span
                  className="absolute inset-0 rounded-full border-2 border-primary"
                  animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                  aria-hidden
                />
              ) : null}
              {done ? <CheckIcon className="size-3.5" aria-hidden /> : i + 1}
            </motion.span>
            <span className={cn("text-[11px] leading-tight sm:text-xs", active ? "font-medium" : "text-muted-foreground")}>
              {STATUS_LABEL[step]}
              {timestamps[step] ? (
                <span className="block text-[10px] text-muted-foreground tabular-nums">{formatTime(timestamps[step]!)}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
