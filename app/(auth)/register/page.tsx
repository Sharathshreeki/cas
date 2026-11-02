import type { Metadata } from "next";
import { Suspense } from "react";
import { FadeIn } from "@/components/motion";
import { RegisterForm } from "@/components/forms/register-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <FadeIn className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create your student account</CardTitle>
          <CardDescription>Order ahead from any PES canteen.</CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm
            nextField={
              <Suspense fallback={null}>
                <NextInput searchParams={searchParams} />
              </Suspense>
            }
          />
        </CardContent>
      </Card>
    </FadeIn>
  );
}

async function NextInput({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const { next } = await searchParams;
  return typeof next === "string" ? <input type="hidden" name="next" value={next} /> : null;
}
