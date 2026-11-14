import { useCallback, useEffect, useState } from "react"
import type { Match, Player } from "./engine/types"
import { db } from "./live"
import { newId } from "./store"

/**
 * Groups of people who play together (Supabase tables groups, group_members,
 * group_players, group_matches; rules in supabase/migrations/*_groups.sql).
 * Members see all the group's matches, live or finished, and every player in it.
 */

export interface Group {
  id: string
  name: string
  inviteCode: string
  role: "admin" | "member"
}

export interface GroupPlayer {
  id: string
  name: string
  phone: string | null
  /** The member account that said "this is me". */
  userId: string | null
}

export interface GroupMatch {
  id: string
  data: Match
  updatedAt: string
}

function need() {
  if (!db) throw new Error("Groups need the online version of the app.")
  return db
}

function fail(error: { message: string } | null) {
  if (!error) return
  const m = error.message.toLowerCase()
  if (m.includes("fetch") || m.includes("network")) throw new Error("No internet connection. Try again when you're online.")
  throw new Error(error.message)
}

export function inviteUrl(code: string): string {
  const site = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, "")
  return site ? `${site}/join/${code}` : `${location.origin}${location.pathname}#/join/${code}`
}

export async function myGroups(userId: string): Promise<Group[]> {
  const { data, error } = await need()
    .from("group_members")
    .select("role, groups(id, name, invite_code)")
    .eq("user_id", userId)
  fail(error)
  return (data ?? [])
    .map((r) => {
      const g = (Array.isArray(r.groups) ? r.groups[0] : r.groups) as { id: string; name: string; invite_code: string } | null
      return g ? { id: g.id, name: g.name, inviteCode: g.invite_code, role: r.role as Group["role"] } : null
    })
    .filter((g): g is Group => g !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createGroup(name: string): Promise<Group> {
  const { data, error } = await need().rpc("create_group", { p_name: name.trim() })
  fail(error)
  const g = data as { id: string; name: string; invite_code: string }
  return { id: g.id, name: g.name, inviteCode: g.invite_code, role: "admin" }
}

export async function renameGroup(id: string, name: string) {
  const { error } = await need().from("groups").update({ name: name.trim() }).eq("id", id)
  fail(error)
}

export async function deleteGroup(id: string) {
  const { error } = await need().from("groups").delete().eq("id", id)
  fail(error)
}

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await need().from("group_members").delete().eq("group_id", groupId).eq("user_id", userId)
  fail(error)
}

export async function resetInvite(groupId: string): Promise<string> {
  const { data, error } = await need().rpc("reset_group_invite", { p_group: groupId })
  fail(error)
  return data as string
}

/** Group name for an invite code (works before signing in). Null if the link is wrong. */
export async function groupForInvite(code: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await need().rpc("group_for_invite", { p_code: code })
  fail(error)
  return ((data as { id: string; name: string }[]) ?? [])[0] ?? null
}

export async function joinGroup(code: string): Promise<{ id: string; name: string }> {
  const { data, error } = await need().rpc("join_group", { p_code: code })
  if (error && /not valid/i.test(error.message)) throw new Error("This invite link isn't valid any more. Ask for a new one.")
  fail(error)
  return data as { id: string; name: string }
}

export async function memberCount(groupId: string): Promise<number> {
  const { count, error } = await need().from("group_members").select("user_id", { count: "exact", head: true }).eq("group_id", groupId)
  fail(error)
  return count ?? 0
}

export async function groupPlayers(groupId: string): Promise<GroupPlayer[]> {
  const { data, error } = await need().from("group_players").select("id, name, phone, user_id").eq("group_id", groupId).order("name")
  fail(error)
  return (data ?? []).map(toPlayer)
}

export const cleanPhone = (s: string) => s.replace(/[^\d+]/g, "").slice(0, 20)

const toPlayer = (p: { id: string; name: string; phone: string | null; user_id: string | null }): GroupPlayer => ({ id: p.id, name: p.name, phone: p.phone, userId: p.user_id })

/** Add a new player (name and phone) to a group. */
export async function addGroupPlayer(groupId: string, name: string, phone: string): Promise<GroupPlayer> {
  const { data, error } = await need()
    .from("group_players")
    .insert({ group_id: groupId, id: newId(), name: name.trim(), phone: cleanPhone(phone) || null })
    .select("id, name, phone, user_id")
    .single()
  fail(error)
  return toPlayer(data!)
}

/** Change a group player's name or phone. (Members can't change who a player is linked to.) */
export async function updateGroupPlayer(groupId: string, id: string, name: string, phone: string): Promise<GroupPlayer> {
  const { data, error } = await need()
    .from("group_players")
    .update({ name: name.trim(), phone: cleanPhone(phone) || null, updated_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("id", id)
    .select("id, name, phone, user_id")
    .single()
  fail(error)
  return toPlayer(data!)
}

/** Add players the group doesn't have yet (by id); never overwrites names or phones already there. */
export async function addMissingGroupPlayers(groupId: string, players: Pick<Player, "id" | "name">[]) {
  if (!db || !players.length) return
  const rows = players.map((p) => ({ group_id: groupId, id: p.id, name: p.name.trim() || "Player", updated_at: new Date().toISOString() }))
  const { error } = await db.from("group_players").upsert(rows, { onConflict: "group_id,id", ignoreDuplicates: true })
  fail(error)
}

export async function removeGroupPlayer(groupId: string, id: string) {
  const { error } = await need().from("group_players").delete().eq("group_id", groupId).eq("id", id)
  fail(error)
}

export async function claimPlayer(groupId: string, playerId: string) {
  const { error } = await need().rpc("claim_group_player", { p_group: groupId, p_player: playerId })
  if (error && /already linked/i.test(error.message)) throw new Error("Someone else has already said this player is them.")
  fail(error)
}

export async function groupMatches(groupId: string): Promise<GroupMatch[]> {
  const { data, error } = await need().from("group_matches").select("id, data, updated_at").eq("group_id", groupId).order("updated_at", { ascending: false })
  fail(error)
  return (data ?? []).map((r) => ({ id: r.id, data: r.data as Match, updatedAt: r.updated_at }))
}

export async function deleteGroupMatch(groupId: string, id: string) {
  const { error } = await need().from("group_matches").delete().eq("group_id", groupId).eq("id", id)
  fail(error)
}

/** The signed-in member's groups, reloaded on demand. */
export function useMyGroups(userId: string | null) {
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    if (!userId || !db) {
      setGroups(userId ? [] : null)
      return
    }
    try {
      setGroups(await myGroups(userId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [userId])
  useEffect(() => {
    void reload()
    const onVisible = () => document.visibilityState === "visible" && void reload()
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [reload])
  return { groups, error, reload }
}

/** Everything shown on a group's page: players and matches, refreshed while open (live scores change). */
export function useGroupData(groupId: string | null) {
  const [players, setPlayers] = useState<GroupPlayer[] | null>(null)
  const [matches, setMatches] = useState<GroupMatch[] | null>(null)
  const [members, setMembers] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    if (!groupId) return
    try {
      const [p, m, c] = await Promise.all([groupPlayers(groupId), groupMatches(groupId), memberCount(groupId)])
      setPlayers(p)
      setMatches(m)
      setMembers(c)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [groupId])
  useEffect(() => {
    setPlayers(null)
    setMatches(null)
    void reload()
    const t = setInterval(() => document.visibilityState === "visible" && void reload(), 20000)
    const onVisible = () => document.visibilityState === "visible" && void reload()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [reload])
  return { players, matches, members, error, reload, setPlayers }
}

export const asPlayer = (p: GroupPlayer): Player => ({ id: p.id, name: p.name, createdAt: "" })
