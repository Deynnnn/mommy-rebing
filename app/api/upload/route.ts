import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { posts } from "@/db/schema";
import { storeImage, UploadError } from "@/lib/upload";

export const runtime = "nodejs";

function clean(v: FormDataEntryValue | null, max: number) {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
}

export async function POST(req: Request) {
  const form = await req.formData();
  let key: string;
  try {
    key = await storeImage(form.get("file"), "photos");
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const [row] = await getDb()
    .insert(posts)
    .values({
      imageKey: key,
      name: clean(form.get("name"), 80),
      message: clean(form.get("message"), 500),
    })
    .returning({ id: posts.id });

  return NextResponse.json({ id: row.id });
}
