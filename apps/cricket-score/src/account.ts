import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { db } from "./live"

/** Signing in is only possible when the app has a Supabase project (not in same-device mode). */
export const canSignIn = Boolean(db)

/** The signed-in scorer's session; undefined while it is still being read from storage. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(db ? undefined : null)
  useEffect(() => {
    if (!db) return
    let alive = true
    void db.auth.getSession().then(({ data }) => alive && setSession(data.session))
    const { data } = db.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])
  return session
}

/** Where the link in the email lands: the website (the phone apps use the code instead). */
function siteUrl(): string {
  const site = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, "")
  return site || `${location.origin}${location.pathname}`
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

/** Email a sign-in code (and link). Creates the account on first use. */
export async function sendSignInEmail(email: string): Promise<void> {
  if (!db) throw new Error("Sign-in isn't available in this version.")
  const { error } = await db.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: siteUrl() },
  })
  if (error) throw new Error(friendly(error.message, error.status))
}

export async function verifyCode(email: string, code: string): Promise<void> {
  if (!db) throw new Error("Sign-in isn't available in this version.")
  const { error } = await db.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" })
  if (error) throw new Error(friendly(error.message, error.status))
}

export async function signOut(): Promise<void> {
  // "local": only this phone; the scorer stays signed in on their other phones.
  await db?.auth.signOut({ scope: "local" })
}

function friendly(message: string, status?: number): string {
  const m = message.toLowerCase()
  if (status === 429 || m.includes("rate limit") || m.includes("security purposes"))
    return "Too many emails just now. Wait a minute, then try again."
  if (m.includes("expired") || m.includes("invalid") || m.includes("token")) return "That code is wrong or has expired. Check the latest email, or send a new code."
  if (m.includes("sending") || m.includes("smtp") || m.includes("email")) return `Couldn't send the email: ${message}`
  if (m.includes("fetch") || m.includes("network")) return "No internet connection. Try again when you're online."
  return message
}
