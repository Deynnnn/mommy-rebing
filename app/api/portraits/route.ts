import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { portraits } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getDb()
    .select({ id: portraits.id })
    .from(portraits)
    .orderBy(asc(portraits.createdAt));
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}
