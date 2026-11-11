import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { portraits } from "@/db/schema";
import { isAdminRequest } from "@/lib/admin";
import { deleteObject } from "@/lib/s3";
import { storeImage, UploadError } from "@/lib/upload";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const form = await req.formData();
  try {
    const key = await storeImage(form.get("file"), "portraits");
    const [row] = await getDb().insert(portraits).values({ imageKey: key }).returning({ id: portraits.id });
    return NextResponse.json({ id: row.id });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function DELETE(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const [row] = await getDb().delete(portraits).where(eq(portraits.id, id)).returning();
  if (row) await deleteObject(row.imageKey).catch(() => {});
  return NextResponse.json({ ok: true });
}
