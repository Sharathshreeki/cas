"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveStall, setStallStatus } from "@/app/actions/admin";
import { minutesToHHMM, minutesToLabel } from "@/lib/time";

export type AdminStall = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  isOpen: boolean;
  opensAt: number;
  closesAt: number;
  slotCapacity: number;
  staff: string[];
  itemCount: number;
};

// FR-19, FR-61
export function StallManager({ stalls }: { stalls: AdminStall[] }) {
  const [editing, setEditing] = useState<AdminStall | "new" | null>(null);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <PlusIcon data-icon="inline-start" /> Add stall
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {stalls.map((stall) => (
          <StallRow key={stall.id} stall={stall} onEdit={() => setEditing(stall)} />
        ))}
      </div>
      <StallDialog key={editing === "new" ? "new" : editing?.id ?? "closed"} stall={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function StallRow({ stall, onEdit }: { stall: AdminStall; onEdit: () => void }) {
  const [open, setOpen] = useOptimistic(stall.isOpen);
  const [, startTransition] = useTransition();
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{stall.name}</h3>
          <p className="text-sm text-muted-foreground">{stall.location ?? "No location set"}</p>
        </div>
        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${stall.name}`} onClick={onEdit}>
          <PencilIcon />
        </Button>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Hours</dt>
          <dd className="font-medium">
            {minutesToLabel(stall.opensAt)} – {minutesToLabel(stall.closesAt)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Slot capacity</dt>
          <dd className="font-medium">{stall.slotCapacity} orders</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Menu</dt>
          <dd className="font-medium">{stall.itemCount} items</dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <p className="truncate text-xs text-muted-foreground">
          Staff: {stall.staff.length ? stall.staff.join(", ") : "none assigned"}
        </p>
        <Label className="flex shrink-0 items-center gap-2 font-normal">
          <Switch
            checked={open}
            aria-label={`${stall.name} accepting orders`}
            onCheckedChange={(checked) =>
              startTransition(async () => {
                setOpen(checked);
                const result = await setStallStatus(stall.id, checked);
                if (result.ok) toast.success(result.message);
                else toast.error(result.error);
              })
            }
          />
          <span className="text-sm">{open ? "Open" : "Closed"}</span>
        </Label>
      </div>
    </div>
  );
}

function StallDialog({ stall, onClose }: { stall: AdminStall | "new" | null; onClose: () => void }) {
  const existing = stall && stall !== "new" ? stall : null;
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(existing?.isOpen ?? true);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={stall !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.name}` : "Add stall"}</DialogTitle>
          <DialogDescription>Hours use 24-hour campus time. Pickup slots are 15 minutes long.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          action={(formData) =>
            startTransition(async () => {
              const result = await saveStall(existing?.id ?? null, { ...Object.fromEntries(formData), isOpen });
              if (result.ok) {
                toast.success(result.message);
                onClose();
              } else {
                setErrors(result.fieldErrors ?? {});
                setFormError(result.fieldErrors ? null : result.error);
              }
            })
          }
        >
          <FormError message={formError} />
          <Field label="Name" name="name" defaultValue={existing?.name} required errors={errors.name} />
          <div className="grid gap-1.5">
            <Label htmlFor="stall-description">Description</Label>
            <Textarea id="stall-description" name="description" defaultValue={existing?.description ?? ""} rows={2} maxLength={500} />
          </div>
          <Field label="Location" name="location" defaultValue={existing?.location ?? ""} errors={errors.location} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Opens"
              name="opensAt"
              type="time"
              defaultValue={minutesToHHMM(existing?.opensAt ?? 480)}
              required
              errors={errors.opensAt}
            />
            <Field
              label="Closes"
              name="closesAt"
              type="time"
              defaultValue={minutesToHHMM(existing?.closesAt ?? 1200)}
              required
              errors={errors.closesAt}
            />
            <Field
              label="Orders per slot"
              name="slotCapacity"
              type="number"
              min={1}
              defaultValue={existing?.slotCapacity ?? 10}
              required
              errors={errors.slotCapacity}
            />
          </div>
          <Label className="flex items-center gap-2 font-normal">
            <Switch checked={isOpen} onCheckedChange={setIsOpen} /> Accepting orders
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
              {existing ? "Save changes" : "Create stall"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
