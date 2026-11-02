"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangleIcon,
  BanknoteIcon,
  CreditCardIcon,
  Loader2Icon,
  MapPinOffIcon,
  MinusIcon,
  PlusIcon,
  RefreshCwIcon,
  ShoppingBagIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { VegMark } from "@/components/veg-mark";
import { cartActions, cartTotal, useCart } from "@/components/cart/cart-store";
import { placeOrder } from "@/app/actions/orders";
import { formatINR } from "@/lib/domain/money";
import { MAX_QTY_PER_ITEM } from "@/lib/domain/limits";
import { formatSlot, formatTime, relativeDayLabel } from "@/lib/time";
import type { SlotDay } from "@/lib/services/catalog";
import { cn } from "@/lib/utils";

type Viewer = { role: "STUDENT" | "STAFF" | "ADMIN" } | null;
type Policy = { orderingEnabled: boolean; geofenceEnabled: boolean };

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Opens checkout on the first day that still has bookable slots. */
function firstDayWithSlots(days: SlotDay[]): number {
  return Math.max(0, days.findIndex((d) => d.slots.some((s) => s.remaining > 0)));
}

function getLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

export function Checkout({ viewer, policy }: { viewer: Viewer; policy: Policy }) {
  const cart = useCart();
  const router = useRouter();
  const [days, setDays] = useState<SlotDay[] | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [payment, setPayment] = useState<"CASH_ON_PICKUP" | "SIMULATED_ONLINE">("SIMULATED_ONLINE");
  const [note, setNote] = useState("");
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const idempotencyKey = useRef<string>(newKey());

  const loadSlots = useCallback(async (stallId: string) => {
    setSlotsError(false);
    try {
      const res = await fetch(`/api/stalls/${stallId}/slots`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { days: SlotDay[] };
      setDays(data.days);
      setDayIndex((i) => (data.days[i]?.slots.length ? i : firstDayWithSlots(data.days)));
    } catch {
      setSlotsError(true);
    }
  }, []);

  useEffect(() => {
    if (!cart.stallId) return;
    let active = true;
    fetch(`/api/stalls/${cart.stallId}/slots`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { days: SlotDay[] }) => {
        if (!active) return;
        setDays(data.days);
        setDayIndex(firstDayWithSlots(data.days));
      })
      .catch(() => active && setSlotsError(true));
    return () => {
      active = false;
    };
  }, [cart.stallId]);

  if (!cart.lines.length) {
    return (
      <EmptyState
        icon={ShoppingBagIcon}
        title="Your cart is empty"
        description="Add something tasty from one of the campus stalls."
        action={
          <Button asChild>
            <Link href="/stalls">Browse stalls</Link>
          </Button>
        }
      />
    );
  }

  const total = cartTotal(cart);
  const selectedDay = days?.[dayIndex];
  const canOrder = viewer?.role === "STUDENT" && policy.orderingEnabled;

  async function submit() {
    if (!slot) return toast.error("Choose a pickup slot first.");
    setLocationError(null);

    let location: { lat: number; lng: number } | null = null;
    if (policy.geofenceEnabled) {
      try {
        location = await getLocation();
      } catch (error) {
        const denied = (error as GeolocationPositionError)?.code === 1;
        setLocationError(
          denied
            ? "Location access was denied. Ordering is limited to the PES campus, so allow location access for this site and try again."
            : "We couldn't determine your location. Check that location services are on and try again.",
        );
        return;
      }
    }

    startTransition(async () => {
      const result = await placeOrder({
        stallId: cart.stallId,
        items: cart.lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, expectedPrice: l.price })),
        slotStart: slot,
        paymentMethod: payment,
        note: note || undefined,
        idempotencyKey: idempotencyKey.current,
        location,
      });

      if (result.ok && result.data) {
        cartActions.clear();
        idempotencyKey.current = newKey();
        toast.success(`Order ${result.data.code} placed!`);
        router.push(`/orders/${result.data.code}?placed=1`);
        return;
      }
      if (result.ok) return;

      switch (result.code) {
        case "ITEM_UNAVAILABLE":
          setUnavailable((result.details as { menuItemIds: string[] }).menuItemIds);
          break;
        case "PRICE_CHANGED":
          cartActions.updatePrices((result.details as { prices: { menuItemId: string; price: number }[] }).prices);
          break;
        case "SLOT_FULL":
        case "INVALID_SLOT":
          setSlot(null);
          if (cart.stallId) void loadSlots(cart.stallId);
          break;
        case "LOCATION_REQUIRED":
        case "OUTSIDE_CAMPUS":
          setLocationError(result.error);
          return;
        case "UNAUTHORIZED":
          router.push("/login?next=/cart");
          break;
      }
      toast.error(result.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Your order from{" "}
            <Link href={`/stalls/${cart.stallId}`} className="text-primary hover:underline">
              {cart.stallName}
            </Link>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => cartActions.clear()}>
            Clear
          </Button>
        </CardHeader>
        <CardContent>
          {unavailable.length ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangleIcon />
              <AlertTitle>Some items are no longer available</AlertTitle>
              <AlertDescription>
                <p>Remove them to continue with your order.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    cartActions.removeMany(unavailable);
                    setUnavailable([]);
                  }}
                >
                  Remove unavailable items
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <ul className="divide-y">
            <AnimatePresence initial={false}>
              {cart.lines.map((line) => (
                <motion.li
                  key={line.menuItemId}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className={cn("flex items-center gap-3 py-3", unavailable.includes(line.menuItemId) && "opacity-60")}>
                    <VegMark isVeg={line.isVeg} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatINR(line.price)} each
                        {unavailable.includes(line.menuItemId) ? (
                          <span className="ml-2 font-medium text-destructive">Unavailable</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border p-0.5">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Decrease ${line.name}`}
                        onClick={() => cartActions.setQuantity(line.menuItemId, line.quantity - 1)}
                      >
                        <MinusIcon />
                      </Button>
                      <span className="w-5 text-center text-sm tabular-nums" aria-label={`Quantity ${line.quantity}`}>
                        {line.quantity}
                      </span>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Increase ${line.name}`}
                        disabled={line.quantity >= MAX_QTY_PER_ITEM}
                        onClick={() => cartActions.setQuantity(line.menuItemId, line.quantity + 1)}
                      >
                        <PlusIcon />
                      </Button>
                    </div>
                    <span className="w-16 text-right text-sm font-medium tabular-nums">
                      {formatINR(line.price * line.quantity)}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${line.name}`}
                      onClick={() => cartActions.remove(line.menuItemId)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <Separator className="my-2" />
          <div className="flex items-center justify-between pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatINR(total)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            The final amount is confirmed by the stall&apos;s current prices when you place the order.
          </p>
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>Pickup &amp; payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Pickup slot <span className="text-destructive">*</span>
            </legend>
            {slotsError ? (
              <div className="flex items-center justify-between rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Couldn&apos;t load pickup slots.
                <Button size="sm" variant="outline" onClick={() => cart.stallId && loadSlots(cart.stallId)}>
                  <RefreshCwIcon data-icon="inline-start" /> Retry
                </Button>
              </div>
            ) : !days ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }, (_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : (
              <>
                <div className="mb-3 flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Pickup day">
                  {days.map((d, i) => (
                    <button
                      key={d.date}
                      type="button"
                      role="tab"
                      aria-selected={dayIndex === i}
                      onClick={() => {
                        setDayIndex(i);
                        setSlot(null);
                      }}
                      className={cn(
                        "relative flex-1 rounded-md px-2 py-1 text-sm font-medium transition-colors",
                        dayIndex === i ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {dayIndex === i ? (
                        <motion.span layoutId="slot-day" className="absolute inset-0 -z-0 rounded-md bg-background shadow-sm" />
                      ) : null}
                      <span className="relative">{relativeDayLabel(d.date)}</span>
                    </button>
                  ))}
                </div>
                {selectedDay && selectedDay.slots.length ? (
                  <RadioGroup
                    value={slot ?? ""}
                    onValueChange={setSlot}
                    aria-label="Pickup slot"
                    className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1"
                  >
                    {selectedDay.slots.map((s) => {
                      const full = s.remaining === 0;
                      const id = `slot-${s.startsAt}`;
                      return (
                        <Label
                          key={s.startsAt}
                          htmlFor={id}
                          className={cn(
                            "flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-center font-normal transition-colors",
                            slot === s.startsAt ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted",
                            full && "cursor-not-allowed opacity-50 hover:bg-transparent",
                          )}
                        >
                          <RadioGroupItem id={id} value={s.startsAt} disabled={full} className="sr-only" />
                          <span className="text-sm font-medium tabular-nums">{formatTime(s.startsAt)}</span>
                          <span className={cn("text-[11px]", full ? "text-destructive" : "text-muted-foreground")}>
                            {full ? "Full" : `${s.remaining} left`}
                          </span>
                        </Label>
                      );
                    })}
                  </RadioGroup>
                ) : (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    No pickup slots left for this day. Try another day.
                  </p>
                )}
              </>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Payment method</legend>
            <RadioGroup
              value={payment}
              onValueChange={(v) => setPayment(v as typeof payment)}
              className="grid gap-2"
              aria-label="Payment method"
            >
              {[
                { value: "SIMULATED_ONLINE", icon: CreditCardIcon, title: "Pay online", text: "Simulated payment for this prototype" },
                { value: "CASH_ON_PICKUP", icon: BanknoteIcon, title: "Cash at pickup", text: "Pay at the counter when you collect" },
              ].map((m) => (
                <Label
                  key={m.value}
                  htmlFor={`pay-${m.value}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal transition-colors",
                    payment === m.value ? "border-primary bg-primary/5" : "hover:bg-muted",
                  )}
                >
                  <RadioGroupItem id={`pay-${m.value}`} value={m.value} />
                  <m.icon className="size-4 text-muted-foreground" aria-hidden />
                  <span>
                    <span className="block text-sm font-medium">{m.title}</span>
                    <span className="block text-xs text-muted-foreground">{m.text}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>

          <div>
            <Label htmlFor="note" className="mb-2">
              Note for the stall <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="note"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. less spicy, no onions"
              rows={2}
            />
          </div>

          <AnimatePresence>
            {locationError ? (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Alert variant="destructive">
                  <MapPinOffIcon />
                  <AlertTitle>Ordering is limited to campus</AlertTitle>
                  <AlertDescription>{locationError}</AlertDescription>
                </Alert>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Amount payable</span>
            <span className="text-lg font-semibold tabular-nums">{formatINR(total)}</span>
          </div>
          {slot ? (
            <p className="text-xs text-muted-foreground">
              Pickup {selectedDay ? relativeDayLabel(selectedDay.date).toLowerCase() : ""},{" "}
              {formatSlot(slot, new Date(new Date(slot).getTime() + 15 * 60_000))}
            </p>
          ) : null}
          {!policy.orderingEnabled ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Online ordering is paused by the canteen administrator. Please try again later.
            </p>
          ) : viewer === null ? (
            <Button asChild size="lg">
              <Link href="/login?next=/cart">Sign in to place order</Link>
            </Button>
          ) : viewer.role !== "STUDENT" ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Only student accounts can place orders.
            </p>
          ) : null}
          {canOrder ? (
            <Button size="lg" onClick={submit} disabled={pending || !slot || unavailable.length > 0}>
              {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
              {pending ? "Placing order…" : `Place order · ${formatINR(total)}`}
            </Button>
          ) : null}
          {policy.geofenceEnabled && canOrder ? (
            <p className="text-center text-xs text-muted-foreground">
              Your location is checked once to confirm you&apos;re on campus. It is not stored.
            </p>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}
