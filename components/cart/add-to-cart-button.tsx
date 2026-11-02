"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cartActions, useCart, type CartItemInput } from "@/components/cart/cart-store";
import { trackRecommendation } from "@/app/actions/insights";

type Props = {
  item: CartItemInput;
  available: boolean;
  /** Set when the button is shown inside a recommendation card (FR-82). */
  recommendationStrategy?: string;
  size?: "sm" | "default";
};

export function AddToCartButton({ item, available, recommendationStrategy, size = "sm" }: Props) {
  const cart = useCart();
  const [confirming, setConfirming] = useState(false);
  const line = cart.stallId === item.stallId ? cart.lines.find((l) => l.menuItemId === item.menuItemId) : undefined;

  function add() {
    const result = cartActions.add(item);
    if (result === "conflict") return setConfirming(true);
    if (result === "limit") return toast.error("You've reached the limit for this item.");
    if (recommendationStrategy) void trackRecommendation(item.menuItemId, "ADD_TO_CART", recommendationStrategy);
    if (!line) toast.success(`${item.name} added to cart`);
  }

  if (!available) {
    return (
      <Button size={size} variant="outline" disabled aria-label={`${item.name} is unavailable`}>
        Unavailable
      </Button>
    );
  }

  return (
    <>
      <AnimatePresence mode="popLayout" initial={false}>
        {line ? (
          <motion.div
            key="stepper"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="flex items-center gap-1 rounded-lg border bg-background p-0.5"
          >
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove one ${item.name}`}
              onClick={() => cartActions.setQuantity(item.menuItemId, line.quantity - 1)}
            >
              <MinusIcon />
            </Button>
            <motion.span
              key={line.quantity}
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-5 text-center text-sm font-medium tabular-nums"
              aria-live="polite"
            >
              {line.quantity}
            </motion.span>
            <Button size="icon-sm" variant="ghost" aria-label={`Add one more ${item.name}`} onClick={add}>
              <PlusIcon />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="add"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <Button size={size} onClick={add} aria-label={`Add ${item.name} to cart`}>
              <PlusIcon data-icon="inline-start" />
              Add
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart has items from {cart.stallName}. An order can only contain items from one stall, so adding{" "}
              {item.name} will clear your current cart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current cart</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                cartActions.replaceWith(item);
                toast.success(`New cart started with ${item.name}`);
              }}
            >
              Start new cart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
