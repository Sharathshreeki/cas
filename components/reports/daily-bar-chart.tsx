"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/domain/money";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

type Point = { date: string; orders: number; paidSales: number };
type Metric = "paidSales" | "orders";

const METRICS: { key: Metric; label: string; format: (n: number) => string }[] = [
  { key: "paidSales", label: "Paid sales", format: formatINR },
  { key: "orders", label: "Orders", format: (n) => n.toLocaleString("en-IN") },
];

const dayLabel = (date: string) => formatDate(`${date}T06:30:00Z`);

/**
 * Single-series daily bar chart. One metric at a time on one axis; each bar is
 * a focusable hit target with a tooltip, and a table view exposes every value.
 */
export function DailyBarChart({ data }: { data: Point[] }) {
  const [metric, setMetric] = useState<Metric>("paidSales");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  const { format, label } = METRICS.find((m) => m.key === metric)!;
  const max = Math.max(1, ...data.map((d) => d[metric]));
  const total = data.reduce((sum, d) => sum + d[metric], 0);
  const peak = data.reduce((best, d, i) => (d[metric] > data[best][metric] ? i : best), 0);
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Metric">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={metric === m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                metric === m.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <Button size="xs" variant="ghost" onClick={() => setView(view === "chart" ? "table" : "chart")}>
          {view === "chart" ? "Show table" : "Show chart"}
        </Button>
      </div>

      {view === "table" ? (
        <div className="max-h-72 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Orders</th>
                <th className="px-3 py-2 text-right font-medium">Paid sales</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((d) => (
                <tr key={d.date}>
                  <td className="px-3 py-1.5">{dayLabel(d.date)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.orders}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatINR(d.paidSales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <figure>
          <figcaption className="mb-3 text-sm text-muted-foreground">
            {label}: <span className="font-semibold text-foreground tabular-nums">{format(total)}</span> in this period
          </figcaption>
          <div className="relative">
            {/* Recessive gridlines at 0, 50% and 100% of the max. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-48" aria-hidden>
              {[0, 0.5, 1].map((f) => (
                <div key={f} className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: `${f * 100}%` }}>
                  <span className="absolute -top-2 right-0 bg-card pl-1 text-[10px] text-muted-foreground tabular-nums">
                    {format(Math.round(max * (1 - f)))}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex h-48 items-end gap-[2px] pr-12" role="list" aria-label={`${label} by day`}>
              {data.map((d, i) => (
                <div
                  key={d.date}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${dayLabel(d.date)}: ${format(d[metric])}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="group relative flex h-full flex-1 items-end outline-none"
                >
                  <motion.div
                    className={cn(
                      "w-full rounded-t-[4px] bg-chart-bar transition-opacity",
                      hover !== null && hover !== i && "opacity-60",
                      "group-focus-visible:ring-2 group-focus-visible:ring-ring",
                    )}
                    initial={{ height: 0 }}
                    animate={{ height: `${(d[metric] / max) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.01, ease: [0.22, 1, 0.36, 1] }}
                    style={{ minHeight: d[metric] > 0 ? 2 : 0 }}
                  />
                  {hover === i ? (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md">
                      <p className="font-semibold text-foreground tabular-nums">{format(d[metric])}</p>
                      <p className="text-muted-foreground">{dayLabel(d.date)}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-[2px] pr-12 text-[10px] text-muted-foreground" aria-hidden>
              {data.map((d, i) => (
                <span key={d.date} className="flex flex-1 justify-center overflow-visible whitespace-nowrap">
                  {i % labelEvery === 0 || i === peak ? dayLabel(d.date).split(" ").slice(1).join(" ") : ""}
                </span>
              ))}
            </div>
          </div>
        </figure>
      )}
    </div>
  );
}
