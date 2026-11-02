import type { Metadata } from "next";
import { Suspense } from "react";
import { FadeIn } from "@/components/motion";
import { LoginForm } from "@/components/forms/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <FadeIn className="w-full max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in to order and track your food.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm
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

async function NextInput({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return typeof next === "string" ? <input type="hidden" name="next" value={next} /> : null;
}
