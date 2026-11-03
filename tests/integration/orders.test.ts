import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { OrderError, placeOrder, simulateOnlinePayment, transitionOrder } from "@/lib/services/orders";
import { getStudentOrder } from "@/lib/services/order-queries";
import { getDemandForecast, getRecommendations } from "@/lib/services/insights";
import { addDays, campusDateKey, campusMidnight } from "@/lib/time";
import type { PlaceOrderInput } from "@/lib/validation";

// Integration tests for the SRS acceptance criteria (§9) against a real
// PostgreSQL database. Requires TEST_DATABASE_URL.

const TABLES = [
  "model_run",
  "recommendation_result",
  "recommendation_event",
  "forecast_result",
  "notification",
  "order_status_history",
  "payment",
  "order_item",
  "orders",
  "pickup_slot",
  "audit_log",
  "app_user",
  "menu_item",
  "stall",
  "system_setting",
];

async function reset() {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
}

/** Tomorrow at 12:00 campus time — always bookable with the default policy. */
function tomorrowNoon(offsetMinutes = 0) {
  return new Date(campusMidnight(addDays(campusDateKey(), 1)).getTime() + (12 * 60 + offsetMinutes) * 60_000);
}

async function fixtures(slotCapacity = 2) {
  const stall = await db.stall.create({
    data: { name: "Test Stall", opensAt: 0, closesAt: 24 * 60 - 15, slotCapacity },
  });
  const other = await db.stall.create({ data: { name: "Other Stall" } });
  const dosa = await db.menuItem.create({ data: { stallId: stall.id, name: "Dosa", price: 60, category: "Tiffin" } });
  const coffee = await db.menuItem.create({ data: { stallId: stall.id, name: "Coffee", price: 20.5, category: "Drinks" } });
  const mk = (email: string, role: "STUDENT" | "STAFF" = "STUDENT", stallId?: string) =>
    db.user.create({ data: { name: email, email, passwordHash: "x", role, stallId } });
  return {
    stall,
    other,
    dosa,
    coffee,
    alice: await mk("alice@test.edu"),
    bob: await mk("bob@test.edu"),
    staff: await mk("staff@test.edu", "STAFF", stall.id),
    otherStaff: await mk("other@test.edu", "STAFF", other.id),
  };
}

function orderInput(f: Awaited<ReturnType<typeof fixtures>>, overrides: Partial<PlaceOrderInput> = {}): PlaceOrderInput {
  return {
    stallId: f.stall.id,
    items: [
      { menuItemId: f.dosa.id, quantity: 2, expectedPrice: 60 },
      { menuItemId: f.coffee.id, quantity: 1, expectedPrice: 20.5 },
    ],
    slotStart: tomorrowNoon().toISOString(),
    paymentMethod: "CASH_ON_PICKUP",
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

async function expectOrderError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((e) => e instanceof OrderError && e.code === code);
}

beforeEach(reset);
afterAll(async () => {
  await reset();
  await db.$disconnect();
});

describe("placing orders", () => {
  it("TC-06: stores one consistent order with server-computed total and price snapshots", async () => {
    const f = await fixtures();
    const { id, code } = await placeOrder(f.alice.id, orderInput(f));
    const order = await db.order.findUniqueOrThrow({ where: { id }, include: { items: true, payment: true, slot: true } });

    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(order.totalAmount.toString()).toBe("140.5");
    expect(order.items).toHaveLength(2);
    expect(order.payment?.status).toBe("PENDING");
    expect(order.slot.bookedCount).toBe(1);
    expect(order.status).toBe("PLACED");

    // BR-09: later price changes do not alter history.
    await db.menuItem.update({ where: { id: f.dosa.id }, data: { price: 99 } });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: id, menuItemId: f.dosa.id } });
    expect(item.unitPrice.toString()).toBe("60");
  });

  it("TC-05: rejects unavailable items", async () => {
    const f = await fixtures();
    await db.menuItem.update({ where: { id: f.dosa.id }, data: { isAvailable: false } });
    await expectOrderError(placeOrder(f.alice.id, orderInput(f)), "ITEM_UNAVAILABLE");
    expect(await db.order.count()).toBe(0);
  });

  it("FR-24: rejects an order when a price changed since it was added", async () => {
    const f = await fixtures();
    await db.menuItem.update({ where: { id: f.coffee.id }, data: { price: 25 } });
    await expectOrderError(placeOrder(f.alice.id, orderInput(f)), "PRICE_CHANGED");
  });

  it("FR-26: rejects items from another stall", async () => {
    const f = await fixtures();
    const foreign = await db.menuItem.create({ data: { stallId: f.other.id, name: "Juice", price: 40 } });
    const input = orderInput(f, { items: [{ menuItemId: foreign.id, quantity: 1, expectedPrice: 40 }] });
    await expectOrderError(placeOrder(f.alice.id, input), "ITEM_UNAVAILABLE");
  });

  it("FR-44: rejects expired and misaligned slots", async () => {
    const f = await fixtures();
    await expectOrderError(
      placeOrder(f.alice.id, orderInput(f, { slotStart: new Date(Date.now() - 3600_000).toISOString() })),
      "INVALID_SLOT",
    );
    await expectOrderError(
      placeOrder(f.alice.id, orderInput(f, { slotStart: tomorrowNoon(7).toISOString() })),
      "INVALID_SLOT",
    );
  });

  it("rejects orders for a closed stall", async () => {
    const f = await fixtures();
    await db.stall.update({ where: { id: f.stall.id }, data: { isOpen: false } });
    await expectOrderError(placeOrder(f.alice.id, orderInput(f)), "STALL_CLOSED");
  });

  it("FR-37: a retried submission returns the original order", async () => {
    const f = await fixtures();
    const input = orderInput(f);
    const first = await placeOrder(f.alice.id, input);
    const retry = await placeOrder(f.alice.id, input);
    expect(retry).toEqual({ ...first, duplicate: true });
    expect(await db.order.count()).toBe(1);
  });

  it("FR-83/84: enforces the geofence only when enabled", async () => {
    const f = await fixtures();
    await db.systemSetting.create({
      data: { key: "geofence", value: { enabled: true, lat: 12.9348, lng: 77.5343, radiusMeters: 800 } },
    });
    await expectOrderError(placeOrder(f.alice.id, orderInput(f)), "LOCATION_REQUIRED");
    await expectOrderError(placeOrder(f.alice.id, orderInput(f, { location: { lat: 12.97, lng: 77.59 } })), "OUTSIDE_CAMPUS");
    await expect(placeOrder(f.alice.id, orderInput(f, { location: { lat: 12.935, lng: 77.535 } }))).resolves.toBeTruthy();
  });
});

describe("slot capacity", () => {
  it("TC-07: rejects bookings beyond capacity", async () => {
    const f = await fixtures(2);
    await placeOrder(f.alice.id, orderInput(f));
    await placeOrder(f.bob.id, orderInput(f));
    await expectOrderError(placeOrder(f.alice.id, orderInput(f)), "SLOT_FULL");
  });

  it("TC-08: concurrent requests for the last places never overbook", async () => {
    const f = await fixtures(3);
    const students = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        db.user.create({ data: { name: `s${i}`, email: `s${i}@test.edu`, passwordHash: "x" } }),
      ),
    );
    const results = await Promise.allSettled(students.map((s) => placeOrder(s.id, orderInput(f))));

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const full = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof OrderError && r.reason.code === "SLOT_FULL",
    ).length;
    const slot = await db.pickupSlot.findFirstOrThrow({ where: { stallId: f.stall.id } });

    expect(ok).toBe(3);
    expect(full).toBe(9);
    expect(slot.bookedCount).toBe(3);
    expect(await db.order.count()).toBe(3);
  });

  it("FR-45: cancelling releases capacity", async () => {
    const f = await fixtures(1);
    const first = await placeOrder(f.alice.id, orderInput(f));
    await expectOrderError(placeOrder(f.bob.id, orderInput(f)), "SLOT_FULL");
    await transitionOrder({ id: f.alice.id, role: "STUDENT", stallId: null }, first.id, "CANCELLED");
    await expect(placeOrder(f.bob.id, orderInput(f))).resolves.toBeTruthy();
  });
});

describe("order lifecycle", () => {
  it("TC-09: staff move an order through the lifecycle with history and timestamps", async () => {
    const f = await fixtures();
    const { id } = await placeOrder(f.alice.id, orderInput(f));
    const staff = { id: f.staff.id, role: "STAFF" as const, stallId: f.stall.id };
    for (const to of ["ACCEPTED", "PREPARING", "READY", "COMPLETED"] as const) {
      await transitionOrder(staff, id, to);
    }
    const order = await db.order.findUniqueOrThrow({ where: { id }, include: { history: true, payment: true } });
    expect(order.status).toBe("COMPLETED");
    expect(order.acceptedAt && order.preparingAt && order.readyAt && order.completedAt).toBeTruthy();
    expect(order.history).toHaveLength(5);
    // Cash is collected at handover.
    expect(order.paymentStatus).toBe("PAID");
    expect(order.payment?.transactionRef).toMatch(/^CASH-/);
  });

  it("NFR-19: rejects skipped transitions", async () => {
    const f = await fixtures();
    const { id } = await placeOrder(f.alice.id, orderInput(f));
    await expectOrderError(
      transitionOrder({ id: f.staff.id, role: "STAFF", stallId: f.stall.id }, id, "READY"),
      "INVALID_TRANSITION",
    );
  });

  it("TC-10: staff cannot update another stall's order", async () => {
    const f = await fixtures();
    const { id } = await placeOrder(f.alice.id, orderInput(f));
    await expectOrderError(
      transitionOrder({ id: f.otherStaff.id, role: "STAFF", stallId: f.other.id }, id, "ACCEPTED"),
      "FORBIDDEN",
    );
  });

  it("FR-36: students cannot cancel after acceptance or cancel others' orders", async () => {
    const f = await fixtures();
    const { id } = await placeOrder(f.alice.id, orderInput(f));
    await expectOrderError(transitionOrder({ id: f.bob.id, role: "STUDENT", stallId: null }, id, "CANCELLED"), "NOT_FOUND");
    await transitionOrder({ id: f.staff.id, role: "STAFF", stallId: f.stall.id }, id, "ACCEPTED");
    await expectOrderError(
      transitionOrder({ id: f.alice.id, role: "STUDENT", stallId: null }, id, "CANCELLED"),
      "INVALID_TRANSITION",
    );
  });

  it("TC-15: a student cannot read another student's order", async () => {
    const f = await fixtures();
    const { code } = await placeOrder(f.alice.id, orderInput(f));
    expect(await getStudentOrder(f.alice.id, code)).not.toBeNull();
    expect(await getStudentOrder(f.bob.id, code)).toBeNull();
  });
});

describe("payments", () => {
  it("FR-51: records failed and successful simulated payments, refunding on cancellation", async () => {
    const f = await fixtures();
    const { id } = await placeOrder(f.alice.id, orderInput(f, { paymentMethod: "SIMULATED_ONLINE" }));
    const staff = { id: f.staff.id, role: "STAFF" as const, stallId: f.stall.id };

    expect(await simulateOnlinePayment(f.alice.id, id, "FAILURE")).toBe("FAILED");
    // Unpaid online orders cannot be handed over.
    for (const to of ["ACCEPTED", "PREPARING", "READY"] as const) await transitionOrder(staff, id, to);
    await expectOrderError(transitionOrder(staff, id, "COMPLETED"), "PAYMENT_REQUIRED");

    expect(await simulateOnlinePayment(f.alice.id, id, "SUCCESS")).toBe("PAID");
    await expectOrderError(simulateOnlinePayment(f.alice.id, id, "SUCCESS"), "INVALID_PAYMENT");
    await expectOrderError(simulateOnlinePayment(f.bob.id, id, "SUCCESS"), "NOT_FOUND");

    const second = await placeOrder(f.alice.id, orderInput(f, { paymentMethod: "SIMULATED_ONLINE" }));
    await simulateOnlinePayment(f.alice.id, second.id, "SUCCESS");
    await transitionOrder({ id: f.alice.id, role: "STUDENT", stallId: null }, second.id, "CANCELLED");
    const refunded = await db.payment.findUniqueOrThrow({ where: { orderId: second.id } });
    expect(refunded.status).toBe("REFUNDED");
  });
});

describe("insight fallbacks", () => {
  it("TC-11/TC-12: new students get popular or fallback items, never unavailable ones", async () => {
    const f = await fixtures();
    const empty = await getRecommendations(f.alice.id);
    expect(empty.strategy).toBe("NEW_ITEMS");
    expect(empty.items.map((i) => i.id).sort()).toEqual([f.coffee.id, f.dosa.id].sort());

    await placeOrder(f.bob.id, orderInput(f, { items: [{ menuItemId: f.coffee.id, quantity: 3, expectedPrice: 20.5 }] }));
    const popular = await getRecommendations(f.alice.id);
    expect(popular.strategy).toBe("POPULARITY");
    expect(popular.items[0].id).toBe(f.coffee.id);

    await db.menuItem.update({ where: { id: f.coffee.id }, data: { isAvailable: false } });
    const afterSoldOut = await getRecommendations(f.alice.id);
    expect(afterSoldOut.items.map((i) => i.id)).not.toContain(f.coffee.id);
  });

  it("TC-13: forecasting reports insufficient data instead of guessing", async () => {
    const f = await fixtures();
    const forecast = await getDemandForecast(f.stall.id, addDays(campusDateKey(), 1));
    expect(forecast.source).toBe("BASELINE");
    expect(forecast.rows.every((r) => r.predicted === null)).toBe(true);
  });

  it("FR-69/74: prefers stored model forecasts and reports their version", async () => {
    const f = await fixtures();
    const date = addDays(campusDateKey(), 1);
    await db.forecastResult.create({
      data: {
        stallId: f.stall.id,
        menuItemId: f.dosa.id,
        forecastDate: new Date(`${date}T00:00:00Z`),
        predictedQuantity: 42,
        modelVersion: "rf-v1",
      },
    });
    await db.modelRun.create({
      data: {
        task: "FORECAST",
        modelVersion: "rf-v1",
        algorithm: "random_forest",
        metrics: {
          chosen: "random_forest",
          baseline: "same_weekday_mean_4w",
          test_mae: { random_forest: 2.4, same_weekday_mean_4w: 2.8 },
          improvement_vs_baseline_pct: 14.3,
          split: { test_from: "2026-10-26", test_to: "2026-11-02" },
        },
        syntheticShare: 1,
        trainRows: 100,
        dataFrom: new Date("2026-10-01"),
        dataTo: new Date("2026-11-02"),
      },
    });
    const forecast = await getDemandForecast(f.stall.id, date);
    expect(forecast.source).toBe("MODEL");
    expect(forecast.modelVersion).toBe("rf-v1");
    expect(forecast.rows.find((r) => r.menuItemId === f.dosa.id)?.predicted).toBe(42);
    expect(forecast.evaluation).toMatchObject({ testMae: 2.4, baselineMae: 2.8, improvementPct: 14.3, syntheticShare: 1 });
  });

  it("FR-75/78/79: uses model rankings, skips sold-out items and falls back to the global ranking", async () => {
    const f = await fixtures();
    const juice = await db.menuItem.create({ data: { stallId: f.stall.id, name: "Juice", price: 30 } });
    const rows = [
      { userId: f.alice.id, menuItemId: f.coffee.id, rank: 1, reason: "REORDER" },
      { userId: f.alice.id, menuItemId: f.dosa.id, rank: 2, reason: "SIMILAR" },
      { userId: null, menuItemId: juice.id, rank: 1, reason: "POPULAR" },
    ];
    await db.recommendationResult.createMany({
      data: rows.map((r) => ({ ...r, score: 1 / r.rank, modelVersion: "rec-v1" })),
    });

    const personal = await getRecommendations(f.alice.id, 3);
    expect(personal.strategy).toBe("MODEL_PERSONAL");
    expect(personal.items.slice(0, 2).map((i) => i.id)).toEqual([f.coffee.id, f.dosa.id]);
    expect(personal.items[1].reason).toMatch(/favourites/);

    await db.menuItem.update({ where: { id: f.coffee.id }, data: { isAvailable: false } });
    expect((await getRecommendations(f.alice.id, 3)).items.map((i) => i.id)).not.toContain(f.coffee.id);

    const newcomer = await getRecommendations(f.bob.id, 1);
    expect(newcomer.strategy).toBe("MODEL_GLOBAL");
    expect(newcomer.items.map((i) => i.id)).toEqual([juice.id]);
  });
});
