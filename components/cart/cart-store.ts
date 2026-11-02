"use client";

import { useSyncExternalStore } from "react";
import { MAX_QTY_PER_ITEM } from "@/lib/domain/limits";

// Client-side cart persisted to localStorage. The cart holds items from a
// single stall at a time (FR-26, decisions/0008-single-stall-cart.md); prices
// here are only for display — the server recomputes totals (BR-04).

export type CartLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
};

export type Cart = { stallId: string | null; stallName: string | null; lines: CartLine[] };

export type CartItemInput = Omit<CartLine, "quantity"> & { stallId: string; stallName: string };

const STORAGE_KEY = "cas.cart.v1";
const EMPTY: Cart = { stallId: null, stallName: null, lines: [] };

let cart: Cart = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Cart;
      if (Array.isArray(parsed.lines)) cart = parsed;
    }
  } catch {
    cart = EMPTY;
  }
}

function commit(next: Cart) {
  cart = next.lines.length ? next : EMPTY;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Storage may be unavailable (private mode); the in-memory cart still works.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    loaded = false;
    load();
    listeners.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return cart;
}

export function useCart(): Cart {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export const cartActions = {
  /** Returns "conflict" when the item belongs to a different stall than the cart. */
  add(item: CartItemInput): "added" | "conflict" | "limit" {
    if (cart.stallId && cart.stallId !== item.stallId && cart.lines.length) return "conflict";
    const existing = cart.lines.find((l) => l.menuItemId === item.menuItemId);
    if (existing && existing.quantity >= MAX_QTY_PER_ITEM) return "limit";
    const { stallId, stallName, ...line } = item;
    commit({
      stallId,
      stallName,
      lines: existing
        ? cart.lines.map((l) => (l.menuItemId === item.menuItemId ? { ...l, quantity: l.quantity + 1, price: item.price } : l))
        : [...cart.lines, { ...line, quantity: 1 }],
    });
    return "added";
  },
  replaceWith(item: CartItemInput) {
    const { stallId, stallName, ...line } = item;
    commit({ stallId, stallName, lines: [{ ...line, quantity: 1 }] });
  },
  setQuantity(menuItemId: string, quantity: number) {
    const q = Math.min(MAX_QTY_PER_ITEM, Math.max(0, Math.floor(quantity)));
    commit({
      ...cart,
      lines: q === 0
        ? cart.lines.filter((l) => l.menuItemId !== menuItemId)
        : cart.lines.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: q } : l)),
    });
  },
  remove(menuItemId: string) {
    commit({ ...cart, lines: cart.lines.filter((l) => l.menuItemId !== menuItemId) });
  },
  removeMany(menuItemIds: string[]) {
    commit({ ...cart, lines: cart.lines.filter((l) => !menuItemIds.includes(l.menuItemId)) });
  },
  updatePrices(prices: { menuItemId: string; price: number }[]) {
    commit({
      ...cart,
      lines: cart.lines.map((l) => {
        const updated = prices.find((p) => p.menuItemId === l.menuItemId);
        return updated ? { ...l, price: updated.price } : l;
      }),
    });
  },
  clear() {
    commit(EMPTY);
  },
};

export function cartCount(c: Cart): number {
  return c.lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function cartTotal(c: Cart): number {
  return c.lines.reduce((sum, l) => sum + Math.round(l.price * 100) * l.quantity, 0) / 100;
}
