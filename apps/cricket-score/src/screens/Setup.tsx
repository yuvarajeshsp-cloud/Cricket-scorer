import { useEffect, useState } from "react"
import { ArrowLeft, Coins, Minus, Plus, UserPlus, Users, X } from "lucide-react"
import { Button, Input } from "@rajesh-hub/ui"
import type { MatchSetup, Player } from "../engine/types"
import { Choice, SectionLabel, Sheet } from "../components/bits"
import { PlayerPicker } from "../components/PlayerPicker"
import { newPlayer } from "../store"
import { plural } from "../engine/score"
import { asPlayer, groupPlayers, type Group } from "../groups"

const OVER_PRESETS = [5, 6, 8, 10, 20, 50]

function Stepper({ value, onChange, min, max }: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <Button size="icon" variant="outline" className="size-11 rounded-full" onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus />
      </Button>
      <span className="w-10 text-center text-2xl font-bold tabular-nums">{value}</span>
      <Button size="icon" variant="outline" className="size-11 rounded-full" onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus />
      </Button>
    </div>
  )
}

export function Setup({
  players,
  groups = [],
  initialGroupId = null,
  onCancel,
  onStart,
}: {
  players: Player[]
  /** The scorer's groups (signed in). A group match is shared with everyone in the group. */
  groups?: Group[]
  initialGroupId?: string | null
  onCancel: () => void
  /**
   * newPlayers: picked players this phone doesn't have yet (typed in, or from the group's list).
   * addToGroup: players typed in here, to add to the group's player list.
   */
  onStart: (s: MatchSetup, newPlayers: Player[], groupId: string | null, addToGroup: Player[]) => void
}) {
  const [groupId, setGroupId] = useState<string | null>(initialGroupId)
  const [roster, setRoster] = useState<Player[] | null>(null)
  useEffect(() => {
    setRoster(null)
    if (!groupId) return
    let alive = true
    groupPlayers(groupId).then(
      (list) => alive && setRoster(list.map(asPlayer)),
      () => alive && setRoster([]),
    )
    return () => {
      alive = false
    }
  }, [groupId])
  const pool = groupId ? (roster ?? []) : players
  const [teamA, setTeamA] = useState("")
  const [teamB, setTeamB] = useState("")
  const [overs, setOvers] = useState(20)
  const [perSide, setPerSide] = useState(11)
  const [toss, setToss] = useState<"A" | "B" | null>(null)
  const [choice, setChoice] = useState<"bat" | "bowl" | null>(null)
  const [squads, setSquads] = useState<{ A: Player[]; B: Player[] }>({ A: [], B: [] })
  const [adding, setAdding] = useState<"A" | "B" | null>(null)
  const [created, setCreated] = useState<Player[]>([])

  const a = teamA.trim() || "Team A"
  const b = teamB.trim() || "Team B"
  const ready = toss !== null && choice !== null && a !== b

  const name = (k: "A" | "B") => (k === "A" ? a : b)
  const other = (k: "A" | "B") => (k === "A" ? "B" : "A")
  const toggle = (k: "A" | "B", p: Player, isNew: boolean, common = false) => {
    if (isNew) setCreated((c) => [...c, p])
    setSquads((s) => {
      const o = other(k)
      if (s[k].some((x) => x.id === p.id)) return { ...s, [k]: s[k].filter((x) => x.id !== p.id) }
      return { ...s, [k]: [...s[k], p], [o]: common ? s[o] : s[o].filter((x) => x.id !== p.id) }
    })
  }
  const inBoth = (id: string) => squads.A.some((x) => x.id === id) && squads.B.some((x) => x.id === id)

  return (
    <div className="flex flex-col gap-6 pb-32">
      <header className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onCancel} aria-label="Back">
          <ArrowLeft />
        </Button>
        <h1 className="text-xl font-bold">New match</h1>
      </header>

      {groups.length ? (
        <section>
          <SectionLabel>Group</SectionLabel>
          <Choice
            options={[{ value: "", label: "No group" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
            value={groupId ?? ""}
            onChange={(v) => {
              setGroupId(v || null)
              setSquads({ A: [], B: [] })
            }}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            {groupId ? "Everyone in the group can follow this match live and see it in their results. Squads come from the group's players." : "Only you (and anyone you share the link with) will see this match."}
          </p>
        </section>
      ) : null}

      <section>
        <SectionLabel>Teams</SectionLabel>
        <div className="relative flex flex-col gap-2">
          <Input className="h-14 rounded-2xl text-lg font-semibold" placeholder="Team A" value={teamA} onChange={(e) => setTeamA(e.target.value)} />
          <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-navy px-2.5 py-1 text-[10px] font-bold text-white">VS</span>
          <Input className="h-14 rounded-2xl text-lg font-semibold" placeholder="Team B" value={teamB} onChange={(e) => setTeamB(e.target.value)} />
        </div>
      </section>

      <section>
        <SectionLabel>Overs per side</SectionLabel>
        <Choice options={OVER_PRESETS.map((o) => ({ value: o, label: o }))} value={OVER_PRESETS.includes(overs) ? overs : null} onChange={setOvers} />
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-card p-3 ring-1 ring-border">
          <span className="text-sm text-muted-foreground">Custom</span>
          <Stepper value={overs} onChange={setOvers} min={1} max={50} />
        </div>
      </section>

      <section>
        <SectionLabel>Players per side</SectionLabel>
        <div className="flex items-center justify-between rounded-2xl bg-card p-3 ring-1 ring-border">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" /> All out at {plural(perSide - 1, "wicket")}
          </span>
          <Stepper value={perSide} onChange={setPerSide} min={2} max={15} />
        </div>
      </section>

      <section>
        <SectionLabel>Toss</SectionLabel>
        <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Coins className="size-4 text-gold" /> Who won the toss?
          </p>
          <Choice options={[{ value: "A", label: a }, { value: "B", label: b }]} value={toss} onChange={setToss} />
          <p className="text-sm font-medium">Chose to</p>
          <Choice options={[{ value: "bat", label: "Bat" }, { value: "bowl", label: "Bowl" }]} value={choice} onChange={setChoice} />
        </div>
      </section>

      <section>
        <SectionLabel>Squads (optional)</SectionLabel>
        <p className="-mt-1 mb-3 text-sm text-muted-foreground">Pick from saved players for one-tap scoring. You can still bring in anyone during the match.</p>
        <div className="flex flex-col gap-3">
          {(["A", "B"] as const).map((k) => (
            <div key={k} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {name(k)} <span className="text-sm font-normal text-muted-foreground">· {squads[k].length}</span>
                </span>
                <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setAdding(k)}>
                  <UserPlus /> Add players
                </Button>
              </div>
              {squads[k].length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {squads[k].map((p) => (
                    <span key={p.id} className="flex items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm font-medium">
                      {p.name}
                      {inBoth(p.id) ? <span className="rounded-full bg-teal px-1.5 text-[10px] font-bold text-white">BOTH</span> : null}
                      <button type="button" aria-label={`Remove ${p.name}`} className="rounded-full p-1 text-muted-foreground" onClick={() => toggle(k, p, false)}>
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <Sheet
        open={adding !== null}
        onOpenChange={(o) => !o && setAdding(null)}
        title={adding ? `${name(adding)} squad` : ""}
        description="Tap to add or remove. Tap Done when finished."
      >
        {adding ? (
          <div className="flex flex-col gap-4">
            <PlayerPicker
              sections={[{ title: `In ${name(adding)}`, players: squads[adding] }]}
              everyone={[...pool, ...created]}
              selected={new Set(squads[adding].map((p) => p.id))}
              tagOf={(p) => (inBoth(p.id) ? "Common player" : squads[other(adding)].some((x) => x.id === p.id) ? `In ${name(other(adding))}` : undefined)}
              warningOf={(p) =>
                squads[other(adding)].some((x) => x.id === p.id) && !squads[adding].some((x) => x.id === p.id)
                  ? {
                      title: `${p.name} is in ${name(other(adding))}`,
                      text: `Move ${p.name} to ${name(adding)}, or make them a common player who can play for both teams.`,
                      confirm: `Move to ${name(adding)}`,
                      common: "Make common to both teams",
                    }
                  : undefined
              }
              newPlayer={newPlayer}
              onPick={(r) => toggle(adding, r.player, r.isNew, r.common)}
            />
            <Button className="h-12 rounded-2xl font-bold" onClick={() => setAdding(null)}>
              Done
            </Button>
          </div>
        ) : null}
      </Sheet>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <Button
          className="mx-auto flex h-14 w-full max-w-lg rounded-2xl text-lg font-bold"
          disabled={!ready}
          onClick={() =>
            onStart(
              {
                teamA: a,
                teamB: b,
                overs,
                playersPerSide: perSide,
                tossWinner: toss === "A" ? a : b,
                tossChoice: choice!,
                squads: { [a]: squads.A.map((p) => p.id), [b]: squads.B.map((p) => p.id) },
              },
              [...new Map([...squads.A, ...squads.B].filter((p) => !players.some((x) => x.id === p.id)).map((p) => [p.id, p])).values()],
              groupId,
              created.filter((c) => [...squads.A, ...squads.B].some((p) => p.id === c.id)),
            )
          }
        >
          {ready ? "Start match" : a === b ? "Give the teams different names" : "Pick the toss result"}
        </Button>
      </div>
    </div>
  )
}
