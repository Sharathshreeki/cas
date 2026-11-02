import { describe, expect, it } from "vitest";
import { bookableDates, slotsForDay, validateSlotStart } from "@/lib/domain/slots";
import { addDays, campusDateKey, campusMidnight } from "@/lib/time";

const hours = { opensAt: 8 * 60, closesAt: 10 * 60 };
const policy = { minLeadMinutes: 15, bookingDays: 2 };
const at = (dateKey: string, minutes: number) => new Date(campusMidnight(dateKey).getTime() + minutes * 60_000);

// FR-38, FR-44 and the "four 15-minute slots per hour" rule
describe("pickup slots", () => {
  it("splits each hour into four 15-minute slots within stall hours", () => {
    const slots = slotsForDay("2026-11-03", hours);
    expect(slots).toHaveLength(8);
    expect(slots[0].startsAt.toISOString()).toBe("2026-11-03T02:30:00.000Z"); // 08:00 IST
    expect(slots.at(-1)!.endsAt.toISOString()).toBe("2026-11-03T04:30:00.000Z"); // 10:00 IST
    for (const s of slots) expect(s.endsAt.getTime() - s.startsAt.getTime()).toBe(15 * 60_000);
  });

  it("aligns opening times that are not on a quarter hour", () => {
    const slots = slotsForDay("2026-11-03", { opensAt: 8 * 60 + 5, closesAt: 9 * 60 });
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      "2026-11-03T02:45:00.000Z",
      "2026-11-03T03:00:00.000Z",
      "2026-11-03T03:15:00.000Z",
    ]);
  });

  it("offers today plus the configured number of days", () => {
    const now = at("2026-11-03", 9 * 60);
    expect(bookableDates(policy, now)).toEqual(["2026-11-03", "2026-11-04"]);
  });

  it("accepts a valid future slot", () => {
    const now = at("2026-11-03", 8 * 60);
    expect(validateSlotStart(at("2026-11-03", 9 * 60), hours, policy, now).ok).toBe(true);
  });

  it("rejects expired slots and slots inside the lead time", () => {
    const now = at("2026-11-03", 9 * 60);
    expect(validateSlotStart(at("2026-11-03", 8 * 60 + 30), hours, policy, now).ok).toBe(false);
    expect(validateSlotStart(at("2026-11-03", 9 * 60 + 0), hours, policy, now).ok).toBe(false);
    expect(validateSlotStart(at("2026-11-03", 9 * 60 + 15), hours, policy, now).ok).toBe(true);
  });

  it("rejects misaligned, out-of-hours and too-far-ahead slots", () => {
    const now = at("2026-11-03", 7 * 60);
    expect(validateSlotStart(at("2026-11-03", 9 * 60 + 7), hours, policy, now).ok).toBe(false);
    expect(validateSlotStart(at("2026-11-03", 11 * 60), hours, policy, now).ok).toBe(false);
    expect(validateSlotStart(at(addDays("2026-11-03", 2), 9 * 60), hours, policy, now).ok).toBe(false);
  });

  it("uses campus time for calendar dates", () => {
    // 20:00 UTC is 01:30 the next day in IST.
    expect(campusDateKey(new Date("2026-11-03T20:00:00Z"))).toBe("2026-11-04");
  });
});
