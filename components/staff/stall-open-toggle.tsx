"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setStallOpen } from "@/app/actions/staff";

export function StallOpenToggle({ isOpen }: { isOpen: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(isOpen);
  const [, startTransition] = useTransition();

  return (
    <Label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 font-normal">
      <Switch
        checked={optimistic}
        onCheckedChange={(checked) =>
          startTransition(async () => {
            setOptimistic(checked);
            const result = await setStallOpen(checked);
            if (result.ok) toast.success(result.message);
            else toast.error(result.error);
          })
        }
      />
      <span className="text-sm">{optimistic ? "Accepting orders" : "Paused"}</span>
    </Label>
  );
}
