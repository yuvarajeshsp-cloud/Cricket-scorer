import { useCallback, useEffect, useRef, useState } from "react"
import type { Match, Player } from "./engine/types"
import type { AppData, Tombstone } from "./store"
import { db } from "./live"

/**
 * Keeps a signed-in scorer's matches and players the same on all their phones.
 *
 * The phone's own file stays the source the app reads (scoring works offline);
 * this copies changes up to Supabase and pulls in changes made on other phones.
 * Each match / player is one row. When two phones changed the same record, the
 * newer `updatedAt` wins. Deletes travel as tombstones.
 */

type Kind = Tombstone["kind"]
const TABLE: Record<Kind, "scorer_matches" | "scorer_players"> = { match: "scorer_matches", player: "scorer_players" }
const TOMBSTONE_DAYS = 120

interface Row {
  id: string
  data: Match | Player | null
  updated_at: string
  deleted: boolean
}

const ms = (iso?: string | null) => (iso ? new Date(iso).getTime() || 0 : 0)
const recordTime = (r: Match | Player) => ms(r.updatedAt) || ms(r.createdAt)

/**
 * Stamp what a local change touched: new or changed matches/players get updatedAt = now,
 * removed ones get a tombstone, and re-added ones lose theirs. The scoring code returns
 * the same object for anything it didn't change, so identity tells us what changed.
 */
export function stamp(prev: AppData, next: AppData): AppData {
  if (prev === next) return next
  const now = new Date().toISOString()
  const touch = <T extends Match | Player>(before: T[], after: T[]): T[] => {
    const old = new Map(before.map((x) => [x.id, x]))
    return after.map((x) => (old.get(x.id) === x ? x : { ...x, updatedAt: now }))
  }
  const matches = next.matches === prev.matches ? next.matches : touch(prev.matches, next.matches)
  const players = next.players === prev.players ? next.players : touch(prev.players, next.players)

  let tombstones = next.tombstones
  const gone = (kind: Kind, before: { id: string }[], after: { id: string }[]) => {
    const still = new Set(after.map((x) => x.id))
    for (const x of before) if (!still.has(x.id)) tombstones = [...tombstones.filter((t) => !(t.kind === kind && t.id === x.id)), { kind, id: x.id, at: now }]
    const live = new Set(after.map((x) => `${kind}:${x.id}`))
    if (tombstones.some((t) => live.has(`${t.kind}:${t.id}`))) tombstones = tombstones.filter((t) => !live.has(`${t.kind}:${t.id}`))
  }
  if (matches !== prev.matches) gone("match", prev.matches, matches)
  if (players !== prev.players) gone("player", prev.players, players)

  if (matches === next.matches && players === next.players && tombstones === next.tombstones) return next
  return { ...next, matches, players, tombstones }
}

/** Fold rows from the server into local data. Only rows newer than the local copy change anything. */
export function applyRemote(local: AppData, kind: Kind, rows: Row[]): AppData {
  const key = kind === "match" ? "matches" : "players"
  const list = local[key] as (Match | Player)[]
  const byId = new Map(list.map((x) => [x.id, x]))
  const tombs = new Map(local.tombstones.filter((t) => t.kind === kind).map((t) => [t.id, t]))
  let records = list
  let tombstones = local.tombstones
  for (const row of rows) {
    const remoteAt = ms(row.updated_at)
    const mine = byId.get(row.id)
    const localAt = mine ? recordTime(mine) : ms(tombs.get(row.id)?.at)
    if (remoteAt <= localAt) continue
    if (row.deleted) {
      if (mine) records = records.filter((x) => x.id !== row.id)
      tombstones = [...tombstones.filter((t) => !(t.kind === kind && t.id === row.id)), { kind, id: row.id, at: row.updated_at }]
    } else if (row.data) {
      const incoming = { ...row.data, updatedAt: new Date(remoteAt).toISOString() } as Match & Player
      records = mine ? records.map((x) => (x.id === row.id ? incoming : x)) : [...records, incoming]
      tombstones = tombstones.filter((t) => !(t.kind === kind && t.id === row.id))
    }
  }
  if (records === list && tombstones === local.tombstones) return local
  const out = { ...local, [key]: records, tombstones }
  if (kind === "match" && out.currentId && !out.matches.some((m) => m.id === out.currentId)) out.currentId = null
  return out
}

/** Local records and deletes newer than what the server is known to have. */
function pending(data: AppData, synced: Map<string, number>): Record<Kind, Row[]> {
  const out: Record<Kind, Row[]> = { match: [], player: [] }
  const add = (kind: Kind, r: Match | Player) => {
    const at = recordTime(r)
    if (at > (synced.get(`${kind}:${r.id}`) ?? -1)) out[kind].push({ id: r.id, data: r, updated_at: new Date(at || Date.now()).toISOString(), deleted: false })
  }
  data.matches.forEach((m) => add("match", m))
  data.players.forEach((p) => add("player", p))
  for (const t of data.tombstones) {
    if (ms(t.at) > (synced.get(`${t.kind}:${t.id}`) ?? -1)) out[t.kind].push({ id: t.id, data: null, updated_at: t.at, deleted: true })
  }
  return out
}

export function pruneTombstones(d: AppData): AppData {
  const cutoff = Date.now() - TOMBSTONE_DAYS * 864e5
  const kept = d.tombstones.filter((t) => ms(t.at) > cutoff)
  return kept.length === d.tombstones.length ? d : { ...d, tombstones: kept }
}

export type SyncStatus = "off" | "syncing" | "synced" | "offline" | "error"

/**
 * Wire sync into the scorer app. `rawUpdate` must be the store's own update (not the
 * stamping one), so pulled changes are not re-stamped and sent back.
 */
export function useSync(userId: string | null, data: AppData | null, rawUpdate: (fn: (d: AppData) => AppData) => void) {
  const [status, setStatus] = useState<SyncStatus>("off")
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const synced = useRef(new Map<string, number>())
  const dataRef = useRef(data)
  dataRef.current = data
  const busy = useRef(false)
  const again = useRef(false)

  const push = useCallback(async () => {
    if (!db || !userId || !dataRef.current) return
    const todo = pending(dataRef.current, synced.current)
    for (const kind of ["player", "match"] as Kind[]) {
      const rows = todo[kind]
      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50)
        const { error } = await db.from(TABLE[kind]).upsert(
          chunk.map((r) => ({ user_id: userId, id: r.id, data: r.data, updated_at: r.updated_at, deleted: r.deleted })),
          { onConflict: "user_id,id" },
        )
        if (error) throw error
        for (const r of chunk) synced.current.set(`${kind}:${r.id}`, ms(r.updated_at))
      }
    }
  }, [userId])

  const pull = useCallback(async () => {
    if (!db || !userId) return
    for (const kind of ["player", "match"] as Kind[]) {
      const { data: rows, error } = await db.from(TABLE[kind]).select("id, data, updated_at, deleted").eq("user_id", userId)
      if (error) throw error
      for (const r of rows as Row[]) {
        const at = ms(r.updated_at)
        if (at > (synced.current.get(`${kind}:${r.id}`) ?? -1)) synced.current.set(`${kind}:${r.id}`, at)
      }
      rawUpdate((d) => applyRemote(d, kind, rows as Row[]))
    }
  }, [userId, rawUpdate])

  /** Pull everything, then push whatever this phone has that is newer. */
  const run = useCallback(
    async (withPull: boolean) => {
      if (!db || !userId) return
      if (busy.current) {
        again.current = true
        return
      }
      busy.current = true
      setStatus("syncing")
      try {
        if (withPull) await pull()
        // Let React apply pulled data before working out what to push.
        await new Promise((r) => setTimeout(r, 0))
        await push()
        setStatus("synced")
        setLastSynced(new Date())
        setError(null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
        const offline = typeof navigator !== "undefined" && navigator.onLine === false
        setStatus(offline || /fetch|network/i.test(msg) ? "offline" : "error")
        setError(msg)
      } finally {
        busy.current = false
        if (again.current) {
          again.current = false
          void run(false)
        }
      }
    },
    [userId, pull, push],
  )

  // Signed in (or app opened while signed in): full sync. Signed out: forget what was synced.
  useEffect(() => {
    synced.current = new Map()
    if (!userId) {
      setStatus("off")
      setLastSynced(null)
      return
    }
    void run(true)
    const onOnline = () => void run(true)
    const onVisible = () => document.visibilityState === "visible" && void run(true)
    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("online", onOnline)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [userId, run])

  // Local changes go up a couple of seconds after scoring stops.
  useEffect(() => {
    if (!userId || !data) return
    const t = setTimeout(() => void run(false), 2000)
    return () => clearTimeout(t)
  }, [userId, data, run])

  return { status, lastSynced, error, syncNow: () => run(true) }
}
