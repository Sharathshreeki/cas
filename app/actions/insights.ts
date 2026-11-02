"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";

const EVENTS = new Set(["CLICK", "ADD_TO_CART"]);

/** Records recommendation interactions for offline evaluation (FR-82, NFR-53). */
export async function trackRecommendation(menuItemId: string, event: string, strategy: string): Promise<void> {
  if (!EVENTS.has(event) || typeof menuItemId !== "string" || menuItemId.length > 40) return;
  const user = await getCurrentUser();
  try {
    await db.recommendationEvent.create({
      data: { menuItemId, event, strategy: strategy.slice(0, 40), userId: user?.id ?? null },
    });
  } catch {
    // Tracking must never break the shopping flow.
  }
}
