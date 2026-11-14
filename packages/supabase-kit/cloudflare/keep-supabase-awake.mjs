// Cloudflare Worker version of netlify/keep-supabase-awake.mjs (HUB-OPS-02).
// Supabase's free plan pauses a project after about a week with no activity.
// A cron trigger runs this every two days and makes one tiny database read so
// the project always counts as active.
//
// Settings (wrangler "vars"; the key is the public publishable/anon key the
// web app already ships with, so it is not a secret):
//   SUPABASE_URL  https://<ref>.supabase.co
//   SUPABASE_KEY  sb_publishable_... or the legacy anon key
//   PING_TABLE    any table anon can select from, e.g. live_matches
//
// There is no fetch handler, so the Worker has no public URL to call.
export default {
  async scheduled(_controller, env) {
    const { SUPABASE_URL: url, SUPABASE_KEY: key, PING_TABLE: table } = env
    if (!url || !key || !table) {
      throw new Error("keep-supabase-awake: set SUPABASE_URL, SUPABASE_KEY and PING_TABLE")
    }
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: key },
    })
    console.log(`keep-supabase-awake: Supabase responded ${res.status}`)
    // Throwing marks the cron run as failed in the Cloudflare dashboard.
    if (!res.ok) throw new Error(`keep-supabase-awake: Supabase responded ${res.status}`)
  },
}
