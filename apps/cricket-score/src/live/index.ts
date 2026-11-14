import { createHubClient } from "@rajesh-hub/supabase-kit"
import { localTransport, type LiveTransport } from "./transport"
import { supabaseTransport } from "./supabase"

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when a Supabase project is set, so the score goes out over the internet. */
export const isOnline = Boolean(url && key)

// No logins in this app: nothing to keep in the session.
const db = isOnline ? createHubClient(url!, key!, { passkeys: false }) : null

export const live: LiveTransport = db ? supabaseTransport(db) : localTransport

/** Where viewers open the score. Set VITE_PUBLIC_URL to the deployed site so links shared from the phone app work. */
export function liveUrl(matchId: string, kind: "live" | "overlay" = "live") {
  const site = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, "")
  // A real path (not #/live/...) so Android can hand the link to the installed app (App Links).
  if (site) return `${site}/${kind}/${matchId}`
  return `${location.origin}${location.pathname}#/${kind}/${matchId}`
}

export function newSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export const STATUS_TEXT: Record<import("./transport").LiveStatus, string> = {
  local: "This device only",
  sending: "Sending…",
  live: "Live · viewers up to date",
  offline: "No signal · will send when back",
}
