import { useEffect, useState } from "react"
import { createStore } from "@rajesh-hub/offline-store"
import type { LiveSnapshot } from "./engine/score"

/** A match this phone opened from a shared link, so Home can reopen it without the link. */
export interface Watched {
  id: string
  title: string
  /** e.g. "Team A 13/1 (0.3 ov)" */
  score: string
  result?: string
  openedAt: string
}

// Its own file, separate from the scorer's matches, so a viewer can never overwrite scoring data.
const watchStore = createStore<Watched[]>({
  schemaVersion: 1,
  name: "watching",
  defaults: () => [],
  normalize: (raw) => (Array.isArray(raw) ? (raw as Watched[]).filter((w) => w && typeof w.id === "string") : []),
})

const MAX = 30
let cache: Watched[] | null = null
const listeners = new Set<(list: Watched[]) => void>()

async function list(): Promise<Watched[]> {
  if (!cache) cache = await watchStore.load().catch(() => [])
  return cache
}

function set(next: Watched[]) {
  cache = next
  void watchStore.save(next).catch(() => undefined)
  listeners.forEach((l) => l(next))
}

/** Remember (or refresh) a match opened from a link. */
export async function rememberWatched(id: string, snap: LiveSnapshot | null) {
  const current = await list()
  const prev = current.find((w) => w.id === id)
  const entry: Watched = {
    id,
    title: snap?.title ?? prev?.title ?? "Shared match",
    score: snap ? `${snap.batting} ${snap.runs}/${snap.wickets} (${snap.overs} ov)` : (prev?.score ?? "Waiting for the scorer"),
    result: snap?.result ?? prev?.result,
    openedAt: new Date().toISOString(),
  }
  if (prev && prev.title === entry.title && prev.score === entry.score && prev.result === entry.result) return
  set([entry, ...current.filter((w) => w.id !== id)].slice(0, MAX))
}

export async function forgetWatched(id: string) {
  set((await list()).filter((w) => w.id !== id))
}

export function useWatched(): Watched[] {
  const [items, setItems] = useState<Watched[]>(cache ?? [])
  useEffect(() => {
    listeners.add(setItems)
    void list().then(setItems)
    return () => {
      listeners.delete(setItems)
    }
  }, [])
  return items
}
