import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { portraits } from "@/db/schema";
import { presignGet } from "@/lib/s3";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("Not found", { status: 404 });
  const [row] = await getDb()
    .select({ key: portraits.imageKey })
    .from(portraits)
    .where(eq(portraits.id, id))
    .limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(await presignGet(row.key, 3600), {
    status: 302,
    headers: { "Cache-Control": "private, max-age=3000" },
  });
}
