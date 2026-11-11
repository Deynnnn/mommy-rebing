"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { tribute } from "@/lib/tribute";

const W = 1080;
const H = 1920;
const FILE_NAME = "mommy-rebing-story.png";

const COLORS = { cream: "#faf6ef", sand: "#efe4d0", ink: "#2f2a24", muted: "#7a7064", gold: "#a8874f" };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** First family-uploaded portrait (same-origin bytes so it can be drawn), else the static portrait. */
async function portraitSrc() {
  try {
    const rows = (await (await fetch("/api/portraits", { cache: "no-store" })).json()) as { id: string }[];
    if (rows.length) return `/api/portraits/${rows[0].id}?raw=1`;
  } catch {}
  return tribute.portrait;
}

/** Writes `text` centred at y, shrinking the font until it fits maxWidth. */
function fitText(ctx: CanvasRenderingContext2D, text: string, y: number, font: (px: number) => string, px: number, maxWidth: number) {
  let size = px;
  ctx.font = font(size);
  while (ctx.measureText(text).width > maxWidth && size > 20) {
    size -= 2;
    ctx.font = font(size);
  }
  ctx.fillText(text, W / 2, y);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function drawStory(qr: HTMLCanvasElement, url: string, serif: string, sans: string) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // background + frame
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, COLORS.cream);
  bg.addColorStop(1, COLORS.sand);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(168,135,79,0.45)";
  ctx.lineWidth = 3;
  roundRect(ctx, 48, 48, W - 96, H - 96, 36);
  ctx.stroke();

  // heading
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 32px ${sans}`;
  ctx.fillText("I N   L O V I N G   M E M O R Y", W / 2, 190);

  // portrait
  const cx = W / 2;
  const cy = 500;
  const r = 230;
  try {
    const img = await loadImage(await portraitSrc());
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const s = Math.max((r * 2) / img.width, (r * 2) / img.height);
    ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
    ctx.restore();
  } catch {
    ctx.fillStyle = "#e7dfd2";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
  ctx.stroke();

  // name, nickname, dates
  ctx.fillStyle = COLORS.ink;
  fitText(ctx, tribute.name, 860, (px) => `500 ${px}px ${serif}`, 84, W - 180);
  ctx.fillStyle = COLORS.gold;
  fitText(ctx, `“${tribute.nickname}”`, 940, (px) => `italic 500 ${px}px ${serif}`, 60, W - 180);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `36px ${sans}`;
  ctx.fillText(`${tribute.born}  —  ${tribute.died}`, W / 2, 1005);

  // divider
  ctx.strokeStyle = "rgba(168,135,79,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 160, 1060);
  ctx.lineTo(W / 2 + 160, 1060);
  ctx.stroke();

  // call to action
  ctx.fillStyle = COLORS.ink;
  fitText(ctx, "Share your photos & videos", 1150, (px) => `500 ${px}px ${serif}`, 64, W - 160);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `34px ${sans}`;
  ctx.fillText("Magbahagi ng larawan at video", W / 2, 1202);

  // QR card
  const size = 470;
  const pad = 30;
  const top = 1250;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(47,42,36,0.15)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, (W - size - pad * 2) / 2, top, size + pad * 2, size + pad * 2, 28);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, (W - size) / 2, top + pad, size, size);
  ctx.imageSmoothingEnabled = true;

  // link
  ctx.fillStyle = COLORS.muted;
  fitText(ctx, url.replace(/^https?:\/\//, ""), top + size + pad * 2 + 70, (px) => `${px}px ${sans}`, 32, W - 160);

  return new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject()), "image/png"));
}

/** Builds an Instagram/Facebook-story image of the QR card and shares or downloads it. */
export function StoryShare({ url }: { url: string }) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const fontRef = useRef<HTMLSpanElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [status, setStatus] = useState("");

  const build = useCallback(async () => {
    if (!qrRef.current || !fontRef.current || !url) return;
    await document.fonts?.ready;
    const serif = getComputedStyle(fontRef.current).fontFamily;
    const sans = getComputedStyle(document.body).fontFamily;
    const blob = await drawStory(qrRef.current, url, serif, sans);
    const f = new File([blob], FILE_NAME, { type: "image/png" });
    setFile(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
    setCanShareFiles(!!navigator.canShare?.({ files: [f] }));
  }, [url]);

  useEffect(() => {
    build().catch(() => setStatus("Could not create the story image."));
  }, [build]);

  function download() {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = FILE_NAME;
    a.click();
  }

  async function share() {
    if (!file) return;
    if (!canShareFiles) {
      download();
      setStatus("Saved the story image. Open Instagram or Facebook and add it to your story.");
      return;
    }
    try {
      // share the image only: Instagram and Facebook ignore extra text when posting to a story
      await navigator.share({ files: [file] });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setStatus("Sharing didn't work here. Use “Save image” instead.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied. In your story, add a Link sticker and paste it.");
    } catch {
      setStatus(url);
    }
  }

  return (
    <section className="no-print mt-8 w-full max-w-md">
      {/* hidden helpers: a crisp QR to draw from, and an element to read the serif font name from */}
      <div className="hidden" aria-hidden>
        {url && <QRCodeCanvas ref={qrRef} value={url} size={470} level="M" marginSize={0} />}
        <span ref={fontRef} className="font-serif" />
      </div>

      <h2 className="font-serif text-2xl">Share to your story</h2>
      <p className="mt-1 text-sm text-muted">
        Post this on Instagram or Facebook Stories so relatives and friends who can&apos;t be there can share too.
      </p>

      <div className="mt-4 flex gap-4">
        <div className="w-28 shrink-0 overflow-hidden rounded-xl border border-line bg-paper shadow-sm">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Story preview" className="w-full" />
          ) : (
            <div className="aspect-[9/16] animate-pulse bg-line" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <button
            onClick={share}
            disabled={!file}
            className="rounded-full bg-gradient-to-r from-[#833ab4] via-[#e1306c] to-[#f77737] px-4 py-3 text-sm font-medium text-white shadow disabled:opacity-50"
          >
            Share to IG / Facebook Story
          </button>
          <button onClick={download} disabled={!preview} className="rounded-full border border-line bg-paper px-4 py-2.5 text-sm disabled:opacity-50">
            Save image
          </button>
          <button onClick={copyLink} className="rounded-full border border-line bg-paper px-4 py-2.5 text-sm">
            Copy link
          </button>
        </div>
      </div>

      {status && <p className="mt-3 break-all text-sm text-muted">{status}</p>}

      <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-muted">
        <li>
          On your phone, tap <b>Share to IG / Facebook Story</b> and choose <b>Instagram Stories</b> or{" "}
          <b>Facebook Stories</b>.
        </li>
        <li>
          Tap <b>Copy link</b>, then in the story add a <b>Link</b> sticker and paste it, so people can tap
          instead of scanning.
        </li>
        <li>On a computer, use <b>Save image</b> and post it from your phone.</li>
      </ol>
    </section>
  );
}
