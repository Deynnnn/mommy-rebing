import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** True if `key` is the ADMIN_KEY. */
export function isAdmin(key: string | null | undefined) {
  const expected = process.env.ADMIN_KEY;
  if (!expected || !key) return false;
  return safeEqual(key, expected);
}

/**
 * The value stored in the login cookie: an HMAC derived from ADMIN_KEY, so the key itself is
 * never stored in the browser, and changing ADMIN_KEY signs everyone out.
 */
export function sessionToken() {
  const secret = process.env.ADMIN_KEY;
  if (!secret) return null;
  return createHmac("sha256", secret).update("mommy-rebing-admin-session-v1").digest("hex");
}

function readCookie(req: Request, name: string) {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

/** Admin if the request has a valid login cookie, or the key in an `x-admin-key` header. */
export function isAdminRequest(req: Request) {
  if (isAdmin(req.headers.get("x-admin-key"))) return true;
  const token = sessionToken();
  const cookie = readCookie(req, SESSION_COOKIE);
  return !!token && !!cookie && safeEqual(cookie, token);
}
