import { useEffect, useMemo, useState } from "react"
import { House, ListOrdered, Radio, Target, Users } from "lucide-react"
import { toast } from "sonner"
import { BottomNav, Toaster } from "@rajesh-hub/ui"
import { useStore } from "@rajesh-hub/offline-store"
import type { InningsEvent, Match, MatchSetup, Player } from "./engine/types"
import { battingFirst, computeMatch, toScorecard, toSnapshot } from "./engine/score"
import { live, liveUrl, newSecret } from "./live"
import { newId, newPlayer, store, type AppData } from "./store"
import { demoData } from "./demo"
import type { PickResult } from "./components/PlayerPicker"
import { Home } from "./screens/Home"
import { Setup } from "./screens/Setup"
import { Scoring } from "./screens/Scoring"
import { Scorecard } from "./screens/Scorecard"
import { Share } from "./screens/Share"
import { Overlay, Viewer } from "./screens/Viewer"
import { PlayerProfile, Players } from "./screens/Players"

type Tab = "home" | "score" | "card" | "players" | "share"

function useHashRoute() {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    window.addEventListener("hashchange", on)
    return () => window.removeEventListener("hashchange", on)
  }, [])
  return hash
}

export default function App() {
  const hash = useHashRoute()
  const live = hash.match(/^#\/(live|overlay)\/([a-z0-9]+)/)
  // key: a different match code starts a fresh viewer, so the old score never shows.
  if (live) return live[1] === "live" ? <Viewer key={live[2]} matchId={live[2]} /> : <Overlay key={live[2]} matchId={live[2]} />
  return <ScorerApp />
}

/** Save a picked player, put them in `team` for this match (moving them out of the other team), and add the event. */
function applyPick(d: AppData, r: PickResult, team: string | null, ev: InningsEvent | null): AppData {
  const players = r.isNew ? [...d.players, r.player] : d.players
  const matches = d.matches.map((m) => {
    if (m.id !== d.currentId) return m
    const roster = { ...m.roster, [r.player.id]: r.player.name }
    let squads = m.squads
    if (team) {
      squads = Object.fromEntries(
        Object.entries<string[]>({ [m.teamA]: [], [m.teamB]: [], ...m.squads }).map(([t, ids]) => [
          t,
          t === team ? (ids.includes(r.player.id) ? ids : [...ids, r.player.id]) : r.common ? ids : ids.filter((x) => x !== r.player.id),
        ]),
      )
    }
    let innings = m.innings
    if (ev) {
      innings = [...m.innings]
      const last = innings[innings.length - 1]
      innings[innings.length - 1] = { ...last, events: [...last.events, ev] }
    }
    return { ...m, roster, squads, innings }
  })
  return { ...d, players, matches }
}

function ScorerApp() {
  const { data, update } = useStore(store)
  const [tab, setTab] = useState<Tab>("home")
  const [setupOpen, setSetupOpen] = useState(false)
  const [profileId, setProfileId] = useState<string | null>(null)

  const match = data?.matches.find((m) => m.id === data.currentId) ?? null
  const state = useMemo(() => (match ? computeMatch(match) : null), [match])
  const snapshot = useMemo(() => (match && state ? toSnapshot(match, state) : null), [match, state])

  // Every change goes out to viewers.
  useEffect(() => {
    if (snapshot && match?.secret) live.publish(snapshot, match.secret)
  }, [snapshot])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, profileId, setupOpen])

  if (!data) return null

  const patch = (fn: (m: Match) => Match) =>
    update((d) => ({ ...d, matches: d.matches.map((m) => (m.id === d.currentId ? fn(m) : m)) }))

  const addEvent = (ev: InningsEvent) =>
    patch((m) => {
      if (computeMatch(m).current?.complete) return m
      const innings = [...m.innings]
      const last = innings[innings.length - 1]
      innings[innings.length - 1] = { ...last, events: [...last.events, ev] }
      return { ...m, innings }
    })

  const undo = () =>
    patch((m) => {
      const innings = [...m.innings]
      const last = innings[innings.length - 1]
      if (last.events.length === 0) {
        if (innings.length > 1) innings.pop()
        return { ...m, innings }
      }
      innings[innings.length - 1] = { ...last, events: last.events.slice(0, -1) }
      return { ...m, innings }
    })

  const startMatch = (s: MatchSetup, created: Player[]) => {
    const [bat, bowl] = battingFirst(s)
    const all = [...data.players, ...created]
    const roster = Object.fromEntries(
      Object.values(s.squads)
        .flat()
        .map((id) => [id, all.find((p) => p.id === id)?.name ?? id]),
    )
    const m: Match = { ...s, id: newId(), secret: newSecret(), createdAt: new Date().toISOString(), roster, innings: [{ batting: bat, bowling: bowl, events: [] }] }
    update((d) => ({ ...d, players: [...d.players, ...created], matches: [...d.matches, m], currentId: m.id }))
    setSetupOpen(false)
    setTab("score")
  }

  const nextInnings = () =>
    patch((m) => {
      const first = m.innings[0]
      return { ...m, innings: [...m.innings, { batting: first.bowling, bowling: first.batting, events: [] }] }
    })

  const remove = (id: string) => {
    const gone = data.matches.find((m) => m.id === id)
    update((d) => ({ ...d, matches: d.matches.filter((m) => m.id !== id), currentId: d.currentId === id ? null : d.currentId }))
    if (gone)
      toast("Match deleted", {
        action: { label: "Undo", onClick: () => update((d) => ({ ...d, matches: [...d.matches, gone] })) },
      })
  }

  const rename = (id: string, name: string) =>
    update((d) => ({
      ...d,
      players: d.players.map((p) => (p.id === id ? { ...p, name } : p)),
      matches: d.matches.map((m) => (m.roster[id] ? { ...m, roster: { ...m.roster, [id]: name } } : m)),
    }))

  const openMatch = (id: string) => {
    update((d) => ({ ...d, currentId: id }))
    setProfileId(null)
    setTab("score")
  }

  if (setupOpen) {
    return (
      <main className="mx-auto max-w-lg p-4">
        <Setup players={data.players} onCancel={() => setSetupOpen(false)} onStart={startMatch} />
      </main>
    )
  }

  const needsMatch = (tab === "score" || tab === "card" || tab === "share") && (!match || !state)
  const shown: Tab = needsMatch ? "home" : tab
  const profile = profileId ? data.players.find((p) => p.id === profileId) : undefined

  return (
    <>
      <main className="mx-auto max-w-lg p-4">
        {profile ? (
          <PlayerProfile
            key={profile.id}
            player={profile}
            matches={data.matches}
            onBack={() => setProfileId(null)}
            onRename={(n) => rename(profile.id, n)}
            onOpenMatch={openMatch}
          />
        ) : (
          <>
            {shown === "home" && (
              <Home
                matches={data.matches}
                currentId={data.currentId}
                onNew={() => setSetupOpen(true)}
                onOpen={openMatch}
                onDelete={remove}
                onDemo={() => {
                  const demo = demoData()
                  update((d) => ({ players: [...d.players, ...demo.players], matches: [...d.matches, ...demo.matches], currentId: demo.matches[1].id }))
                  setTab("score")
                }}
              />
            )}
            {shown === "score" && match && state && (
              <Scoring
                match={match}
                state={state}
                players={data.players}
                liveLink={liveUrl(match.id)}
                onEvent={addEvent}
                onPlayer={(r, team, ev) => update((d) => applyPick(d, r, team, ev))}
                onUndo={undo}
                onNextInnings={nextInnings}
                onNewMatch={() => setSetupOpen(true)}
                onShare={() => setTab("share")}
              />
            )}
            {shown === "card" && match && state && <Scorecard card={toScorecard(match, state)} onOpenPlayer={setProfileId} />}
            {shown === "players" && (
              <Players
                players={data.players}
                matches={data.matches}
                onOpen={setProfileId}
                onAdd={(name) => {
                  const p = newPlayer(name)
                  update((d) => ({ ...d, players: [...d.players, p] }))
                  toast(`${p.name} added`)
                }}
              />
            )}
            {shown === "share" && match && state && <Share match={match} state={state} />}
          </>
        )}
      </main>
      <BottomNav
        items={[
          { key: "home", label: "Home", icon: House },
          { key: "score", label: "Score", icon: Target },
          { key: "card", label: "Scorecard", icon: ListOrdered },
          { key: "players", label: "Players", icon: Users },
          { key: "share", label: "Live", icon: Radio },
        ]}
        active={profile ? "players" : shown}
        onSelect={(k) => {
          if ((k === "score" || k === "card" || k === "share") && !match) {
            toast("Start or open a match first")
            return
          }
          setProfileId(null)
          setTab(k as Tab)
        }}
      />
      <Toaster position="top-center" />
    </>
  )
}
