import { NextResponse } from "next/server";
import { computeStats } from "@/lib/apiUsage";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(computeStats());
}
