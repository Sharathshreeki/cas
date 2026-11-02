import { connection } from "next/server";
import { StoreIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Stagger, StaggerItem } from "@/components/motion";
import { StallCard } from "@/components/site/stall-card";
import { Skeleton } from "@/components/ui/skeleton";
import { listStalls } from "@/lib/services/catalog";

export async function StallGrid() {
  await connection();
  const stalls = await listStalls();
  if (!stalls.length) {
    return <EmptyState icon={StoreIcon} title="No stalls yet" description="Stalls will appear here once the canteen sets them up." />;
  }
  return (
    <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stalls.map((stall) => (
        <StaggerItem key={stall.id}>
          <StallCard stall={stall} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

export function StallGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-48 rounded-xl" />
      ))}
    </div>
  );
}
