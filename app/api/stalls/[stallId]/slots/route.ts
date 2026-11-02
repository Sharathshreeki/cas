import { getSlotAvailability } from "@/lib/services/catalog";

// GET /api/stalls/{stallId}/slots — bookable pickup slots with remaining
// capacity for the checkout slot picker (FR-38). Public, read-only.
export async function GET(_req: Request, ctx: RouteContext<"/api/stalls/[stallId]/slots">) {
  const { stallId } = await ctx.params;
  const days = await getSlotAvailability(stallId);
  if (!days) return Response.json({ error: "Stall not found" }, { status: 404 });
  return Response.json({ days }, { headers: { "Cache-Control": "no-store" } });
}
