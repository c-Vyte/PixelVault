import { NextResponse } from "next/server";
import { computeStats } from "@/lib/apiUsage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { requireAdminAuth, checkRateLimit } = await import("@/lib/rateLimit");
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = checkRateLimit(req, 30);
  if (!rl.ok) return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  return NextResponse.json(computeStats());
}
