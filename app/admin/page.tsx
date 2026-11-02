import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, StoreIcon, UserCheckIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SalesReport } from "@/components/reports/sales-report";
import { StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Overview" };

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader title="Overview" description="System-wide activity across every stall today." />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Overview />
      </Suspense>
    </>
  );
}

// FR-60, FR-63
async function Overview() {
  await requireUser(["ADMIN"], "/admin");
  const [students, staff, stalls, openStalls, recent] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
    db.user.count({ where: { role: "STAFF", status: "ACTIVE" } }),
    db.stall.count(),
    db.stall.count({ where: { isOpen: true } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile icon={StoreIcon} label="Stalls" value={stalls} hint={`${openStalls} accepting orders`} />
        <StatTile icon={UsersIcon} label="Active students" value={students} />
        <StatTile icon={UserCheckIcon} label="Active staff" value={staff} />
      </div>
      <SalesReport period="today" />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent administrative activity</CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/audit">
              Audit log <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length ? (
            <ul className="divide-y text-sm">
              {recent.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-mono text-xs">{entry.action}</span>
                    <span className="text-muted-foreground"> · {entry.actor?.name ?? "System"}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
