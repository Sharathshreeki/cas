import "server-only";
import { db } from "@/lib/db";
import { bookableDates, remainingCapacity, slotsForDay, validateSlotStart } from "@/lib/domain/slots";
import { getSettings } from "@/lib/settings";
import { campusDayRange, campusMinuteOfDay } from "@/lib/time";

// Public read models for stall discovery and menus (SRS §3.2). Prices are
// converted to plain numbers so they can cross the server/client boundary.

export type StallSummary = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  isOpen: boolean;
  opensAt: number;
  closesAt: number;
  itemCount: number;
  availableCount: number;
};

export type MenuItemDTO = {
  id: string;
  stallId: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  prepTimeMinutes: number;
  isAvailable: boolean;
  isVeg: boolean;
};

type MenuItemRow = {
  id: string;
  stallId: string;
  name: string;
  description: string | null;
  category: string;
  price: { toString(): string };
  prepTimeMinutes: number;
  isAvailable: boolean;
  isVeg: boolean;
};

export function toMenuItemDTO(m: MenuItemRow): MenuItemDTO {
  return {
    id: m.id,
    stallId: m.stallId,
    name: m.name,
    description: m.description,
    category: m.category,
    price: Number(m.price.toString()),
    prepTimeMinutes: m.prepTimeMinutes,
    isAvailable: m.isAvailable,
    isVeg: m.isVeg,
  };
}

export async function listStalls(): Promise<StallSummary[]> {
  const stalls = await db.stall.findMany({
    orderBy: [{ isOpen: "desc" }, { name: "asc" }],
    include: { menuItems: { where: { isArchived: false }, select: { isAvailable: true } } },
  });
  return stalls.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    location: s.location,
    isOpen: s.isOpen,
    opensAt: s.opensAt,
    closesAt: s.closesAt,
    itemCount: s.menuItems.length,
    availableCount: s.menuItems.filter((m) => m.isAvailable).length,
  }));
}

/** Whether the stall is open and inside its operating window right now. */
export function isServingNow(stall: { isOpen: boolean; opensAt: number; closesAt: number }, now = new Date()) {
  const minute = campusMinuteOfDay(now);
  return stall.isOpen && minute >= stall.opensAt && minute < stall.closesAt;
}

export async function getStallWithMenu(stallId: string) {
  const stall = await db.stall.findUnique({
    where: { id: stallId },
    include: {
      menuItems: {
        where: { isArchived: false },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      },
    },
  });
  if (!stall) return null;
  return {
    id: stall.id,
    name: stall.name,
    description: stall.description,
    location: stall.location,
    isOpen: stall.isOpen,
    opensAt: stall.opensAt,
    closesAt: stall.closesAt,
    menu: stall.menuItems.map(toMenuItemDTO),
  };
}

export type SlotAvailability = {
  startsAt: string;
  endsAt: string;
  remaining: number;
  capacity: number;
};

export type SlotDay = { date: string; slots: SlotAvailability[] };

/**
 * Bookable pickup slots for a stall (FR-38, FR-44). Unbooked slots are virtual:
 * they use the stall's default capacity until the first order creates the row.
 */
export async function getSlotAvailability(stallId: string, now = new Date()): Promise<SlotDay[] | null> {
  const [stall, settings] = await Promise.all([db.stall.findUnique({ where: { id: stallId } }), getSettings()]);
  if (!stall) return null;

  const dates = bookableDates(settings, now);
  const first = campusDayRange(dates[0]).start;
  const last = campusDayRange(dates[dates.length - 1]).end;
  const booked = await db.pickupSlot.findMany({
    where: { stallId, startsAt: { gte: first, lt: last } },
    select: { startsAt: true, capacity: true, bookedCount: true },
  });
  const bookedByStart = new Map(booked.map((b) => [b.startsAt.getTime(), b]));

  return dates.map((date) => ({
    date,
    slots: slotsForDay(date, stall)
      .filter((w) => validateSlotStart(w.startsAt, stall, settings, now).ok)
      .map((w) => {
        const row = bookedByStart.get(w.startsAt.getTime());
        const capacity = row?.capacity ?? stall.slotCapacity;
        return {
          startsAt: w.startsAt.toISOString(),
          endsAt: w.endsAt.toISOString(),
          capacity,
          remaining: remainingCapacity(capacity, row?.bookedCount ?? 0),
        };
      }),
  }));
}
