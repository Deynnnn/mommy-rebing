import { NextResponse } from "next/server";
import { isAdmin, isAdminRequest, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Is this browser signed in? */
export async function GET(req: Request) {
  const ok = isAdminRequest(req);
  return NextResponse.json({ ok }, { status: ok ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}

/** Sign in with the admin key; sets a 30-day httpOnly cookie. */
export async function POST(req: Request) {
  const { key } = (await req.json().catch(() => ({}))) as { key?: string };
  const token = sessionToken();
  if (!token || !isAdmin(key)) {
    return NextResponse.json({ error: "Wrong admin key." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

/** Sign out. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
