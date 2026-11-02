import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { parsePeriod, PeriodTabs, SalesReport } from "@/components/reports/sales-report";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Reports" };

export default function StaffReportsPage({ searchParams }: PageProps<"/staff/reports">) {
  return (
    <>
      <PageHeader title="Reports" description="Orders and sales for your stall. Sales count only paid orders." />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Report searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Report({ searchParams }: Pick<PageProps<"/staff/reports">, "searchParams">) {
  const user = await requireStaff();
  const period = parsePeriod((await searchParams).period);
  return (
    <>
      <PeriodTabs period={period} basePath="/staff/reports" />
      <SalesReport period={period} stallId={user.stallId} />
    </>
  );
}
