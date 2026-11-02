import Link from "next/link";
import { UtensilsCrossedIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ href = "/", className, subtitle }: { href?: string; className?: string; subtitle?: string }) {
  return (
    <Link href={href} className={cn("group flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:-rotate-6">
        <UtensilsCrossedIcon className="size-4" aria-hidden />
      </span>
      <span className="leading-tight">
        PES Canteen
        {subtitle ? <span className="block text-xs font-normal text-muted-foreground">{subtitle}</span> : null}
      </span>
    </Link>
  );
}
