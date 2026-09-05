import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Simple in-memory rate limiter for login attempts per IP
const attempts = new Map<string, { count: number; resetAt: number }>();

function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(req: NextRequest): boolean {
  const ip = getIp(req);
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now >= entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(req)) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }

  let body: { password?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const password = typeof body.password === "string" ? body.password : "";

  const expected = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN || "";
  if (!expected) {
    return NextResponse.json({ error: "Admin not configured. Set ADMIN_PASSWORD in .env (no default in production)" }, { status: 503 });
  }
  if (password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // 2FA: TOTP Authenticator (Google Authenticator/Authy) — ADMIN_EMAIL stays as audit/allowlist only, not gate
  const totpSecret = process.env.TOTP_SECRET;
  const bodyTotp = typeof (body as { totp?: unknown }).totp === "string" ? (body as { totp: string }).totp.trim() : "";

  if (totpSecret) {
    if (!bodyTotp || !/^\d{6}$/.test(bodyTotp)) {
      return NextResponse.json({ error: "Authenticator code required", needTotp: true }, { status: 401 });
    }
    try {
      // @ts-ignore - otpauth types are ESM, dynamic import is fine at runtime
      const { TOTP } = await import("otpauth");
      const totp = new TOTP({ secret: totpSecret, digits: 6, period: 30, algorithm: "SHA1" });
      const delta = totp.validate({ token: bodyTotp, window: 1 });
      if (delta === null) return NextResponse.json({ error: "Invalid authenticator code" }, { status: 401 });
    } catch {
      return NextResponse.json({ error: "Failed to verify code" }, { status: 401 });
    }
  }

  // Issue a simple token — store in httpOnly cookie for server checks, also return ok for client sessionStorage
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
