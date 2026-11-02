// Pickup-slot rules (SRS §3.5). Each hour is split into four 15-minute slots.
// Capacity is a maximum number of orders per slot — decisions/0003-slot-capacity-model.md.

import { addDays, campusDateKey, campusMidnight } from "@/lib/time";

export const SLOT_MINUTES = 15;
const MINUTE = 60_000;

export type SlotWindow = { startsAt: Date; endsAt: Date };

export type SlotPolicy = {
  /** Earliest bookable slot must start at least this many minutes from now. */
  minLeadMinutes: number;
  /** Number of campus days, starting today, that can be booked. */
  bookingDays: number;
};

export type StallHours = { opensAt: number; closesAt: number };

/** All 15-minute windows for a stall on a campus date, ignoring "now". */
export function slotsForDay(dateKey: string, hours: StallHours): SlotWindow[] {
  const midnight = campusMidnight(dateKey).getTime();
  const slots: SlotWindow[] = [];
  const first = Math.ceil(hours.opensAt / SLOT_MINUTES) * SLOT_MINUTES;
  for (let m = first; m + SLOT_MINUTES <= hours.closesAt; m += SLOT_MINUTES) {
    slots.push({
      startsAt: new Date(midnight + m * MINUTE),
      endsAt: new Date(midnight + (m + SLOT_MINUTES) * MINUTE),
    });
  }
  return slots;
}

/** Campus dates a student may book for. */
export function bookableDates(policy: SlotPolicy, now: Date = new Date()): string[] {
  const today = campusDateKey(now);
  return Array.from({ length: Math.max(1, policy.bookingDays) }, (_, i) => addDays(today, i));
}

export type SlotValidation =
  | { ok: true; window: SlotWindow }
  | { ok: false; reason: string };

/** Validates a requested slot start against stall hours and policy (FR-44). */
export function validateSlotStart(
  startsAt: Date,
  hours: StallHours,
  policy: SlotPolicy,
  now: Date = new Date(),
): SlotValidation {
  if (Number.isNaN(startsAt.getTime())) return { ok: false, reason: "Invalid pickup slot." };

  const dateKey = campusDateKey(startsAt);
  if (!bookableDates(policy, now).includes(dateKey)) {
    return { ok: false, reason: "Pickup slots can only be booked for the allowed days." };
  }

  const window = slotsForDay(dateKey, hours).find((s) => s.startsAt.getTime() === startsAt.getTime());
  if (!window) return { ok: false, reason: "That pickup slot is outside the stall's hours." };

  if (window.startsAt.getTime() < now.getTime() + policy.minLeadMinutes * MINUTE) {
    return { ok: false, reason: "That pickup slot has expired. Please choose a later slot." };
  }
  return { ok: true, window };
}

export function remainingCapacity(capacity: number, booked: number): number {
  return Math.max(0, capacity - booked);
}
