import { describe, expect, it } from "vitest";
import { orderTotalPaise, toPaise } from "@/lib/domain/money";
import { distanceMeters, isInsideFence } from "@/lib/domain/geo";
import { placeOrderSchema, registerSchema } from "@/lib/validation";

describe("money", () => {
  it("totals in integer paise without floating-point drift (FR-23, NFR-41)", () => {
    expect(orderTotalPaise([{ unitPrice: 0.1, quantity: 3 }, { unitPrice: 0.2, quantity: 1 }])).toBe(50);
    expect(orderTotalPaise([{ unitPrice: 59.99, quantity: 3 }])).toBe(17997);
    expect(toPaise("45.50")).toBe(4550);
  });
});

describe("geofence (FR-83, FR-84)", () => {
  const campus = { lat: 12.9348, lng: 77.5343, radiusMeters: 800 };
  it("accepts points inside the radius and rejects points outside", () => {
    expect(isInsideFence({ lat: 12.935, lng: 77.535 }, campus)).toBe(true);
    expect(isInsideFence({ lat: 12.9716, lng: 77.5946 }, campus)).toBe(false); // MG Road
  });
  it("computes plausible distances", () => {
    const d = distanceMeters({ lat: 12.9348, lng: 77.5343 }, { lat: 12.9716, lng: 77.5946 });
    expect(d).toBeGreaterThan(7000);
    expect(d).toBeLessThan(8000);
  });
});

describe("validation", () => {
  const order = {
    stallId: "s1",
    items: [{ menuItemId: "m1", quantity: 1, expectedPrice: 40 }],
    slotStart: "2026-11-03T06:30:00.000Z",
    paymentMethod: "CASH_ON_PICKUP",
    idempotencyKey: "abcdefgh-1234",
  };

  it("rejects zero, negative and fractional quantities (FR-25)", () => {
    for (const quantity of [0, -1, 1.5, 11]) {
      expect(placeOrderSchema.safeParse({ ...order, items: [{ ...order.items[0], quantity }] }).success).toBe(false);
    }
    expect(placeOrderSchema.safeParse(order).success).toBe(true);
  });

  it("rejects an empty cart", () => {
    expect(placeOrderSchema.safeParse({ ...order, items: [] }).success).toBe(false);
  });

  it("validates registration fields (FR-01, FR-02)", () => {
    const valid = {
      name: "Asha Rao",
      email: "Asha@PESU.pes.edu",
      srn: "pes1ug23cs001",
      phone: "9876543210",
      password: "secret123",
      confirmPassword: "secret123",
    };
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe("asha@pesu.pes.edu");
    expect(parsed.srn).toBe("PES1UG23CS001");
    expect(registerSchema.safeParse({ ...valid, confirmPassword: "other123" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: "short1", confirmPassword: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, srn: "12345" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, phone: "12345" }).success).toBe(false);
  });
});
