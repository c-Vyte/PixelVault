import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isAdmin(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN || "";
  const token = req.cookies.get("admin_token")?.value;
  return !!expected && token === expected;
}

// GET /api/admin/totp — returns QR data URL for Authenticator setup (requires admin_token cookie OR ADMIN_PASSWORD not yet set)
// Also returns the manual secret for backup.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const setupToken = url.searchParams.get("setupToken");
  // Allow setup if either already authed, or setupToken matches ADMIN_PASSWORD (one-time bootstrap)
  const adminPw = process.env.ADMIN_PASSWORD || "";
  const isSetupAuth = setupToken && adminPw && setupToken === adminPw;
  if (!isAdmin(req) && !isSetupAuth) {
    return NextResponse.json({ error: "Unauthorized — login first or provide ?setupToken=ADMIN_PASSWORD" }, { status: 401 });
  }
  const secret = process.env.TOTP_SECRET;
  if (!secret) return NextResponse.json({ error: "TOTP_SECRET not set in .env" }, { status: 503 });
  const label = process.env.ADMIN_EMAIL || "PixelVault Admin";
  const issuer = "PixelVault";
  try {
    // @ts-ignore
    const { TOTP, Secret } = await import("otpauth");
    // @ts-ignore
    const { default: QRCode } = await import("qrcode");
    // Validate secret is base32
    const sec = Secret.fromBase32(secret);
    const totp = new TOTP({ secret: sec, label, issuer, digits: 6, period: 30, algorithm: "SHA1" });
    const otpauthUrl = totp.toString(); // otpauth://totp/...
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 300, margin: 1 });
    return NextResponse.json({ otpauthUrl, qrDataUrl, secret, label, issuer });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to generate QR" }, { status: 500 });
  }
}

// POST /api/admin/totp { token: "123456" } — verify a code against current TOTP_SECRET (for setup test)
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    const bodyTmp = await req.json().catch(() => ({}));
    const setupToken = (bodyTmp as { setupToken?: string }).setupToken;
    const adminPw = process.env.ADMIN_PASSWORD || "";
    if (!setupToken || setupToken !== adminPw) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  let body: { token?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const secret = process.env.TOTP_SECRET;
  if (!secret) return NextResponse.json({ error: "TOTP_SECRET not set" }, { status: 503 });
  if (!/^\d{6}$/.test(token)) return NextResponse.json({ error: "Token must be 6 digits" }, { status: 400 });
  try {
    // @ts-ignore
    const { TOTP } = await import("otpauth");
    const totp = new TOTP({ secret, digits: 6, period: 30, algorithm: "SHA1" });
    const delta = totp.validate({ token, window: 1 });
    if (delta === null) return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 401 });
    return NextResponse.json({ ok: true, delta });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Verify failed" }, { status: 500 });
  }
}
