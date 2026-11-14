import type { SupabaseClient } from "@supabase/supabase-js"
import type { LiveSnapshot } from "../engine/score"
import type { LiveStatus, LiveTransport } from "./transport"

/**
 * Supabase transport. The scorer calls the publish_score() database function
 * (it checks the phone's secret); viewers read live_matches once and then get
 * every update through Realtime. Only the newest score is ever queued, so a
 * phone that loses signal sends just the current score when it is back.
 */
export function supabaseTransport(db: SupabaseClient): LiveTransport {
  let pending: { snapshot: LiveSnapshot; secret: string } | null = null
  let sending = false
  let retry: ReturnType<typeof setTimeout> | null = null
  let failures = 0
  let status: LiveStatus = "live"
  const listeners = new Set<(s: LiveStatus) => void>()

  const setStatus = (s: LiveStatus) => {
    status = s
    listeners.forEach((l) => l(s))
  }

  const flush = async () => {
    if (sending || !pending) return
    if (retry) {
      clearTimeout(retry)
      retry = null
    }
    sending = true
    const job = pending
    pending = null
    setStatus("sending")
    const { error } = await db.rpc("publish_score", { p_id: job.snapshot.matchId, p_secret: job.secret, p_snapshot: job.snapshot })
    sending = false
    if (error) {
      // A newer score may have arrived meanwhile; keep whichever is newest.
      if (!pending) pending = job
      failures++
      setStatus("offline")
      // "not the scorer" will never succeed; everything else is worth retrying.
      if (!/not the scorer/.test(error.message)) retry = setTimeout(flush, Math.min(30000, 2000 * failures))
      return
    }
    failures = 0
    if (pending) void flush()
    else setStatus("live")
  }

  if (typeof window !== "undefined") window.addEventListener("online", () => void flush())

  return {
    publish(snapshot, secret) {
      pending = { snapshot, secret }
      void flush()
    },
    subscribe(matchId, onSnapshot) {
      let latest = 0
      const take = (s: LiveSnapshot | null | undefined) => {
        if (s && s.updatedAt >= latest) {
          latest = s.updatedAt
          onSnapshot(s)
        }
      }
      const load = () =>
        db
          .from("live_matches")
          .select("snapshot")
          .eq("id", matchId)
          .maybeSingle()
          .then(({ data }) => take(data?.snapshot as LiveSnapshot | undefined))

      const channel = db
        .channel(`live:${matchId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "live_matches", filter: `id=eq.${matchId}` }, (payload) =>
          take((payload.new as { snapshot?: LiveSnapshot }).snapshot),
        )
        .subscribe((s) => {
          // Fetch after (re)connecting so nothing missed while away is lost.
          if (s === "SUBSCRIBED") void load()
        })
      void load()
      // Phones pause background tabs; catch up when the viewer looks again.
      const onVisible = () => document.visibilityState === "visible" && void load()
      document.addEventListener("visibilitychange", onVisible)
      return () => {
        document.removeEventListener("visibilitychange", onVisible)
        void db.removeChannel(channel)
      }
    },
    onStatus(cb) {
      listeners.add(cb)
      cb(status)
      return () => listeners.delete(cb)
    },
  }
}
