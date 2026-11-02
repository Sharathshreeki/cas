import "server-only";
import { db } from "@/lib/db";
import { toMenuItemDTO, type MenuItemDTO } from "@/lib/services/catalog";
import { addDays, campusDateKey, campusDayRange, campusWeekday } from "@/lib/time";

// Non-ML fallbacks for the two ML modules (SRS §3.9, §3.10). The Python models
// that will live in ml/ are not integrated yet. Until they are, the app uses
// documented heuristics so it never blocks ordering (NFR-05, NFR-56, BR-13).
// See decisions/0006-ml-integration-boundary.md.

const ACTIVE_STATUSES = ["PLACED", "ACCEPTED", "PREPARING", "READY", "COMPLETED"] as const;

export type RecommendationStrategy = "PERSONAL_HISTORY" | "POPULARITY" | "NEW_ITEMS";
export type Recommendation = MenuItemDTO & { stallName: string; reason: string };

const PERSONAL_MIN_ORDERS = 3;
const POPULARITY_WINDOW_DAYS = 30;

/**
 * Recommendations for immediate purchase (FR-75…FR-81):
 * 1. Students with ≥3 completed orders: items they reorder most.
 * 2. Otherwise, or to fill gaps: most-ordered items over the last 30 days.
 * 3. With no order data at all: newest available items.
 * Unavailable items, closed stalls and archived items are always excluded (BR-11).
 */
export async function getRecommendations(
  userId: string | null,
  limit = 8,
): Promise<{ strategy: RecommendationStrategy; items: Recommendation[] }> {
  const eligible = { isAvailable: true, isArchived: false, stall: { isOpen: true } };
  const picked = new Map<string, Recommendation>();
  let strategy: RecommendationStrategy = "NEW_ITEMS";

  const add = (rows: Awaited<ReturnType<typeof loadItems>>, reason: string) => {
    for (const row of rows) {
      if (picked.size >= limit) break;
      if (!picked.has(row.id)) picked.set(row.id, { ...toMenuItemDTO(row), stallName: row.stall.name, reason });
    }
  };
  const loadItems = (ids: string[]) =>
    db.menuItem.findMany({ where: { id: { in: ids }, ...eligible }, include: { stall: { select: { name: true } } } });
  const inOrder = <T extends { id: string }>(rows: T[], ids: string[]) =>
    ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is T => Boolean(r));

  if (userId) {
    const completed = await db.order.count({ where: { studentId: userId, status: "COMPLETED" } });
    if (completed >= PERSONAL_MIN_ORDERS) {
      const favourites = await db.orderItem.groupBy({
        by: ["menuItemId"],
        where: { order: { studentId: userId, status: "COMPLETED" } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: limit,
      });
      const ids = favourites.map((f) => f.menuItemId);
      add(inOrder(await loadItems(ids), ids), "You order this often");
      if (picked.size) strategy = "PERSONAL_HISTORY";
    }
  }

  if (picked.size < limit) {
    const since = new Date(Date.now() - POPULARITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const popular = await db.orderItem.groupBy({
      by: ["menuItemId"],
      where: { order: { placedAt: { gte: since }, status: { in: [...ACTIVE_STATUSES] } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit * 3,
    });
    const ids = popular.map((p) => p.menuItemId);
    const before = picked.size;
    add(inOrder(await loadItems(ids), ids), "Popular on campus");
    if (strategy === "NEW_ITEMS" && picked.size > before) strategy = "POPULARITY";
  }

  if (picked.size < limit) {
    const fresh = await db.menuItem.findMany({
      where: eligible,
      orderBy: { createdAt: "desc" },
      take: limit * 2,
      include: { stall: { select: { name: true } } },
    });
    add(fresh, "Available now");
  }

  return { strategy, items: [...picked.values()] };
}

export type ForecastRow = {
  menuItemId: string;
  name: string;
  isAvailable: boolean;
  /** Predicted quantity for the day, or null when history is insufficient. */
  predicted: number | null;
  /** Quantities sold on the same weekday in previous weeks (newest first). */
  history: number[];
};

export type Forecast = {
  date: string;
  period: "DAY";
  unit: "portions";
  source: "MODEL" | "BASELINE";
  method: string;
  modelVersion: string | null;
  generatedAt: string;
  rows: ForecastRow[];
};

const BASELINE_WEEKS = 4;
const BASELINE_MIN_WEEKS = 2;

/**
 * Demand for a stall's items on a campus date (FR-68…FR-72, UC-03).
 * Uses forecasts written by the ML service to `forecast_result` when present;
 * otherwise a seasonal-naive baseline: the mean quantity sold on the same
 * weekday over the previous 4 weeks, requiring at least 2 weeks of history.
 */
export async function getDemandForecast(stallId: string, dateKey: string): Promise<Forecast> {
  const items = await db.menuItem.findMany({
    where: { stallId, isArchived: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, isAvailable: true, createdAt: true },
  });

  const modelRows = await db.forecastResult.findMany({
    where: { stallId, forecastDate: new Date(`${dateKey}T00:00:00Z`), period: "DAY" },
    orderBy: { generatedAt: "desc" },
  });

  // Same-weekday history is needed for both the baseline and context columns.
  const weeks = Array.from({ length: BASELINE_WEEKS }, (_, i) => addDays(dateKey, -7 * (i + 1)));
  const history = new Map<string, number[]>(items.map((i) => [i.id, []]));
  for (const week of weeks) {
    const { start, end } = campusDayRange(week);
    const sold = await db.orderItem.groupBy({
      by: ["menuItemId"],
      where: {
        menuItem: { stallId },
        order: { slot: { startsAt: { gte: start, lt: end } }, status: { in: [...ACTIVE_STATUSES] } },
      },
      _sum: { quantity: true },
    });
    const byItem = new Map(sold.map((s) => [s.menuItemId, s._sum.quantity ?? 0]));
    for (const item of items) {
      // Weeks before the item existed are not evidence of zero demand.
      if (campusDayRange(week).end > item.createdAt) history.get(item.id)!.push(byItem.get(item.id) ?? 0);
    }
  }

  if (modelRows.length) {
    const latestVersion = modelRows[0].modelVersion;
    const predicted = new Map(
      modelRows.filter((r) => r.modelVersion === latestVersion).map((r) => [r.menuItemId, Number(r.predictedQuantity)]),
    );
    return {
      date: dateKey,
      period: "DAY",
      unit: "portions",
      source: "MODEL",
      method: "ML model output",
      modelVersion: latestVersion,
      generatedAt: modelRows[0].generatedAt.toISOString(),
      rows: items.map((i) => ({
        menuItemId: i.id,
        name: i.name,
        isAvailable: i.isAvailable,
        predicted: predicted.get(i.id) ?? null,
        history: history.get(i.id) ?? [],
      })),
    };
  }

  return {
    date: dateKey,
    period: "DAY",
    unit: "portions",
    source: "BASELINE",
    method: `Mean of the same weekday over the last ${BASELINE_WEEKS} weeks (${weekdayName(dateKey)}s)`,
    modelVersion: null,
    generatedAt: new Date().toISOString(),
    rows: items.map((i) => {
      const h = history.get(i.id) ?? [];
      return {
        menuItemId: i.id,
        name: i.name,
        isAvailable: i.isAvailable,
        predicted: h.length >= BASELINE_MIN_WEEKS ? Math.round((h.reduce((a, b) => a + b, 0) / h.length) * 10) / 10 : null,
        history: h,
      };
    }),
  };
}

function weekdayName(dateKey: string): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][campusWeekday(dateKey)];
}

export function defaultForecastDate(): string {
  return addDays(campusDateKey(), 1);
}
