# Cricket Scorer

Live cricket scoring. One phone scores; anyone with the link watches the score update live, with no login and no install.

- **Website:** https://cricket-score-6k3.pages.dev
- **Android app:** https://cricket-score-6k3.pages.dev/cricket-score.apk
- **App code:** [`apps/cricket-score`](apps/cricket-score) (React 19, Vite 7, Tailwind 4, Capacitor 8, Supabase Realtime). Its [HANDOVER.md](apps/cricket-score/HANDOVER.md) explains how it works and how to release.
- **`packages/`** are copies of the shared parts from the `rajesh-hub` repo (UI kit, brand tokens, on-device storage, native helpers, Supabase client). Change them in `rajesh-hub` first, then copy them here.

## Run it

```bash
npm install
cp apps/cricket-score/.env.example apps/cricket-score/.env   # add the Supabase URL and publishable key
npm run dev
```

`npm run build` writes the site to `apps/cricket-score/dist`.

## Deploying

Every push to `main` builds the site and deploys it to the Cloudflare Pages project `cricket-score` (see `.github/workflows/deploy.yml`).
The Android APK is not built in CI (it needs the private signing key); after a release build, copy `app-release.apk` to `apps/cricket-score/public/cricket-score.apk` and push.
