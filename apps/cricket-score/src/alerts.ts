import { useEffect, useRef, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { toast } from "sonner"
import { db } from "./live"

/**
 * Group alerts: when a group match starts or finishes, the scorer's app posts an
 * event (table group_events); every other member with the app or site open gets a
 * banner straight away (Supabase Realtime), and a system notification if the browser
 * tab is in the background and they allowed notifications.
 *
 * Not real push: nothing arrives while the app is closed. That needs Firebase (Android)
 * and a paid Apple developer account (iPhone).
 */

export type GroupEventKind = "started" | "finished"

interface GroupEvent {
  group_id: string
  match_id: string
  kind: GroupEventKind
  title: string
  detail: string | null
  created_by: string | null
}

/** Post an event once (the database ignores repeats of the same match + kind). True if it was new. */
export async function postGroupEvent(groupId: string, matchId: string, kind: GroupEventKind, title: string, detail?: string): Promise<boolean> {
  if (!db) return false
  const { data, error } = await db
    .from("group_events")
    .upsert({ group_id: groupId, match_id: matchId, kind, title: title.slice(0, 140), detail: detail?.slice(0, 240) ?? null }, { onConflict: "group_id,match_id,kind", ignoreDuplicates: true })
    .select("match_id")
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export const canNotify = () => !Capacitor.isNativePlatform() && typeof window !== "undefined" && "Notification" in window

export function useNotifyPermission() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(() => (canNotify() ? Notification.permission : "unsupported"))
  const ask = async () => {
    if (!canNotify()) return
    setPerm(await Notification.requestPermission())
  }
  return { perm, ask }
}

/** Listen for other members' match alerts in all the signed-in person's groups. */
export function useGroupAlerts(userId: string | null, groupNames: Record<string, string>) {
  const names = useRef(groupNames)
  names.current = groupNames
  useEffect(() => {
    if (!db || !userId) return
    const client = db
    const channel = client
      .channel(`group-events:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_events" }, (payload) => {
        const e = payload.new as GroupEvent
        if (e.created_by === userId) return
        const group = names.current[e.group_id] ?? "Your group"
        const open = () => {
          location.hash = e.kind === "started" ? `#/live/${e.match_id}` : `#/group/${e.group_id}`
        }
        toast(`${group}: ${e.title}`, {
          description: e.detail ?? undefined,
          duration: 12000,
          action: { label: e.kind === "started" ? "Watch" : "See result", onClick: open },
        })
        if (canNotify() && Notification.permission === "granted" && document.visibilityState === "hidden") {
          const n = new Notification(`${group}: ${e.title}`, { body: e.detail ?? undefined, icon: "/icon-192.png", tag: `${e.match_id}-${e.kind}` })
          n.onclick = () => {
            window.focus()
            open()
            n.close()
          }
        }
      })
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
  }, [userId])
}
