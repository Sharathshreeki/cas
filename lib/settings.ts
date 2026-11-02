import "server-only";
import { db } from "@/lib/db";
import type { GeoFence } from "@/lib/domain/geo";
import type { SlotPolicy } from "@/lib/domain/slots";

// Administrator-configurable system settings (FR-64), stored as key/value rows
// with code-defined defaults so a fresh database works without configuration.

export type SystemSettings = SlotPolicy & {
  orderingEnabled: boolean;
  geofence: GeoFence & { enabled: boolean };
};

export const DEFAULT_SETTINGS: SystemSettings = {
  orderingEnabled: true,
  minLeadMinutes: 15,
  bookingDays: 2,
  // PES University, RR Campus (Ring Road, Banashankari).
  geofence: { enabled: false, lat: 12.9348, lng: 77.5343, radiusMeters: 800 },
};

const KEYS = ["orderingEnabled", "minLeadMinutes", "bookingDays", "geofence"] as const;

export async function getSettings(): Promise<SystemSettings> {
  const rows = await db.systemSetting.findMany({ where: { key: { in: [...KEYS] } } });
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    geofence: { ...DEFAULT_SETTINGS.geofence, ...(stored.geofence as object | undefined) },
  } as SystemSettings;
}

export async function saveSettings(settings: SystemSettings): Promise<void> {
  await db.$transaction(
    KEYS.map((key) =>
      db.systemSetting.upsert({
        where: { key },
        create: { key, value: settings[key] },
        update: { value: settings[key] },
      }),
    ),
  );
}
