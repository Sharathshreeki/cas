"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/forms/field";
import { changePassword, updateProfile } from "@/app/actions/profile";

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  useEffect(() => {
    if (state?.ok) toast.success(state.message);
  }, [state]);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={state && !state.ok && !errors ? state.error : null} />
      <Field label="Full name" name="name" defaultValue={name} required errors={errors?.name} />
      <Field label="Mobile" name="phone" type="tel" inputMode="numeric" defaultValue={phone} errors={errors?.phone} />
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
        Save changes
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message);
      form.current?.reset();
    }
  }, [state]);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form ref={form} action={action} className="grid gap-4" noValidate>
      <FormError message={state && !state.ok && !errors ? state.error : null} />
      <Field
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        errors={errors?.currentPassword}
      />
      <Field
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={errors?.newPassword}
        hint="At least 8 characters, with a letter and a number."
      />
      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={errors?.confirmPassword}
      />
      <Button type="submit" variant="outline" disabled={pending} className="justify-self-start">
        {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
        Change password
      </Button>
    </form>
  );
}
