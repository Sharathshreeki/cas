"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/forms/field";
import { login } from "@/app/actions/auth";

/** `nextField` is a hidden input streamed in separately, so the form itself never remounts. */
export function LoginForm({ nextField }: { nextField?: React.ReactNode }) {
  const [state, action, pending] = useActionState(login, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;

  return (
    <form action={action} className="grid gap-4" noValidate>
      {nextField}
      <FormError message={state && !state.ok && !errors ? state.error : null} />
      <Field label="Email" name="email"
        defaultValue={values?.email} type="email" autoComplete="email" required errors={errors?.email} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={errors?.password}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
        Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create a student account
        </Link>
      </p>
    </form>
  );
}
