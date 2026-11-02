"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  BellIcon,
  CalendarClockIcon,
  ChartColumnIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  SettingsIcon,
  StoreIcon,
  TrendingUpIcon,
  UsersIcon,
  UtensilsIcon,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

// One shell for staff and admin so navigation stays consistent (NFR-23).

const ICONS = {
  orders: ClipboardListIcon,
  menu: UtensilsIcon,
  slots: CalendarClockIcon,
  forecast: TrendingUpIcon,
  reports: ChartColumnIcon,
  notifications: BellIcon,
  overview: LayoutDashboardIcon,
  stalls: StoreIcon,
  users: UsersIcon,
  settings: SettingsIcon,
  audit: ScrollTextIcon,
} as const;

export type ShellNavItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean };

export function AppShell({
  nav,
  subtitle,
  account,
  children,
}: {
  nav: ShellNavItem[];
  subtitle: string;
  account: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = (item: ShellNavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <div className="sticky top-0 flex h-dvh flex-col">
          <div className="px-4 py-4">
            <Brand href={nav[0].href} subtitle={subtitle} />
          </div>
          <nav aria-label="Dashboard" className="flex-1 space-y-0.5 px-2">
            {nav.map((item) => {
              const Icon = ICONS[item.icon];
              const isActive = active(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive ? "font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="shell-nav"
                      className="absolute inset-0 -z-10 rounded-lg border bg-background shadow-sm"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  ) : null}
                  <Icon className={cn("size-4", isActive && "text-primary")} aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center justify-between border-t px-3 py-3">
            {account}
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Brand href={nav[0].href} subtitle={subtitle} />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {account}
          </div>
        </div>
        <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none]">
          {nav.map((item) => {
            const Icon = ICONS[item.icon];
            const isActive = active(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm",
                  isActive ? "font-medium text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {isActive ? <motion.span layoutId="shell-nav-mobile" className="absolute inset-0 -z-10 rounded-full bg-primary" /> : null}
                <Icon className="size-3.5" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
