"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/forms/field";
import { register } from "@/app/actions/auth";

/** `nextField` is a hidden input streamed in separately, so the form itself never remounts. */
export function RegisterForm({ nextField }: { nextField?: React.ReactNode }) {
  const [state, action, pending] = useActionState(register, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;

  return (
    <form action={action} className="grid gap-4" noValidate>
      {nextField}
      <FormError message={state && !state.ok ? state.error : null} />
      <Field label="Full name" name="name"
        defaultValue={values?.name} autoComplete="name" required errors={errors?.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="SRN"
          name="srn"
        defaultValue={values?.srn}
          required
          placeholder="PES1UG23CS001"
          autoCapitalize="characters"
          errors={errors?.srn}
        />
        <Field
          label="Mobile"
          name="phone"
        defaultValue={values?.phone}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required
          placeholder="98765 43210"
          errors={errors?.phone}
        />
      </div>
      <Field
        label="Email"
        name="email"
        defaultValue={values?.email}
        type="email"
        autoComplete="email"
        required
        errors={errors?.email}
        hint="Use your university email if you have one."
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        errors={errors?.password}
        hint="At least 8 characters, with a letter and a number."
      />
      <Field
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={errors?.confirmPassword}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
        Create account
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        By creating an account you agree to the use of your data described in the{" "}
        <Link href="/privacy" className="underline hover:text-foreground">
          privacy notice
        </Link>
        .
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
