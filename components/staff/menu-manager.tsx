"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArchiveIcon, Loader2Icon, PencilIcon, PlusIcon, SearchIcon, UtensilsIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Field, FormError } from "@/components/forms/field";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { VegMark } from "@/components/veg-mark";
import { archiveMenuItem, saveMenuItem, setItemAvailability } from "@/app/actions/staff";
import { formatINR } from "@/lib/domain/money";
import type { MenuItemDTO } from "@/lib/services/catalog";
import { cn } from "@/lib/utils";

// FR-15…FR-17, FR-56: add, edit, toggle availability and remove menu items.
export function MenuManager({ items }: { items: MenuItemDTO[] }) {
  const [editing, setEditing] = useState<MenuItemDTO | "new" | null>(null);
  const [query, setQuery] = useState("");
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const filtered = items.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()));
  const unavailable = items.filter((i) => !i.isAvailable).length;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            aria-label="Search menu items"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {items.length} items · {unavailable} unavailable
          </p>
          <Button onClick={() => setEditing("new")}>
            <PlusIcon data-icon="inline-start" /> Add item
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UtensilsIcon}
          title={items.length ? "No items match" : "Your menu is empty"}
          description={items.length ? "Try a different search." : "Add your first item to start taking orders."}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <ul className="divide-y">
            <AnimatePresence initial={false}>
              {filtered.map((item) => (
                <MenuRow key={item.id} item={item} onEdit={() => setEditing(item)} />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      <MenuItemDialog
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        item={editing}
        categories={categories}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function MenuRow({ item, onEdit }: { item: MenuItemDTO; onEdit: () => void }) {
  const [available, setAvailable] = useOptimistic(item.isAvailable);
  const [pending, startTransition] = useTransition();

  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <VegMark isVeg={item.isVeg} />
          <p className={cn("truncate font-medium", !available && "text-muted-foreground")}>{item.name}</p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.category} · {item.prepTimeMinutes} min prep
        </p>
      </div>
      <span className="w-20 text-right font-medium tabular-nums">{formatINR(item.price)}</span>
      <Label className="flex w-36 items-center gap-2 font-normal">
        <Switch
          checked={available}
          disabled={pending}
          aria-label={`${item.name} available`}
          onCheckedChange={(checked) =>
            startTransition(async () => {
              setAvailable(checked);
              const result = await setItemAvailability(item.id, checked);
              if (!result.ok) toast.error(result.error);
            })
          }
        />
        <span className={cn("text-sm", available ? "text-success" : "text-muted-foreground")}>
          {available ? "Available" : "Unavailable"}
        </span>
      </Label>
      <div className="flex gap-1">
        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${item.name}`} onClick={onEdit}>
          <PencilIcon />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`Remove ${item.name}`}>
              <ArchiveIcon />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {item.name} from the menu?</AlertDialogTitle>
              <AlertDialogDescription>
                It will no longer be shown to students. Past orders keep their record of this item.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  startTransition(async () => {
                    const result = await archiveMenuItem(item.id);
                    if (result.ok) toast.success(result.message);
                    else toast.error(result.error);
                  })
                }
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </motion.li>
  );
}

function MenuItemDialog({
  item,
  categories,
  onClose,
}: {
  item: MenuItemDTO | "new" | null;
  categories: string[];
  onClose: () => void;
}) {
  const existing = item && item !== "new" ? item : null;
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isVeg, setIsVeg] = useState(existing?.isVeg ?? true);
  const [isAvailable, setIsAvailable] = useState(existing?.isAvailable ?? true);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveMenuItem(existing?.id ?? null, { ...Object.fromEntries(formData), isVeg, isAvailable });
      if (result.ok) {
        toast.success(result.message);
        onClose();
      } else {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.fieldErrors ? null : result.error);
      }
    });
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.name}` : "Add menu item"}</DialogTitle>
          <DialogDescription>Changes apply to new orders. Past orders keep the price they were placed at.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4" noValidate>
          <FormError message={formError} />
          <Field label="Name" name="name" defaultValue={existing?.name} required errors={errors.name} />
          <div className="grid gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={existing?.description ?? ""} maxLength={300} rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Category"
              name="category"
              defaultValue={existing?.category ?? ""}
              list="menu-categories"
              required
              errors={errors.category}
            />
            <datalist id="menu-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <Field
              label="Price (₹)"
              name="price"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              defaultValue={existing?.price}
              required
              errors={errors.price}
            />
            <Field
              label="Prep time (min)"
              name="prepTimeMinutes"
              type="number"
              inputMode="numeric"
              min="1"
              defaultValue={existing?.prepTimeMinutes ?? 10}
              required
              errors={errors.prepTimeMinutes}
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={isVeg} onCheckedChange={setIsVeg} /> Vegetarian
            </Label>
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={isAvailable} onCheckedChange={setIsAvailable} /> Available now
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
              {existing ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
