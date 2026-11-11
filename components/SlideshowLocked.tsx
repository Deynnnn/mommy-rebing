import Link from "next/link";
import { Candle } from "@/components/Candle";
import { tribute } from "@/lib/tribute";

/** Shown on /slideshow when the family has turned public viewing off. */
export function SlideshowLocked() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0d0b09] px-6 text-center text-white">
      <Candle className="h-14 w-8" />
      <h1 className="mt-5 font-serif text-4xl">In Loving Memory of {tribute.nickname}</h1>
      <p className="mt-3 max-w-md text-white/70">
        The slideshow is only shown at the venue right now. You can still see everyone&apos;s photos and videos, and
        share your own.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-full bg-white px-6 py-3 font-medium text-[#2f2a24]">
          See shared memories
        </Link>
        <Link href="/share" className="rounded-full border border-white/40 px-6 py-3">
          Share a photo or video
        </Link>
      </div>
      <Link href="/admin" className="mt-10 text-xs text-white/40 underline underline-offset-4">
        Family: sign in to show the slideshow on this device
      </Link>
    </main>
  );
}
