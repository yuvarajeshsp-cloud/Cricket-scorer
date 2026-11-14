import type { LiveSnapshot } from "../engine/score"

export type LiveStatus = "local" | "sending" | "live" | "offline"

/**
 * How the score reaches viewers. The app only talks to this interface, so the
 * same-device channel, Supabase Realtime, MQTT or a hotspot server can be
 * swapped without touching any screen.
 */
export interface LiveTransport {
  /** Send the latest score. `secret` proves this phone is the scorer. */
  publish(snapshot: LiveSnapshot, secret: string): void
  subscribe(matchId: string, onSnapshot: (s: LiveSnapshot) => void): () => void
  /** Scorer side: whether the last score reached viewers. */
  onStatus(cb: (s: LiveStatus) => void): () => void
}

const LAST_KEY = (id: string) => `cricket-live:${id}`

/** Same-device transport (other tabs and windows), used when no Supabase project is set. */
export const localTransport: LiveTransport = {
  publish(snapshot) {
    try {
      localStorage.setItem(LAST_KEY(snapshot.matchId), JSON.stringify(snapshot))
    } catch {
      /* storage blocked: live tabs still get the message */
    }
    try {
      const ch = new BroadcastChannel("cricket-live")
      ch.postMessage(snapshot)
      ch.close()
    } catch {
      /* not supported */
    }
  },
  subscribe(matchId, onSnapshot) {
    try {
      const last = localStorage.getItem(LAST_KEY(matchId))
      if (last) onSnapshot(JSON.parse(last))
    } catch {
      /* nothing stored */
    }
    let ch: BroadcastChannel | null = null
    try {
      ch = new BroadcastChannel("cricket-live")
      ch.onmessage = (e: MessageEvent<LiveSnapshot>) => {
        if (e.data?.matchId === matchId) onSnapshot(e.data)
      }
    } catch {
      /* not supported */
    }
    return () => ch?.close()
  },
  onStatus(cb) {
    cb("local")
    return () => {}
  },
}
