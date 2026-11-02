import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { parsePeriod, PeriodTabs, SalesReport } from "@/components/reports/sales-report";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Reports" };

export default function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Orders, sales and item popularity across all stalls. Sales count only paid orders."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Report searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Report({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  await requireUser(["ADMIN"], "/admin/reports");
  const period = parsePeriod((await searchParams).period);
  return (
    <>
      <PeriodTabs period={period} basePath="/admin/reports" />
      <SalesReport period={period} />
    </>
  );
}
