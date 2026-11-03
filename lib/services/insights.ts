import "server-only";
import { db } from "@/lib/db";
import { toMenuItemDTO, type MenuItemDTO } from "@/lib/services/catalog";
import { addDays, campusDateKey, campusDayRange, campusWeekday } from "@/lib/time";

// Reads the output of the Python ML jobs in ml/ (SRS §3.9, §3.10) and falls back
// to documented heuristics whenever model output is missing or insufficient, so
// ordering never depends on ML (NFR-05, NFR-56, BR-13).
// See decisions/0006-ml-integration-boundary.md.

const ACTIVE_STATUSES = ["PLACED", "ACCEPTED", "PREPARING", "READY", "COMPLETED"] as const;

export type RecommendationStrategy = "MODEL_PERSONAL" | "MODEL_GLOBAL" | "PERSONAL_HISTORY" | "POPULARITY" | "NEW_ITEMS";
export type Recommendation = MenuItemDTO & { stallName: string; reason: string };

const PERSONAL_MIN_ORDERS = 3;
const MODEL_REASON: Record<string, string> = {
  REORDER: "You order this often",
  SIMILAR: "Often ordered with your favourites",
  POPULAR: "Popular on campus",
};
const POPULARITY_WINDOW_DAYS = 30;

/**
 * Recommendations for immediate purchase (FR-75…FR-81):
 * 0. ML output (`recommendation_result`, latest model version): the student's own
 *    ranking, or the global ranking for new or anonymous students.
 * Then, to fill any remaining places (or when no model has run):
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

  // Model output is optional: any failure here (e.g. ML tables not migrated
  // yet) falls through to the heuristics below instead of breaking the page.
  const latest = await db.recommendationResult
    .findFirst({ orderBy: { generatedAt: "desc" }, select: { modelVersion: true } })
    .catch((error: unknown) => {
      console.error("Model recommendations unavailable, using fallback:", error);
      return null;
    });
  if (latest) {
    const ranked = (forUser: string | null) =>
      db.recommendationResult.findMany({
        where: { modelVersion: latest.modelVersion, userId: forUser, menuItem: eligible },
        orderBy: { rank: "asc" },
        take: limit,
        include: { menuItem: { include: { stall: { select: { name: true } } } } },
      });
    let rows = userId ? await ranked(userId) : [];
    strategy = "MODEL_PERSONAL";
    if (!rows.length) {
      rows = await ranked(null);
      strategy = "MODEL_GLOBAL";
    }
    for (const r of rows) {
      picked.set(r.menuItemId, {
        ...toMenuItemDTO(r.menuItem),
        stallName: r.menuItem.stall.name,
        reason: MODEL_REASON[r.reason] ?? "Recommended",
      });
    }
    if (!picked.size) strategy = "NEW_ITEMS";
  }

  if (userId && picked.size < limit) {
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
      const before = picked.size;
      add(inOrder(await loadItems(ids), ids), "You order this often");
      if (strategy === "NEW_ITEMS" && picked.size > before) strategy = "PERSONAL_HISTORY";
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
  /** Held-out evaluation of the model that produced these numbers (FR-71, NFR-52). */
  evaluation: ForecastEvaluation | null;
  rows: ForecastRow[];
};

export type ForecastEvaluation = {
  algorithm: string;
  testMae: number;
  baselineMae: number;
  improvementPct: number;
  testFrom: string;
  testTo: string;
  syntheticShare: number;
};

async function forecastEvaluation(modelVersion: string): Promise<ForecastEvaluation | null> {
  const run = await db.modelRun
    .findUnique({ where: { task_modelVersion: { task: "FORECAST", modelVersion } } })
    .catch((error: unknown) => {
      console.error("Model evaluation unavailable:", error);
      return null;
    });
  if (!run) return null;
  const m = run.metrics as {
    chosen?: string;
    baseline?: string;
    test_mae?: Record<string, number>;
    improvement_vs_baseline_pct?: number;
    split?: { test_from?: string; test_to?: string };
  };
  if (!m.chosen || !m.baseline || !m.test_mae) return null;
  return {
    algorithm: run.algorithm,
    testMae: m.test_mae[m.chosen],
    baselineMae: m.test_mae[m.baseline],
    improvementPct: m.improvement_vs_baseline_pct ?? 0,
    testFrom: m.split?.test_from ?? "",
    testTo: m.split?.test_to ?? "",
    syntheticShare: run.syntheticShare,
  };
}

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
      evaluation: await forecastEvaluation(latestVersion),
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
    evaluation: null,
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
