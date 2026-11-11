import { ZipArchive } from "archiver";
import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { PassThrough, Readable } from "node:stream";
import { getDb } from "@/db";
import { posts } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { getObjectStream } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(v: unknown) {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function safe(s: string | null) {
  return (s || "guest").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 40) || "guest";
}

// Admin key comes as ?key= so the browser can download via a plain link.
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!isAdmin(key)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getDb().select().from(posts).orderBy(asc(posts.sortOrder), asc(posts.createdAt));

  const zip = new ZipArchive({ zlib: { level: 0 } });
  const out = new PassThrough();
  zip.pipe(out);

  (async () => {
    const lines = [["#", "file", "type", "name", "message", "uploaded_at", "hidden"].map(csv).join(",")];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const ext = r.imageKey.split(".").pop() || "jpg";
      const file = `media/${String(i + 1).padStart(4, "0")}-${safe(r.name)}.${ext}`;
      try {
        const body = await getObjectStream(r.imageKey);
        zip.append(body, { name: file, date: r.createdAt });
        await new Promise<void>((res) => body.once("end", () => res()).once("error", () => res()));
      } catch {
        // skip missing objects
      }
      lines.push(
        [i + 1, file, r.mediaType, r.name, r.message, r.createdAt.toISOString(), r.hidden].map(csv).join(","),
      );
    }
    zip.append("﻿" + lines.join("\r\n"), { name: "messages.csv" });
    await zip.finalize();
  })().catch((err) => out.destroy(err));

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(Readable.toWeb(out) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="memories-${stamp}.zip"`,
    },
  });
}
