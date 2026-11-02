import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { MenuManager } from "@/components/staff/menu-manager";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/dal";
import { getStallWithMenu } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Menu" };

export default function StaffMenuPage() {
  return (
    <>
      <PageHeader title="Menu" description="Add items, update prices and mark items available or sold out." />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Menu />
      </Suspense>
    </>
  );
}

async function Menu() {
  const user = await requireStaff();
  const stall = await getStallWithMenu(user.stallId);
  return <MenuManager items={stall?.menu ?? []} />;
}
