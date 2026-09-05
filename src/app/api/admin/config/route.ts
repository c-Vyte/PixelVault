import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    needTotp: !!process.env.TOTP_SECRET,
  });
}
