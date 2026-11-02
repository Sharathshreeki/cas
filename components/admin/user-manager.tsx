"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, SearchIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAccount, updateUserAccess } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  srn: string | null;
  role: "STUDENT" | "STAFF" | "ADMIN";
  status: "ACTIVE" | "INACTIVE";
  stallId: string | null;
};

const ROLE_LABEL = { STUDENT: "Student", STAFF: "Staff", ADMIN: "Admin" } as const;
const NO_STALL = "__none__";

// FR-08, FR-61, FR-62
export function UserManager({
  users,
  stalls,
  currentUserId,
  total,
}: {
  users: AdminUser[];
  stalls: { id: string; name: string }[];
  currentUserId: string;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [creating, setCreating] = useState(false);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="relative w-full sm:max-w-xs"
          onSubmit={(e) => {
            e.preventDefault();
            setParam("q", String(new FormData(e.currentTarget).get("q") ?? ""));
          }}
        >
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" type="search" defaultValue={params.get("q") ?? ""} placeholder="Name, email or SRN…" aria-label="Search users" className="pl-8" />
        </form>
        <Select value={params.get("role") ?? "ALL"} onValueChange={(v) => setParam("role", v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-40" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            <SelectItem value="STUDENT">Students</SelectItem>
            <SelectItem value="STAFF">Staff</SelectItem>
            <SelectItem value="ADMIN">Admins</SelectItem>
          </SelectContent>
        </Select>
        <Button className="sm:ml-auto" onClick={() => setCreating(true)}>
          <UserPlusIcon data-icon="inline-start" /> Add staff or admin
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users match" description="Try a different search or role filter." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Assigned stall</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <UserRow key={u.id} user={u} stalls={stalls} self={u.id === currentUserId} />
              ))}
            </tbody>
          </table>
          {total > users.length ? (
            <p className="border-t px-4 py-2 text-xs text-muted-foreground">
              Showing {users.length} of {total}. Refine the search to see others.
            </p>
          ) : null}
        </div>
      )}

      <CreateAccountDialog open={creating} onClose={() => setCreating(false)} stalls={stalls} />
    </>
  );
}

function UserRow({ user, stalls, self }: { user: AdminUser; stalls: { id: string; name: string }[]; self: boolean }) {
  const [pending, startTransition] = useTransition();

  function update(changes: Parameters<typeof updateUserAccess>[1]) {
    startTransition(async () => {
      const result = await updateUserAccess(user.id, changes);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <tr className={cn(pending && "opacity-60")}>
      <td className="px-4 py-2.5">
        <p className="font-medium">
          {user.name}
          {self ? <span className="ml-1 text-xs text-muted-foreground">(you)</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {user.email}
          {user.srn ? ` · ${user.srn}` : null}
        </p>
      </td>
      <td className="px-4 py-2.5">
        <Select value={user.role} disabled={self || pending} onValueChange={(role) => update({ role: role as AdminUser["role"] })}>
          <SelectTrigger size="sm" className="w-28" aria-label={`Role for ${user.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_LABEL) as AdminUser["role"][]).map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-2.5">
        {user.role === "STAFF" ? (
          <Select
            value={user.stallId ?? NO_STALL}
            disabled={pending}
            onValueChange={(v) => update({ stallId: v === NO_STALL ? null : v })}
          >
            <SelectTrigger size="sm" className="w-44" aria-label={`Stall for ${user.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_STALL}>Not assigned</SelectItem>
              {stalls.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <Button
          size="sm"
          variant={user.status === "ACTIVE" ? "outline" : "secondary"}
          disabled={self || pending}
          onClick={() => update({ status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
          aria-label={`${user.status === "ACTIVE" ? "Deactivate" : "Activate"} ${user.name}`}
        >
          <span className={cn("size-1.5 rounded-full", user.status === "ACTIVE" ? "bg-success" : "bg-muted-foreground")} aria-hidden />
          {user.status === "ACTIVE" ? "Active" : "Inactive"}
        </Button>
      </td>
    </tr>
  );
}

function CreateAccountDialog({
  open,
  onClose,
  stalls,
}: {
  open: boolean;
  onClose: () => void;
  stalls: { id: string; name: string }[];
}) {
  const [role, setRole] = useState<"STAFF" | "ADMIN">("STAFF");
  const [stallId, setStallId] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add staff or admin account</DialogTitle>
          <DialogDescription>Students register themselves. Share the initial password securely; they can change it from their profile.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          action={(formData) =>
            startTransition(async () => {
              const result = await createAccount({ ...Object.fromEntries(formData), role, stallId });
              if (result.ok) {
                toast.success(result.message);
                setErrors({});
                setFormError(null);
                onClose();
              } else {
                setErrors(result.fieldErrors ?? {});
                setFormError(result.error);
              }
            })
          }
        >
          <FormError message={formError} />
          <Field label="Full name" name="name" required errors={errors.name} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" name="email" type="email" required errors={errors.email} />
            <Field label="Mobile" name="phone" type="tel" errors={errors.phone} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "STAFF" | "ADMIN")}>
                <SelectTrigger aria-label="Role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Canteen staff</SelectItem>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === "STAFF" ? (
              <div className="grid gap-1.5">
                <Label>
                  Stall<span className="text-destructive">*</span>
                </Label>
                <Select value={stallId} onValueChange={setStallId}>
                  <SelectTrigger aria-label="Stall" aria-invalid={errors.stallId ? true : undefined} className="w-full">
                    <SelectValue placeholder="Choose a stall" />
                  </SelectTrigger>
                  <SelectContent>
                    {stalls.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.stallId ? <p className="text-xs text-destructive">{errors.stallId[0]}</p> : null}
              </div>
            ) : null}
          </div>
          <Field
            label="Initial password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            errors={errors.password}
            hint="At least 8 characters, with a letter and a number."
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
