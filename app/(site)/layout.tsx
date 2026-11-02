import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { HeaderAccount } from "@/components/site/header-account";
import { Skeleton } from "@/components/ui/skeleton";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader
        account={
          <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
            <HeaderAccount />
          </Suspense>
        }
      />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>PES University Canteen Automation System · Capstone project</p>
          <nav aria-label="Footer" className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy notice
            </Link>
            <Link href="/stalls" className="hover:text-foreground">
              Stalls
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
