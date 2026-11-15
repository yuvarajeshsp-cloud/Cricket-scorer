# Cricket Score: handover

Live cricket scoring app. Viewers open a link to watch the score live, with no login and no app install. Built from `templates/app` in this hub (React 19, Vite 7, Tailwind 4, Capacitor 8).

- **Branch:** `claude/festive-heisenberg-18rrxr` (all work is pushed; no pull request opened yet)
- **Proof-of-concept link:** https://claude.ai/artifact/6B6SGRwWp3B8BLrZAEF8zB (same-device mode only, because that page can't reach Supabase)

## Status

| Area | State |
|---|---|
| Scoring engine, all screens | Done and tested in a phone-sized browser |
| Player profiles, any-player picks, move or make common across teams, retire not out / retired out | Done |
| WhatsApp share (plain `wa.me` text links, no WhatsApp Business setup) | Done |
| Supabase live broadcast code | Tested against the real project (publish, access rules, Realtime) |
| Supabase project | Created: `cricket-score` in Intasys AI solutions, migration applied |
| Hosting | Live on Cloudflare Pages: https://cricket-score-6k3.pages.dev |
| Android app | Signed release APK downloadable at https://cricket-score-6k3.pages.dev/cricket-score.apk (no Play Store yet) |
| iOS app | Built and signed with the free Apple ID; installed on Rajesh's iPhone via iphone-deployer (replaces BoxBook) |

## Run it

```bash
npm install                         # at the hub root (npm workspaces)
cd apps/cricket-score
cp .env.example .env                # leave empty for same-device mode
npx vite                            # dev server
npx tsc -p tsconfig.json --noEmit   # typecheck
npx vite build
```

Before committing, run the hub checks from `CLAUDE.md`: `npm run typecheck` at the root, then `npx vite build` in `templates/app`.


## How it works

**Event log.** Each innings is a list of events (`src/engine/types.ts`): `ball`, `batter`, `bowler`, `swap`, `retire`. The full scorecard is rebuilt from that list on every change (`computeInnings` / `computeMatch` in `src/engine/score.ts`), so **Undo just removes the last event**. Never store totals.
- **Players** have ids (`Player` in `types.ts`).
- Each `Match` has a `roster` (player id → name at the time), `squads` (team → player ids; a *common* player is in both), and a `secret` that stays on the phone.
- Stats across matches: `src/engine/stats.ts`. WhatsApp texts: `src/engine/share-text.ts`.

**What the engine handles:** strike changes, the end of an over (the same bowler can't bowl two overs in a row), wides, no-balls (with the free hit), byes and leg byes, every way of getting out, retired not out (can return with the same score) and retired out (a wicket), all out (`playersPerSide - 1` wickets), overs used up, the chase, and the result. Ball events sent after an innings is over are ignored (`addEvent` in `App.tsx`).

**Saving on the phone.** `src/store.ts` uses `@rajesh-hub/offline-store` (schema v2). `normalize` upgrades older saved matches that used names instead of ids, and adds a missing `secret`. If storage is blocked, the app keeps everything in memory instead.

**Live sharing.** All of it goes through one interface, `LiveTransport` (`src/live/transport.ts`):
- `src/live/index.ts` picks **Supabase** when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, otherwise the same-device channel (BroadcastChannel plus localStorage).
- `App.tsx` publishes `toSnapshot(match, state)`, a summary of about 1 KB, after every change.
- Viewer pages: `#/live/<matchId>` and `#/overlay/<matchId>` (`src/screens/Viewer.tsx`).
- `src/live/supabase.ts`: the scorer queues only the newest score, retries with backoff and again when the phone comes back online, and reports its status (local / sending / live / offline). The viewer loads the database row, then follows Realtime changes, and loads the row again after reconnecting or when the tab becomes visible.

**Database** (`supabase/migrations/20261114000000_live_matches.sql`):
- `live_matches`: anyone can read it, and it's in the `supabase_realtime` publication.
- `live_match_owners`: holds the SHA-256 hash of each scorer's secret. Nobody can read it.
- `publish_score(p_id, p_secret, p_snapshot)` (security definer) is the only way to write. The first publish claims the match code; later publishes must carry the same secret. It rejects secrets under 32 characters and summaries over 20 KB.

**Screens** (`src/screens`): Home, Setup, Scoring (number pad, plus sheets for extras, wickets, more/retire, and picking the next player), Scorecard, Players and PlayerProfile, Share (QR code, WhatsApp, overlay link, viewer preview). The shared player picker with the cross-team warning is `src/components/PlayerPicker.tsx`.

## Next steps

1. ~~Create the Supabase project.~~ **Done 2026-11-14:** `cricket-score` (ref `lcqmmmblwhcwwwchycpe`, `ap-south-1`) in the **Intasys AI solutions** org (`vnordwtygyhmdpmzwobp`, free plan), at Rajesh's choice. URL `https://lcqmmmblwhcwwwchycpe.supabase.co`.
2. ~~Set up the database.~~ **Done:** migration applied. Security advisors report only expected items: `live_match_owners` has RLS on and no policies (intended, nobody may read it), and `publish_score` is a security definer function that `anon` can call (intended, it is the only write path).
3. ~~Test the access rules.~~ **Done**, as `anon` in SQL and again through supabase-js with the publishable key: first publish claims the match, same secret updates it, a different secret fails with `not the scorer for this match`, a short secret fails with `invalid secret`, direct inserts and reading `live_match_owners` are denied, and a viewer subscription receives each update over Realtime. Test rows removed.
4. ~~Configure the app.~~ **Done** locally: `apps/cricket-score/.env` (git-ignored) has the URL and the `sb_publishable_…` key. Typecheck and build pass.
5. ~~Hosting.~~ **Done on Cloudflare Pages instead of Netlify** (Rajesh's choice): project `cricket-score` in the yuvarajeshsp@gmail.com Cloudflare account, live at **https://cricket-score-6k3.pages.dev** (the plain `cricket-score.pages.dev` name was taken). It is a direct-upload project (no Git connection), so env vars are baked in at build time from `.env`, which now also has `VITE_PUBLIC_URL=https://cricket-score-6k3.pages.dev`. Tested in two browser tabs: the scorer publishes, `#/live/<id>` loads the score and updates live without reloading. Still to do: try it on two real phones. `netlify.toml` is unused now.
   To redeploy (Wrangler 4; run it from a folder that is *not* your home folder, or its `.wrangler` cache folder hides the login):
   ```
   cd apps/cricket-score && npx vite build
   npx wrangler@4 pages deploy dist --project-name cricket-score --branch main
   ```
6. **Keep the project awake.** The hub's keep-awake job (`packages/supabase-kit/netlify`, HUB-OPS-02) is a Netlify function, so it needs a Netlify site, a Cloudflare Worker cron, or another scheduler to run it, so the free project doesn't pause after a week without traffic.
7. **Native apps.** `android/` and `ios/` are Capacitor projects (`com.rajesh.cricketscore`).
   - **Android release signing:** key `Cricket score app/keys/cricket-score-release.jks` with its passwords in `keys/keystore.properties` (outside git). Copy that properties file to `apps/cricket-score/android/keystore.properties` before a release build. **Back up the `keys/` folder**: every future update of the app must be signed with this same key, or phones will refuse to install it over the old one.
   - Build: `npx vite build && npx cap sync android && cd android && ./gradlew assembleRelease` (set `ANDROID_HOME=~/Library/Android/sdk`). Bump `versionCode`/`versionName` in `android/app/build.gradle`, then `npm run release:android` (writes `releases/cricket-score-v<version>.apk`) and push; `/cricket-score.apk` redirects to the newest.
   - **iOS:** free Apple ID (team `5YMC5H7PK6`), so no App Store/TestFlight and each install lasts 7 days. `iphone-deployer` (app id `cricket`, BoxBook turned off) rebuilds and reinstalls it weekly. Only 3 of Rajesh's own apps fit on the iPhone at once.
8. **Later:** delete old `live_matches` rows (for example with pg_cron after 30 days), keep the screen awake while scoring, share the scorecard as an image, saved teams, Play Store / App Store listings, app icon and splash screen, ground (hotspot) mode, tournaments.

## Notes

- **Hub template fix (done):** packages have no tsconfig, so esbuild compiled their `.tsx` with the classic JSX runtime and the page failed with "React is not defined". Fixed with `esbuild: { jsx: "automatic" }` in `templates/app/vite.config.ts` and in this app.
- **Colours:** only hub tokens (`navy`, `brand-blue`, `teal`, `gold`, `destructive`, `accent`, …). The only literal colour is `text-white` on brand-coloured surfaces.
- **Catalogue:** nothing has been added to `CATALOGUE.md`. The scoring engine is cricket-specific. `LiveTransport` has no business words in it, so if a second app needs live sharing, move it into the hub as a package then.
- **Supabase free plan:** about 200 viewers watching at the same time per project. If that's ever exceeded, the options are the Pro plan or adding an MQTT transport behind the same interface.
- **Single-file preview build:** the proof-of-concept link was made with `vite build --base ./` using `inlineDynamicImports` and `cssCodeSplit: false`, then inlining the JS and CSS into one HTML file (the config was temporary and isn't committed). Viewer links don't work inside claude.ai pages, so the Share screen has an in-app "Viewer preview".
