import { cn } from "@/lib/utils";

/** Standard Indian veg / non-veg marker, with a text label for screen readers. */
export function VegMark({ isVeg, className }: { isVeg: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid size-3.5 shrink-0 place-items-center rounded-[3px] border-[1.5px]",
        isVeg ? "border-success" : "border-destructive",
        className,
      )}
      role="img"
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
      title={isVeg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className={cn("size-1.5 rounded-full", isVeg ? "bg-success" : "bg-destructive")} />
    </span>
  );
}
