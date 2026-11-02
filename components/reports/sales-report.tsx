import Link from "next/link";
import { BanIcon, ClipboardListIcon, IndianRupeeIcon, PackageIcon, ReceiptIcon } from "lucide-react";
import { FadeIn } from "@/components/motion";
import { StatTile } from "@/components/stat-tile";
import { DailyBarChart } from "@/components/reports/daily-bar-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/domain/money";
import { periodRange, salesReport, type ReportPeriod } from "@/lib/services/reports";
import { cn } from "@/lib/utils";

export const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

export function parsePeriod(value: unknown): ReportPeriod {
  return value === "today" || value === "30d" ? value : "7d";
}

/** Period selector: one row above everything it scopes. */
export function PeriodTabs({ period, basePath }: { period: ReportPeriod; basePath: string }) {
  return (
    <nav aria-label="Report period" className="mb-6 flex w-fit gap-1 rounded-lg bg-muted p-1">
      {PERIODS.map((p) => (
        <Link
          key={p.key}
          href={`${basePath}?period=${p.key}`}
          aria-current={p.key === period ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            p.key === period ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

// FR-58, FR-63, FR-87…FR-89, FR-92. Every figure here is an actual, recorded
// value — forecasts live on their own page and are labelled as estimates.
export async function SalesReport({ period, stallId }: { period: ReportPeriod; stallId?: string }) {
  const range = periodRange(period);
  const { summary: s, topItems, daily, byStall } = await salesReport(range, stallId);
  const maxQty = Math.max(1, ...topItems.map((i) => i.quantity));

  return (
    <FadeIn className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile icon={IndianRupeeIcon} label="Paid sales" value={formatINR(s.paidSales)} hint="Actual, from paid orders" />
        <StatTile icon={ClipboardListIcon} label="Orders" value={s.orders} hint={`${s.completed} completed`} />
        <StatTile icon={PackageIcon} label="Items sold" value={s.itemsSold} hint="Excludes cancelled" />
        <StatTile icon={ReceiptIcon} label="Avg. paid order" value={formatINR(Math.round(s.averageOrderValue))} />
        <StatTile icon={BanIcon} label="Cancelled / rejected" value={s.cancelled} hint={`${s.pendingPayments} unpaid open orders`} />
      </div>

      {period !== "today" ? (
        <Card>
          <CardHeader>
            <CardTitle>Daily trend</CardTitle>
            <CardDescription>{range.label} · actual recorded values</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyBarChart data={daily} />
          </CardContent>
        </Card>
      ) : null}

      <div className={cn("grid gap-6", !stallId && "lg:grid-cols-2")}>
        <Card>
          <CardHeader>
            <CardTitle>Top items</CardTitle>
            <CardDescription>Quantity sold, {range.label.toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            {topItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales in this period.</p>
            ) : (
              <ol className="space-y-3">
                {topItems.map((item, i) => (
                  <li key={item.menuItemId} className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
                    <span className="text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="truncate">
                      {item.name}
                      {!stallId ? <span className="text-muted-foreground"> · {item.stallName}</span> : null}
                    </span>
                    <span className="text-right font-medium tabular-nums">{item.quantity}</span>
                    <span />
                    <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-chart-bar" style={{ width: `${(item.quantity / maxQty) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {!stallId ? (
          <Card>
            <CardHeader>
              <CardTitle>By stall</CardTitle>
              <CardDescription>{range.label}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Stall</th>
                    <th className="pb-2 text-right font-medium">Orders</th>
                    <th className="pb-2 text-right font-medium">Cancelled</th>
                    <th className="pb-2 text-right font-medium">Paid sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byStall.map((row) => (
                    <tr key={row.stallId}>
                      <td className="py-2">{row.stallName}</td>
                      <td className="py-2 text-right tabular-nums">{row.orders}</td>
                      <td className="py-2 text-right tabular-nums">{row.cancelled}</td>
                      <td className="py-2 text-right font-medium tabular-nums">{formatINR(row.paidSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </FadeIn>
  );
}
