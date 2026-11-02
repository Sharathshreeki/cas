import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

// Audit trail for administrative and security events (FR-65, NFR-14).
// Callers must never pass passwords, tokens or raw location data in `details`.
export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: Prisma.InputJsonValue,
): Promise<void> {
  await db.auditLog.create({
    data: { actorId, action, entity, entityId: entityId ?? null, details },
  });
}
