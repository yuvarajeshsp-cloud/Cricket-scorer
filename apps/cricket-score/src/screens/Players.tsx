import { useMemo, useState } from "react"
import { ArrowLeft, Check, Pencil, Search, UserPlus } from "lucide-react"
import { Button, cn, Input } from "@rajesh-hub/ui"
import type { Match, Player } from "../engine/types"
import { avg, bestBat, bestBowl, careerStats, econ, oversText, sr, type CareerStats } from "../engine/stats"
import { playerText } from "../engine/share-text"
import { initials } from "../components/PlayerPicker"
import { SectionLabel } from "../components/bits"
import { WhatsAppButton } from "../components/WhatsAppButton"

export function Players({
  players,
  matches,
  onOpen,
  onAdd,
}: {
  players: Player[]
  matches: Match[]
  onOpen: (id: string) => void
  onAdd: (name: string) => void
}) {
  const [q, setQ] = useState("")
  const [sort, setSort] = useState<"runs" | "wickets" | "name">("runs")
  const rows = useMemo(
    () => players.filter((p) => !p.guest).map((p) => ({ p, c: careerStats(p.id, matches) })),
    [players, matches],
  )
  const query = q.trim().toLowerCase()
  const shown = rows
    .filter((r) => r.p.name.toLowerCase().includes(query))
    .sort((a, b) =>
      sort === "name" ? a.p.name.localeCompare(b.p.name) : sort === "runs" ? b.c.batting.runs - a.c.batting.runs : b.c.bowling.wickets - a.c.bowling.wickets,
    )
  const exact = rows.some((r) => r.p.name.toLowerCase() === query)

  return (
    <div className="flex flex-col gap-4 pb-24">
      <header>
        <h1 className="text-xl font-bold">Players</h1>
        <p className="text-sm text-muted-foreground">Everyone who has played on this phone. Tap a player for their record.</p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-12 rounded-2xl pl-10 text-base" placeholder="Search or add a player" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {query && !exact ? (
        <Button
          className="h-12 justify-start rounded-2xl"
          onClick={() => {
            onAdd(q)
            setQ("")
          }}
        >
          <UserPlus /> Add “{q.trim()}”
        </Button>
      ) : null}

      <div className="flex gap-2">
        {(["runs", "wickets", "name"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            className={cn("h-9 rounded-full px-4 text-sm font-semibold ring-1", sort === s ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-border")}
          >
            {s === "runs" ? "Most runs" : s === "wickets" ? "Most wickets" : "A–Z"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {shown.map(({ p, c }) => (
          <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="flex items-center gap-3 rounded-2xl bg-card p-3 text-left ring-1 ring-border">
            <Avatar name={p.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{p.name}</span>
              <span className="block text-xs text-muted-foreground">
                {c.matches} match{c.matches === 1 ? "" : "es"}
              </span>
            </span>
            <span className="grid grid-cols-2 gap-4 text-right tabular-nums">
              <span>
                <span className="block font-bold">{c.batting.runs}</span>
                <span className="text-[10px] uppercase text-muted-foreground">runs</span>
              </span>
              <span>
                <span className="block font-bold">{c.bowling.wickets}</span>
                <span className="text-[10px] uppercase text-muted-foreground">wkts</span>
              </span>
            </span>
          </button>
        ))}
        {!rows.length ? (
          <div className="rounded-3xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
            Players appear here when you add them to a team or pick them while scoring.
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal to-brand-blue font-bold text-white",
        size === "md" ? "size-11 text-sm" : "size-20 text-2xl",
      )}
    >
      {initials(name)}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-muted/60 px-3 py-2.5">
      <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}

export function PlayerProfile({
  player,
  matches,
  onBack,
  onRename,
  onOpenMatch,
}: {
  player: Player
  matches: Match[]
  onBack: () => void
  onRename: (name: string) => void
  onOpenMatch: (id: string) => void
}) {
  const c: CareerStats = useMemo(() => careerStats(player.id, matches), [player.id, matches])
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(player.name)
  const B = c.batting
  const W = c.bowling
  const outs = B.innings - B.notOuts

  return (
    <div className="flex flex-col gap-4 pb-24">
      <header className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onBack} aria-label="Back">
          <ArrowLeft />
        </Button>
        <h1 className="text-lg font-bold">Player</h1>
      </header>

      <section className="flex flex-col items-center gap-3 rounded-3xl bg-card p-5 text-center ring-1 ring-border">
        <Avatar name={player.name} size="lg" />
        {editing ? (
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) onRename(name.trim())
              setEditing(false)
            }}
          >
            <Input id="player-name" className="h-12 flex-1 rounded-2xl text-base" value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" size="icon" className="size-12 rounded-2xl" aria-label="Save name">
              <Check />
            </Button>
          </form>
        ) : (
          <button type="button" className="flex items-center gap-2 text-2xl font-black" onClick={() => setEditing(true)}>
            {player.name} <Pencil className="size-4 text-muted-foreground" />
          </button>
        )}
        <p className="text-sm text-muted-foreground">
          {c.matches} match{c.matches === 1 ? "" : "es"} · {B.runs} runs · {W.wickets} wickets
        </p>
        <WhatsAppButton text={playerText(player, c)} className="h-11 w-full rounded-2xl" label="Share stats on WhatsApp" />
      </section>

      <section>
        <SectionLabel>Batting</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Innings" value={B.innings} />
          <Stat label="Runs" value={B.runs} />
          <Stat label="Best" value={bestBat(B.best)} />
          <Stat label="Average" value={avg(B.runs, outs)} />
          <Stat label="Strike rate" value={sr(B.runs, B.balls)} />
          <Stat label="Not outs" value={B.notOuts} />
          <Stat label="4s / 6s" value={`${B.fours} / ${B.sixes}`} />
          <Stat label="50s / 100s" value={`${B.fifties} / ${B.hundreds}`} />
          <Stat label="Ducks" value={B.ducks} />
        </div>
      </section>

      <section>
        <SectionLabel>Bowling</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Overs" value={oversText(W.balls)} />
          <Stat label="Wickets" value={W.wickets} />
          <Stat label="Best" value={bestBowl(W.best)} />
          <Stat label="Economy" value={econ(W.runs, W.balls)} />
          <Stat label="Average" value={avg(W.runs, W.wickets)} />
          <Stat label="Maidens" value={W.maidens} />
          <Stat label="Dot balls" value={W.dots} />
          <Stat label="3W / 5W" value={`${W.threeWickets} / ${W.fiveWickets}`} />
          <Stat label="Runs given" value={W.runs} />
        </div>
      </section>

      <section>
        <SectionLabel>Fielding</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Catches" value={c.fielding.catches} />
          <Stat label="Run outs" value={c.fielding.runOuts} />
          <Stat label="Stumpings" value={c.fielding.stumpings} />
        </div>
      </section>

      <section>
        <SectionLabel>Recent matches</SectionLabel>
        <div className="flex flex-col gap-2">
          {c.recent.map((m) => (
            <button key={m.matchId} type="button" onClick={() => onOpenMatch(m.matchId)} className="rounded-2xl bg-card p-3 text-left ring-1 ring-border">
              <span className="flex justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">{m.title}</span>
                <span className="shrink-0">{new Date(m.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
              </span>
              <span className="mt-1.5 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-secondary px-2.5 py-0.5 font-semibold">{m.team}</span>
                {m.batting ? (
                  <span className="rounded-full bg-brand-blue/15 px-2.5 py-0.5 font-semibold tabular-nums">
                    🏏 {m.batting.runs}
                    {m.batting.notOut ? "*" : ""} ({m.batting.balls})
                  </span>
                ) : null}
                {m.bowling ? (
                  <span className="rounded-full bg-teal/15 px-2.5 py-0.5 font-semibold tabular-nums">
                    ⚾ {m.bowling.wickets}/{m.bowling.runs} ({oversText(m.bowling.balls)})
                  </span>
                ) : null}
                {!m.batting && !m.bowling ? <span className="text-muted-foreground">Did not bat or bowl</span> : null}
              </span>
              {m.result ? <span className="mt-1.5 block text-xs text-muted-foreground">{m.result}</span> : null}
            </button>
          ))}
          {!c.recent.length ? <p className="text-sm text-muted-foreground">No matches yet.</p> : null}
        </div>
      </section>
    </div>
  )
}
