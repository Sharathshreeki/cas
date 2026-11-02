"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { updateSlotCapacity } from "@/app/actions/staff";

export function SlotCapacityForm({ capacity }: { capacity: number }) {
  const [errors, setErrors] = useState<string[] | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="flex flex-wrap items-end gap-3"
      action={(formData) =>
        startTransition(async () => {
          const result = await updateSlotCapacity(Object.fromEntries(formData));
          if (result.ok) {
            setErrors(undefined);
            toast.success(result.message);
          } else {
            setErrors(result.fieldErrors?.slotCapacity ?? [result.error]);
          }
        })
      }
    >
      <Field
        label="Orders per 15-minute slot"
        name="slotCapacity"
        type="number"
        inputMode="numeric"
        min={1}
        max={200}
        defaultValue={capacity}
        required
        errors={errors}
        className="w-56"
      />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
        Save capacity
      </Button>
    </form>
  );
}
