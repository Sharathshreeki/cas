import { describe, expect, it } from "vitest";
import { allowedTransitions, canTransition, isTerminal, releasesSlot } from "@/lib/domain/order-status";

// NFR-19, BR-08, FR-36
describe("order lifecycle", () => {
  it("follows the happy path for staff", () => {
    expect(canTransition("PLACED", "ACCEPTED", "STAFF")).toBe(true);
    expect(canTransition("ACCEPTED", "PREPARING", "STAFF")).toBe(true);
    expect(canTransition("PREPARING", "READY", "STAFF")).toBe(true);
    expect(canTransition("READY", "COMPLETED", "STAFF")).toBe(true);
  });

  it("rejects skipped or backward transitions", () => {
    expect(canTransition("PLACED", "READY", "STAFF")).toBe(false);
    expect(canTransition("PLACED", "COMPLETED", "STAFF")).toBe(false);
    expect(canTransition("READY", "PREPARING", "STAFF")).toBe(false);
    expect(canTransition("PREPARING", "CANCELLED", "STAFF")).toBe(false);
  });

  it("allows nothing after a terminal status", () => {
    for (const status of ["COMPLETED", "CANCELLED", "REJECTED"] as const) {
      expect(isTerminal(status)).toBe(true);
      expect(allowedTransitions(status, "STAFF")).toEqual([]);
      expect(allowedTransitions(status, "STUDENT")).toEqual([]);
    }
  });

  it("lets students cancel only before acceptance", () => {
    expect(canTransition("PLACED", "CANCELLED", "STUDENT")).toBe(true);
    expect(canTransition("ACCEPTED", "CANCELLED", "STUDENT")).toBe(false);
    expect(canTransition("PLACED", "ACCEPTED", "STUDENT")).toBe(false);
  });

  it("releases slot capacity only for cancellation and rejection", () => {
    expect(releasesSlot("CANCELLED")).toBe(true);
    expect(releasesSlot("REJECTED")).toBe(true);
    expect(releasesSlot("COMPLETED")).toBe(false);
  });
});
