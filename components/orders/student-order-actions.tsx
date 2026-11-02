"use client";

import { useState, useTransition } from "react";
import { CreditCardIcon, Loader2Icon, ShieldAlertIcon, XIcon } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelMyOrder, payOrderOnline } from "@/app/actions/orders";
import { formatINR } from "@/lib/domain/money";

export function CancelOrderButton({ orderId, code }: { orderId: string; code: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={pending}>
          <XIcon data-icon="inline-start" /> Cancel order
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel order #{code}?</AlertDialogTitle>
          <AlertDialogDescription>
            You can cancel until the stall accepts your order. Your pickup slot will be released and any online payment
            refunded.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep order</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() =>
              startTransition(async () => {
                const result = await cancelMyOrder(orderId);
                if (result.ok) toast.success(result.message);
                else toast.error(result.error);
              })
            }
          >
            Cancel order
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Demo payment dialog. No real gateway is integrated (decisions/0004-payments.md);
 * the outcome buttons let evaluators exercise success and failure paths (FR-51).
 */
export function SimulatedPayButton({ orderId, amount, retry }: { orderId: string; amount: number; retry?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function pay(outcome: "SUCCESS" | "FAILURE") {
    startTransition(async () => {
      const result = await payOrderOnline(orderId, outcome);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.error);
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CreditCardIcon data-icon="inline-start" /> {retry ? "Retry payment" : "Pay now"} · {formatINR(amount)}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Simulated payment</DialogTitle>
          <DialogDescription>
            This prototype does not connect to a real payment gateway. Choose an outcome to record for this order.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/40 p-4 text-center">
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="text-2xl font-semibold tabular-nums">{formatINR(amount)}</p>
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          No money is charged. The result is recorded on the server only for your own order.
        </p>
        <DialogFooter className="gap-2 sm:flex-col">
          <Button onClick={() => pay("SUCCESS")} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
            Pay {formatINR(amount)}
          </Button>
          <Button variant="outline" onClick={() => pay("FAILURE")} disabled={pending}>
            Simulate a failed payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
