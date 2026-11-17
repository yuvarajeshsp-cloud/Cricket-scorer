import { useCallback, useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { db } from "./live"

/** The signed-in person's own details (table profiles). Name + phone are asked once, on first sign-in. */
export interface Profile {
  name: string
  phone: string
  email: string | null
}

/** Keep digits and a leading +, e.g. "+91 98765-43210" → "+919876543210". */
export const cleanPhone = (s: string) => s.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "").slice(0, 20)

/** Compare phone numbers by their last 10 digits, so "+91 98765 43210" matches "9876543210". */
export const phoneKey = (s: string | null | undefined) => (s ? s.replace(/\D/g, "").slice(-10) : "")

export const validPhone = (s: string) => /^\+?[\d\s-]{6,16}$/.test(s.trim()) && s.replace(/\D/g, "").length >= 6

/** Name from the sign-in provider (Google gives full_name / name). */
export function providerName(session: Session | null | undefined): string {
  const m = (session?.user.user_metadata ?? {}) as Record<string, unknown>
  return String(m.full_name ?? m.name ?? "").trim()
}

export async function loadProfile(userId: string): Promise<Profile | null> {
  if (!db) return null
  const { data, error } = await db.from("profiles").select("name, phone, email").eq("id", userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? { name: data.name, phone: data.phone, email: data.email } : null
}

export async function saveProfile(userId: string, p: { name: string; phone: string; email: string | null }): Promise<Profile> {
  if (!db) throw new Error("Profiles need the online version of the app.")
  const row = { id: userId, name: p.name.trim(), phone: cleanPhone(p.phone), email: p.email, updated_at: new Date().toISOString() }
  const { data, error } = await db.from("profiles").upsert(row, { onConflict: "id" }).select("name, phone, email").single()
  if (error) throw new Error(/fetch|network/i.test(error.message) ? "No internet connection. Try again when you're online." : error.message)
  return { name: data.name, phone: data.phone, email: data.email }
}

/** The signed-in person's profile: undefined while loading, null when they haven't filled it in yet. */
export function useProfile(session: Session | null | undefined) {
  const userId = session?.user.id ?? null
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const reload = useCallback(async () => {
    if (!userId) {
      setProfile(undefined)
      return
    }
    try {
      setProfile(await loadProfile(userId))
    } catch {
      // Offline: don't block the app with the "complete your profile" form.
      setProfile((p) => (p === undefined ? undefined : p))
    }
  }, [userId])
  useEffect(() => {
    void reload()
  }, [reload])
  const save = useCallback(
    async (name: string, phone: string) => {
      if (!userId) throw new Error("Sign in first.")
      const p = await saveProfile(userId, { name, phone, email: session?.user.email ?? null })
      setProfile(p)
      return p
    },
    [userId, session?.user.email],
  )
  return { profile, save, reload }
}
