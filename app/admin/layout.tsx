import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell, type ShellNavItem } from "@/components/shell/app-shell";
import { HeaderAccount } from "@/components/site/header-account";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · PES Canteen" } };

const NAV: ShellNavItem[] = [
  { href: "/admin", label: "Overview", icon: "overview", exact: true },
  { href: "/admin/stalls", label: "Stalls", icon: "stalls" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/reports", label: "Reports", icon: "reports" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
  { href: "/admin/audit", label: "Audit log", icon: "audit" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell
      nav={NAV}
      subtitle="Administration"
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
