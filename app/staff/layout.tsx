import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell, type ShellNavItem } from "@/components/shell/app-shell";
import { HeaderAccount } from "@/components/site/header-account";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: { default: "Staff", template: "%s · Staff · PES Canteen" } };

const NAV: ShellNavItem[] = [
  { href: "/staff", label: "Orders", icon: "orders", exact: true },
  { href: "/staff/menu", label: "Menu", icon: "menu" },
  { href: "/staff/slots", label: "Pickup slots", icon: "slots" },
  { href: "/staff/forecast", label: "Demand forecast", icon: "forecast" },
  { href: "/staff/reports", label: "Reports", icon: "reports" },
  { href: "/staff/notifications", label: "Notifications", icon: "notifications" },
];

export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return (
    <AppShell
      nav={NAV}
      subtitle="Staff dashboard"
      account={
        <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
          <HeaderAccount />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
