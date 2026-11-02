import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ClockIcon, MapPinIcon } from "lucide-react";
import { FadeIn } from "@/components/motion";
import { MenuBrowser } from "@/components/site/menu-browser";
import { StallStatus } from "@/components/site/stall-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getStallWithMenu, isServingNow } from "@/lib/services/catalog";
import { minutesToLabel } from "@/lib/time";

export default function StallPage({ params }: PageProps<"/stalls/[stallId]">) {
  return (
    <Suspense fallback={<StallSkeleton />}>
      <StallMenu params={params} />
    </Suspense>
  );
}

async function StallMenu({ params }: Pick<PageProps<"/stalls/[stallId]">, "params">) {
  await connection();
  const { stallId } = await params;
  const stall = await getStallWithMenu(stallId);
  if (!stall) notFound();

  return (
    <>
      <FadeIn className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{stall.name}</h1>
          <StallStatus stall={stall} />
        </div>
        {stall.description ? <p className="mt-1 text-sm text-muted-foreground">{stall.description}</p> : null}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {stall.location ? (
            <span className="flex items-center gap-1.5">
              <MapPinIcon className="size-3.5" aria-hidden /> {stall.location}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <ClockIcon className="size-3.5" aria-hidden /> {minutesToLabel(stall.opensAt)} – {minutesToLabel(stall.closesAt)}
          </span>
        </div>
        {!stall.isOpen ? (
          <p className="mt-4 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            This stall is not accepting orders right now. You can still browse the menu.
          </p>
        ) : !isServingNow(stall) ? (
          <p className="mt-4 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            The counter is closed at the moment — you can pre-order for a later pickup slot.
          </p>
        ) : null}
      </FadeIn>
      <MenuBrowser stall={{ id: stall.id, name: stall.name, isOpen: stall.isOpen }} items={stall.menu} />
    </>
  );
}

function StallSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-9 w-full max-w-md" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
