import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { posts } from "@/db/schema";
import { presignGet } from "@/lib/s3";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("Not found", { status: 404 });
  const [row] = await getDb()
    .select({ key: posts.imageKey })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });
  const url = await presignGet(row.key, 3600);
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "private, max-age=3000" },
  });
}
