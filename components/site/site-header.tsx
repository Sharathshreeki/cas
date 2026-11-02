"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingBagIcon } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cartCount, useCart } from "@/components/cart/cart-store";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/stalls", label: "Stalls" },
  { href: "/orders", label: "My orders" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// usePathname() is request data, so the active-state nav sits behind its own
// Suspense boundary and the rest of the header stays in the static shell.
function ActiveNav({ variant }: { variant: "desktop" | "mobile" }) {
  return <NavLinks pathname={usePathname()} variant={variant} />;
}

function NavLinks({ pathname, variant }: { pathname: string | null; variant: "desktop" | "mobile" }) {
  if (variant === "desktop") {
    return (
      <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
        {NAV.map((item) => {
          const active = pathname !== null && isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative rounded-md px-3 py-1.5 text-sm transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="site-nav-pill"
                  className="absolute inset-0 -z-10 rounded-md bg-muted"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              ) : null}
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav aria-label="Main" className="flex border-t md:hidden">
      {NAV.map((item) => {
        const active = pathname !== null && isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("relative flex-1 py-2.5 text-center text-sm", active ? "font-medium text-foreground" : "text-muted-foreground")}
          >
            {item.label}
            {active ? (
              <motion.span layoutId="site-nav-underline" className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-primary" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteHeader({ account }: { account: React.ReactNode }) {
  const count = cartCount(useCart());

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Brand />
        <Suspense fallback={<NavLinks pathname={null} variant="desktop" />}>
          <ActiveNav variant="desktop" />
        </Suspense>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Button asChild variant="ghost" size="icon" className="relative" aria-label={`Cart, ${count} items`}>
            <Link href="/cart">
              <ShoppingBagIcon />
              <AnimatePresence>
                {count > 0 ? (
                  <motion.span
                    key={count}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 20 }}
                    className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums"
                  >
                    {count}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </Link>
          </Button>
          {account}
        </div>
      </div>

      {/* Compact navigation for small screens (NFR-31). */}
      <Suspense fallback={<NavLinks pathname={null} variant="mobile" />}>
        <ActiveNav variant="mobile" />
      </Suspense>
    </header>
  );
}
