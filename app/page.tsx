import { cookies } from "next/headers";
import Link from "next/link";
import { Candle } from "@/components/Candle";
import { Gallery } from "@/components/Gallery";
import { PortraitRotator } from "@/components/PortraitRotator";
import { isValidSession, SESSION_COOKIE } from "@/lib/admin";
import { readSettings } from "@/lib/settings";
import { tribute } from "@/lib/tribute";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Only offer the slideshow to people who can open it (same rule as /slideshow).
  const isAdmin = isValidSession((await cookies()).get(SESSION_COOKIE)?.value);
  const settings = isAdmin ? null : await readSettings().catch(() => null);
  const canWatch = isAdmin || !settings || settings.slideshowPublic === 1;

  return (
    <main className="min-h-dvh">
      <section className="mx-auto flex max-w-2xl flex-col items-center px-5 pb-10 pt-12 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">In Loving Memory</p>
        <div className="mt-6 rounded-full border border-gold-soft bg-paper p-2 shadow-sm">
          <PortraitRotator className="h-44 w-44 sm:h-56 sm:w-56" />
        </div>
        <h1 className="mt-6 font-serif text-4xl font-medium leading-tight sm:text-5xl">
          {tribute.name}
        </h1>
        <p className="mt-1 font-serif text-xl italic text-gold">“{tribute.nickname}”</p>
        <p className="mt-2 text-sm tracking-wide text-muted">
          {tribute.born} &nbsp;—&nbsp; {tribute.died}
        </p>
        <div className="mt-6 space-y-3 font-serif text-lg leading-relaxed text-ink/85">
          {tribute.story.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <p className="mt-5 font-serif text-base italic text-muted">{tribute.verse}</p>

        <Link
          href="/share"
          className="mt-9 inline-flex items-center gap-3 rounded-full bg-ink px-8 py-4 text-base font-medium text-cream shadow-md transition active:scale-[0.98]"
        >
          <Candle className="h-6 w-4" />
          Share a photo &amp; memory
        </Link>
        <p className="mt-2 text-sm text-muted">Magbahagi ng larawan at alaala</p>

        {canWatch && (
          <Link
            href="/slideshow"
            className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-ink/25 bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:border-ink/50 active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
            </svg>
            Watch the slideshow
          </Link>
        )}
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="mb-5 flex items-center gap-4">
          <span className="h-px flex-1 bg-line" />
          <h2 className="font-serif text-2xl">Shared memories</h2>
          <span className="h-px flex-1 bg-line" />
        </div>
        <Gallery />
      </section>
    </main>
  );
}
