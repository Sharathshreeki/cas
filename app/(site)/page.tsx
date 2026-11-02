import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, ClockIcon, ShoppingBagIcon, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";
import { Recommendations, RecommendationsSkeleton } from "@/components/site/recommendations";
import { StallGrid, StallGridSkeleton } from "@/components/site/stall-grid";

const STEPS = [
  { icon: StoreIcon, title: "Pick a stall", text: "Browse live menus and availability." },
  { icon: ClockIcon, title: "Choose a slot", text: "Reserve a 15-minute pickup window." },
  { icon: ShoppingBagIcon, title: "Skip the queue", text: "Collect when your order is ready." },
];

export default function HomePage() {
  return (
    <div className="space-y-12 sm:space-y-16">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background px-6 py-10 sm:px-10 sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/15 blur-3xl"
        />
        <FadeIn className="relative max-w-xl">
          <p className="text-sm font-medium text-primary">PES University canteens</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Order ahead. Pick up on time. Skip the queue.
          </h1>
          <p className="mt-3 text-muted-foreground text-pretty">
            Browse every campus stall, book a pickup slot between classes, and track your order until it&apos;s ready.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link href="/stalls">
                Browse stalls <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/orders">Track an order</Link>
            </Button>
          </div>
        </FadeIn>
        <FadeIn delay={0.15} className="relative mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground">{i + 1}.</span> {title}
                </p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </FadeIn>
      </section>

      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations />
      </Suspense>

      <section aria-labelledby="stalls-heading">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 id="stalls-heading" className="text-lg font-semibold tracking-tight">
              Campus stalls
            </h2>
            <p className="text-sm text-muted-foreground">Live status and menus from every canteen.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/stalls">
              View all <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </div>
        <Suspense fallback={<StallGridSkeleton />}>
          <StallGrid />
        </Suspense>
      </section>
    </div>
  );
}
