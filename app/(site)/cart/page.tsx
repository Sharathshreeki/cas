import type { Metadata } from "next";
import { Suspense } from "react";
import { Checkout } from "@/components/cart/checkout";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth/dal";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <>
      <PageHeader title="Cart & checkout" description="Review your items, pick a pickup slot and place your order." />
      <Suspense
        fallback={
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        }
      >
        <CartContent />
      </Suspense>
    </>
  );
}

async function CartContent() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  return (
    <Checkout
      viewer={user ? { role: user.role } : null}
      policy={{ orderingEnabled: settings.orderingEnabled, geofenceEnabled: settings.geofence.enabled }}
    />
  );
}
