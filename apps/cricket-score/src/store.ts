import { createStore } from "@rajesh-hub/offline-store"
import type { Match, Player } from "./engine/types"
import { newSecret } from "./live"

/** A deleted match or player, remembered so the delete also reaches the scorer's other phones. */
export interface Tombstone {
  kind: "match" | "player"
  id: string
  at: string
}

export interface AppData {
  players: Player[]
  matches: Match[]
  currentId: string | null
  tombstones: Tombstone[]
}

const empty = (): AppData => ({ players: [], matches: [], currentId: null, tombstones: [] })

/** Matches saved before players had ids used names directly; keep them readable. */
function upgradeMatch(raw: Match): Match {
  if (raw.roster) return raw
  const roster: Record<string, string> = {}
  const touch = (n: string) => ((roster[n] = n), n)
  const legacy = raw as unknown as { innings: { events: Record<string, unknown>[] }[]; squads: Record<string, string[]> }
  for (const ids of Object.values(legacy.squads ?? {})) ids.forEach(touch)
  return {
    ...raw,
    roster,
    innings: legacy.innings.map((inn) => ({
      ...(inn as unknown as Match["innings"][number]),
      events: inn.events.map((ev) =>
        ev.type === "batter" || ev.type === "bowler" ? { type: ev.type, id: touch(String(ev.name ?? ev.id)) } : ev,
      ) as Match["innings"][number]["events"],
    })),
  }
}

function normalize(raw: unknown): AppData {
  const d = (raw ?? {}) as Partial<AppData>
  return {
    players: Array.isArray(d.players) ? d.players : [],
    matches: Array.isArray(d.matches) ? d.matches.map(upgradeMatch).map((m) => (m.secret ? m : { ...m, secret: newSecret() })) : [],
    currentId: typeof d.currentId === "string" ? d.currentId : null,
    tombstones: Array.isArray(d.tombstones) ? d.tombstones : [],
  }
}

const fileStore = createStore<AppData>({
  schemaVersion: 2,
  name: "matches",
  defaults: empty,
  normalize,
})

// If on-device storage is blocked (private window, embedded preview), keep
// scoring in memory rather than showing a blank screen.
export const store: typeof fileStore = {
  ...fileStore,
  load: () => fileStore.load().catch(empty),
  save: (d) => fileStore.save(d).catch(() => undefined),
}

export function newId(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"
  let id = ""
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  for (const b of bytes) id += chars[b % chars.length]
  return id
}

export function newPlayer(name: string, guest = false): Player {
  return { id: newId(), name: name.trim(), createdAt: new Date().toISOString(), ...(guest ? { guest } : {}) }
}

export function vibrate(ms = 12) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* no haptics */
  }
}
