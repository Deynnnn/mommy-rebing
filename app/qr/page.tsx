"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Candle } from "@/components/Candle";
import { tribute } from "@/lib/tribute";

export default function QrCard() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    setUrl(`${base.replace(/\/$/, "")}/share`);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-10 text-center">
      <div className="w-full max-w-md rounded-3xl border-2 border-gold-soft px-8 py-10">
        <Candle className="mx-auto h-12 w-8" />
        <p className="mt-4 text-xs uppercase tracking-[0.3em] text-muted">In Loving Memory of</p>
        <h1 className="mt-2 font-serif text-4xl">{tribute.nickname}</h1>
        <p className="mt-6 font-serif text-2xl">Share your photos &amp; memories</p>
        <p className="text-sm text-muted">Magbahagi ng larawan at alaala</p>
        <div className="mx-auto mt-6 w-fit rounded-xl bg-white p-3 ring-1 ring-line">
          {url && <QRCodeSVG value={url} size={240} level="M" />}
        </div>
        <p className="mt-4 text-sm text-muted">Open your phone camera and point it at the code</p>
        <p className="mt-2 break-all text-xs text-muted">{url}</p>
      </div>
      <button
        onClick={() => window.print()}
        className="no-print mt-8 rounded-full bg-ink px-6 py-3 text-cream"
      >
        Print this card
      </button>
    </main>
  );
}
