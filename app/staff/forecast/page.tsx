import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FlaskConicalIcon, InfoIcon } from "lucide-react";
import { FadeIn } from "@/components/motion";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/dal";
import { getDemandForecast } from "@/lib/services/insights";
import { addDays, campusDateKey, formatDateTime, relativeDayLabel } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Demand forecast" };

export default function ForecastPage({ searchParams }: PageProps<"/staff/forecast">) {
  return (
    <>
      <PageHeader
        title="Demand forecast"
        description="Estimated portions per item to help plan preparation. Estimates are not guaranteed demand."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <ForecastContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

// UC-03: FR-59, FR-68…FR-72, NFR-55…NFR-57, BR-12, BR-14
async function ForecastContent({ searchParams }: Pick<PageProps<"/staff/forecast">, "searchParams">) {
  const user = await requireStaff();
  const today = campusDateKey();
  const options = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const requested = (await searchParams).date;
  const date = typeof requested === "string" && options.includes(requested) ? requested : options[1];
  const forecast = await getDemandForecast(user.stallId, date);
  const withEstimate = forecast.rows.filter((r) => r.predicted !== null);
  const total = withEstimate.reduce((sum, r) => sum + (r.predicted ?? 0), 0);

  return (
    <FadeIn className="space-y-6">
      <nav aria-label="Forecast date" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
        {options.map((d) => (
          <Link
            key={d}
            href={`/staff/forecast?date=${d}`}
            aria-current={d === date ? "date" : undefined}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-sm transition-colors",
              d === date ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {relativeDayLabel(d)}
          </Link>
        ))}
      </nav>

      <Alert>
        {forecast.source === "MODEL" ? <FlaskConicalIcon /> : <InfoIcon />}
        <AlertTitle>
          {forecast.source === "MODEL" ? `Model forecast · ${forecast.modelVersion}` : "Baseline estimate (ML model not connected)"}
        </AlertTitle>
        <AlertDescription>
          <p>
            {forecast.method}. Period: whole day · unit: {forecast.unit}. Generated {formatDateTime(forecast.generatedAt)}.
          </p>
          <p>Forecasts support planning only — they never create orders and may differ from actual demand.</p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Estimated demand by item for {relativeDayLabel(date)}</caption>
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 text-right font-medium">Estimated portions</th>
                <th className="hidden pb-2 text-right font-medium sm:table-cell">Actual sold, same weekday (last 4 weeks)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {forecast.rows.map((row) => (
                <tr key={row.menuItemId}>
                  <td className="py-2.5">
                    {row.name}
                    {!row.isAvailable ? <span className="ml-2 text-xs text-muted-foreground">(unavailable)</span> : null}
                  </td>
                  <td className="py-2.5 text-right">
                    {row.predicted === null ? (
                      <span className="text-xs text-muted-foreground">Insufficient data</span>
                    ) : (
                      <span className="font-semibold tabular-nums">≈ {row.predicted}</span>
                    )}
                  </td>
                  <td className="hidden py-2.5 text-right text-muted-foreground tabular-nums sm:table-cell">
                    {row.history.length ? row.history.join(" · ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {withEstimate.length ? (
              <tfoot>
                <tr className="border-t">
                  <td className="pt-2.5 font-medium">Total estimate</td>
                  <td className="pt-2.5 text-right font-semibold tabular-nums">≈ {Math.round(total)}</td>
                  <td className="hidden sm:table-cell" />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </CardContent>
      </Card>
    </FadeIn>
  );
}
