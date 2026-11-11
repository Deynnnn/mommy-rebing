# In Loving Memory: photo sharing for the last night

Guests scan a QR code, upload photos with a message, and the photos appear live on the TV slideshow.

| Page | Who | What |
|---|---|---|
| `/` | everyone | Tribute and the gallery of shared photos |
| `/share` | guests (QR code) | Upload photos, name, message |
| `/slideshow` | TV laptop | Fullscreen live slideshow with a QR code in the corner |
| `/qr` | print | QR card to place at the venue |
| `/admin?key=ADMIN_KEY` | family | Hide or unhide photos, download everything as a ZIP |

## 1. Fill in Lola's details
- Put her portrait at `public/lola.jpg`.
- Edit `lib/tribute.ts`: name, nickname, dates, story, and set `portrait: "/lola.jpg"`.

## 2. Railway setup
1. Create a Railway project and add **Postgres** and a **Bucket**.
2. Copy `.env.example` to `.env.local` and fill it in:
   - `DATABASE_URL`: Postgres `DATABASE_PUBLIC_URL` (for local), or reference `${{Postgres.DATABASE_URL}}` on Railway.
   - `S3_*`: from the Bucket's credentials (endpoint, region, bucket name, access key, secret).
   - `ADMIN_KEY`: any long secret.
3. Create the table:
   ```bash
   npm run db:push
   ```
4. Test locally with `npm run dev`. Open http://localhost:3000/share and upload a photo.

## 3. Deploy on Railway
1. Push this folder to GitHub, then in Railway choose **New Service, GitHub repo**. You can also deploy with `railway up` from this folder.
2. Add the same variables to the service. Use internal references for Postgres and Bucket where Railway offers them.
3. In **Settings, Networking**, generate a domain. Set `NEXT_PUBLIC_SITE_URL` to it and redeploy, because the QR code uses it at build time.
4. Open `/qr` and print the card. Open `/slideshow` on the TV laptop and click **Toggle fullscreen**.

## Tonight checklist
- [ ] Upload one test photo from a phone on mobile data and from venue Wi-Fi.
- [ ] Slideshow running fullscreen, laptop plugged in, sleep disabled.
- [ ] Admin link saved on a family member's phone.
- [ ] Backup: a shared Google Photos album, in case the internet fails.
- [ ] Afterwards: `/admin`, then **Download all (ZIP)**.
