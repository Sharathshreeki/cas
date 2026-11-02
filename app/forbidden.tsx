import Link from "next/link";
import { ShieldXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <ShieldXIcon className="size-6" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">You don&apos;t have access to this page</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Your account role doesn&apos;t allow this. If you think this is a mistake, contact the canteen administrator.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Go to home</Link>
      </Button>
    </main>
  );
}
