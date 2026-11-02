import { connection } from "next/server";
import { db } from "@/lib/db";

// GET /api/health — liveness and database connectivity, for deployment checks.
export async function GET() {
  await connection();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "ok" });
  } catch {
    return Response.json({ status: "degraded", database: "unavailable" }, { status: 503 });
  }
}
