"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightIcon, SearchIcon, SearchXIcon, TimerIcon } from "lucide-react";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { cartCount, cartTotal, useCart } from "@/components/cart/cart-store";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { VegMark } from "@/components/veg-mark";
import { formatINR } from "@/lib/domain/money";
import type { MenuItemDTO } from "@/lib/services/catalog";
import { cn } from "@/lib/utils";

type Props = { stall: { id: string; name: string; isOpen: boolean }; items: MenuItemDTO[] };

// FR-12…FR-14, FR-20: searchable, filterable menu with add-to-cart.
export function MenuBrowser({ stall, items }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [vegOnly, setVegOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const cart = useCart();

  const categories = useMemo(() => [...new Set(items.map((i) => i.category))], [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!q || i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)) &&
        (!category || i.category === category) &&
        (!vegOnly || i.isVeg) &&
        (!availableOnly || i.isAvailable),
    );
  }, [items, query, category, vegOnly, availableOnly]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItemDTO[]>();
    for (const item of filtered) map.set(item.category, [...(map.get(item.category) ?? []), item]);
    return [...map.entries()];
  }, [filtered]);

  const inThisStall = cart.stallId === stall.id ? cartCount(cart) : 0;

  return (
    <div className="pb-24">
      <div className="sticky top-[98px] z-30 -mx-4 space-y-3 bg-background/90 px-4 pt-1 pb-3 backdrop-blur-md md:top-[57px]">
        <div className="relative max-w-md">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${stall.name}…`}
            aria-label="Search menu items"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]" role="group" aria-label="Category">
            {[null, ...categories].map((c) => (
              <button
                key={c ?? "all"}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={cn(
                  "relative shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  category === c ? "border-transparent text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {category === c ? (
                  <motion.span layoutId="menu-category" className="absolute inset-0 -z-10 rounded-full bg-primary" />
                ) : null}
                {c ?? "All"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={vegOnly} onCheckedChange={setVegOnly} size="sm" /> Veg only
            </Label>
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={availableOnly} onCheckedChange={setAvailableOnly} size="sm" /> Available
            </Label>
          </div>
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={SearchXIcon}
          title="No items match"
          description="Try a different search or clear the filters."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setCategory(null);
                setVegOnly(false);
                setAvailableOnly(false);
              }}
            >
              Clear filters
            </Button>
          }
          className="mt-4"
        />
      ) : (
        <div className="mt-2 space-y-8">
          {grouped.map(([group, groupItems]) => (
            <section key={group} aria-labelledby={`cat-${group}`}>
              <h2 id={`cat-${group}`} className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {group}
              </h2>
              <motion.ul layout className="grid gap-3 md:grid-cols-2">
                <AnimatePresence initial={false}>
                  {groupItems.map((item) => (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "flex gap-4 rounded-xl border bg-card p-4",
                        !item.isAvailable && "bg-muted/40",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <VegMark isVeg={item.isVeg} />
                          <h3 className={cn("font-medium leading-snug", !item.isAvailable && "text-muted-foreground")}>
                            {item.name}
                          </h3>
                        </div>
                        {item.description ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                        ) : null}
                        <div className="mt-2 flex items-center gap-3 text-sm">
                          <span className="font-semibold tabular-nums">{formatINR(item.price)}</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <TimerIcon className="size-3.5" aria-hidden /> {item.prepTimeMinutes} min
                          </span>
                          {!item.isAvailable ? (
                            <span className="text-xs font-medium text-muted-foreground">· Sold out</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-end">
                        <AddToCartButton
                          available={item.isAvailable && stall.isOpen}
                          item={{
                            menuItemId: item.id,
                            name: item.name,
                            price: item.price,
                            isVeg: item.isVeg,
                            stallId: stall.id,
                            stallName: stall.name,
                          }}
                        />
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            </section>
          ))}
        </div>
      )}

      <AnimatePresence>
        {inThisStall > 0 ? (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            className="fixed inset-x-0 bottom-4 z-40 mx-auto w-[min(32rem,calc(100%-2rem))]"
          >
            <Button asChild size="lg" className="h-12 w-full justify-between rounded-xl px-4 shadow-xl shadow-primary/20">
              <Link href="/cart">
                <span>
                  {inThisStall} {inThisStall === 1 ? "item" : "items"} · {formatINR(cartTotal(cart))}
                </span>
                <span className="flex items-center gap-1">
                  View cart <ArrowRightIcon />
                </span>
              </Link>
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
