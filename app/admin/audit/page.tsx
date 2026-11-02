import type { Metadata } from "next";
import { Suspense } from "react";
import { ScrollTextIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Audit log" };

export default function AuditPage() {
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Sign-ins, account changes, stall and menu changes and settings updates (latest 200)."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <AuditLog />
      </Suspense>
    </>
  );
}

// FR-65, NFR-14
async function AuditLog() {
  await requireUser(["ADMIN"], "/admin/audit");
  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { name: true, email: true } } },
  });
  if (!entries.length) return <EmptyState icon={ScrollTextIcon} title="No events yet" />;

  return (
    <Card>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="pb-2 font-medium">When</th>
              <th className="pb-2 font-medium">Actor</th>
              <th className="pb-2 font-medium">Action</th>
              <th className="pb-2 font-medium">Target</th>
              <th className="pb-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{formatDateTime(e.createdAt)}</td>
                <td className="py-2 pr-3">{e.actor?.name ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="py-2 pr-3 font-mono text-xs">{e.action}</td>
                <td className="py-2 pr-3 text-xs text-muted-foreground">
                  {e.entity}
                  {e.entityId ? <span className="block font-mono">{e.entityId.slice(0, 12)}</span> : null}
                </td>
                <td className="max-w-xs py-2 font-mono text-[11px] break-all text-muted-foreground">
                  {e.details ? JSON.stringify(e.details) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
