import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarClockIcon } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SlotCapacityForm } from "@/components/staff/slot-capacity-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { addDays, campusDateKey, campusDayRange, formatSlot, minutesToLabel, relativeDayLabel } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pickup slots" };

export default function StaffSlotsPage() {
  return (
    <>
      <PageHeader title="Pickup slots" description="Set how many orders each 15-minute slot can take and plan upcoming pickups." />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Slots />
      </Suspense>
    </>
  );
}

// FR-41, FR-43, FR-57
async function Slots() {
  const user = await requireStaff();
  const settings = await getSettings();
  const stall = await db.stall.findUniqueOrThrow({ where: { id: user.stallId } });
  const today = campusDateKey();
  const until = campusDayRange(addDays(today, settings.bookingDays - 1)).end;

  const slots = await db.pickupSlot.findMany({
    where: { stallId: stall.id, endsAt: { gt: new Date() }, startsAt: { lt: until } },
    orderBy: { startsAt: "asc" },
    include: {
      orders: {
        where: { status: { notIn: ["CANCELLED", "REJECTED"] } },
        select: { items: { select: { quantity: true } } },
      },
    },
  });
  const byDay = new Map<string, typeof slots>();
  for (const s of slots) {
    const key = campusDateKey(s.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={20_000} />
      <Card>
        <CardHeader>
          <CardTitle>Slot capacity</CardTitle>
          <CardDescription>
            Capacity is the maximum number of orders per slot. Students can book up to {settings.bookingDays} day(s) ahead,
            at least {settings.minLeadMinutes} minutes in advance, between {minutesToLabel(stall.opensAt)} and{" "}
            {minutesToLabel(stall.closesAt)}. Lowering capacity never cancels existing bookings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SlotCapacityForm capacity={stall.slotCapacity} />
        </CardContent>
      </Card>

      {slots.length === 0 ? (
        <EmptyState icon={CalendarClockIcon} title="No upcoming bookings" description="Booked slots will appear here." />
      ) : (
        [...byDay.entries()].map(([day, daySlots]) => (
          <section key={day}>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {relativeDayLabel(day)} · upcoming bookings
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {daySlots.map((slot) => {
                const items = slot.orders.reduce((sum, o) => sum + o.items.reduce((a, i) => a + i.quantity, 0), 0);
                const ratio = slot.capacity ? slot.bookedCount / slot.capacity : 1;
                return (
                  <div key={slot.id} className="rounded-xl border bg-card p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium tabular-nums">{formatSlot(slot.startsAt, slot.endsAt)}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {slot.bookedCount}/{slot.capacity} orders
                      </span>
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={slot.capacity}
                      aria-valuenow={slot.bookedCount}
                      aria-label="Slot usage"
                    >
                      <div
                        className={cn("h-full rounded-full", ratio >= 1 ? "bg-destructive" : ratio >= 0.75 ? "bg-warning" : "bg-primary")}
                        style={{ width: `${Math.min(100, ratio * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {items} items to prepare{ratio >= 1 ? " · full" : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
