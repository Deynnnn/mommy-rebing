import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Saves the admin's drag-and-drop order. Body: { ids: string[] } in display order.
 * Positions are 1000, 2000, … so they stay below the epoch-ms default given to new uploads,
 * which therefore keep arriving at the end of the list.
 */
export async function POST(req: Request) {
  if (!isAdmin(req.headers.get("x-admin-key"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { ids } = (await req.json().catch(() => ({}))) as { ids?: unknown };
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string" && UUID.test(id)) || ids.length > 5000) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (ids.length) {
    const list = sql.join(
      (ids as string[]).map((id) => sql`${id}`),
      sql`, `,
    );
    await getDb().execute(sql`
      update posts p set sort_order = v.ord * 1000
      from unnest(array[${list}]::uuid[]) with ordinality as v(id, ord)
      where p.id = v.id`);
  }
  return NextResponse.json({ ok: true });
}
