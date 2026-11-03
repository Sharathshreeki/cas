import Link from "next/link";
import { connection } from "next/server";
import { SparklesIcon } from "lucide-react";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { Stagger, StaggerItem } from "@/components/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { VegMark } from "@/components/veg-mark";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatINR } from "@/lib/domain/money";
import { getRecommendations } from "@/lib/services/insights";

const HEADLINE = {
  MODEL_PERSONAL: "Recommended for you",
  MODEL_GLOBAL: "Popular on campus",
  PERSONAL_HISTORY: "Picked for you",
  POPULARITY: "Popular on campus",
  NEW_ITEMS: "Available right now",
} as const;

// UC-04. ML recommendations from ml/ when available, otherwise heuristics.
export async function Recommendations() {
  await connection();
  const user = await getCurrentUser();
  const { strategy, items } = await getRecommendations(user?.role === "STUDENT" ? user.id : null, 8);
  if (!items.length) return null;

  return (
    <section aria-labelledby="recs-heading">
      <div className="mb-4 flex items-end justify-between gap-2">
        <div>
          <h2 id="recs-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <SparklesIcon className="size-4 text-primary" aria-hidden /> {HEADLINE[strategy]}
          </h2>
          <p className="text-sm text-muted-foreground">
            {strategy === "MODEL_PERSONAL"
              ? "Ranked by our recommendation model from your past orders and campus trends."
              : strategy === "PERSONAL_HISTORY"
                ? "Based on your past orders, plus what's popular."
                : "Based on recent orders across campus."}
          </p>
        </div>
      </div>
      <Stagger className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {items.map((item) => (
          <StaggerItem key={item.id} className="w-60 shrink-0 snap-start sm:w-auto">
            <article className="flex h-full flex-col rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <VegMark isVeg={item.isVeg} />
                <Link href={`/stalls/${item.stallId}`} className="truncate hover:text-foreground hover:underline">
                  {item.stallName}
                </Link>
              </div>
              <h3 className="mt-2 font-medium leading-snug">{item.name}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="font-semibold tabular-nums">{formatINR(item.price)}</span>
                <AddToCartButton
                  available={item.isAvailable}
                  recommendationStrategy={strategy}
                  item={{
                    menuItemId: item.id,
                    name: item.name,
                    price: item.price,
                    isVeg: item.isVeg,
                    stallId: item.stallId,
                    stallName: item.stallName,
                  }}
                />
              </div>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

export function RecommendationsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
