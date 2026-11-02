import type { Metadata } from "next";
import { Suspense } from "react";
import { StallManager } from "@/components/admin/stall-manager";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Stalls" };

export default function AdminStallsPage() {
  return (
    <>
      <PageHeader title="Stalls" description="Create stalls, set operating hours and slot capacity, and open or close them." />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Stalls />
      </Suspense>
    </>
  );
}

async function Stalls() {
  await requireUser(["ADMIN"], "/admin/stalls");
  const stalls = await db.stall.findMany({
    orderBy: { name: "asc" },
    include: {
      staff: { where: { status: "ACTIVE" }, select: { name: true } },
      _count: { select: { menuItems: { where: { isArchived: false } } } },
    },
  });
  return (
    <StallManager
      stalls={stalls.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        location: s.location,
        isOpen: s.isOpen,
        opensAt: s.opensAt,
        closesAt: s.closesAt,
        slotCapacity: s.slotCapacity,
        staff: s.staff.map((u) => u.name),
        itemCount: s._count.menuItems,
      }))}
    />
  );
}
