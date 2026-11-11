import { cookies } from "next/headers";
import { Slideshow } from "@/components/Slideshow";
import { SlideshowLocked } from "@/components/SlideshowLocked";
import { isValidSession, SESSION_COOKIE } from "@/lib/admin";
import { readSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** The TV slideshow. When public viewing is off, only signed-in admin devices can open it. */
export default async function SlideshowPage() {
  const isAdmin = isValidSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!isAdmin) {
    // if settings can't be read, fail open so the TV never goes dark mid-wake
    const settings = await readSettings().catch(() => null);
    if (settings && settings.slideshowPublic !== 1) return <SlideshowLocked />;
  }
  return <Slideshow isAdmin={isAdmin} />;
}
