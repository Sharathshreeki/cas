import { connection } from "next/server";
import { db } from "@/lib/db";

// GET /api/health — liveness and database connectivity, for deployment checks.
export async function GET() {
  await connection();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "ok" });
  } catch (error) {
    // Logged server-side only (visible in hosting logs); credentials are masked.
    const message = error instanceof Error ? error.message : String(error);
    console.error("Health check: database unavailable:", message.replace(/\/\/[^@\s]+@/g, "//***@"));
    return Response.json({ status: "degraded", database: "unavailable" }, { status: 503 });
  }
}
