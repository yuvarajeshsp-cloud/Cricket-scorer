import { useState } from "react"
import { ArrowLeftRight, LogOut, MoreHorizontal, Radio, Trophy, Undo2, UserMinus, Zap } from "lucide-react"
import { Badge, Button, cn } from "@rajesh-hub/ui"
import type { DismissalKind, Extra, InningsEvent, Match, Player } from "../engine/types"
import { DISMISSALS, oversText, plural, runRate, strikeRate, type MatchState, toScorecard } from "../engine/score"
import { isCommon, teamsOf } from "../engine/stats"
import { liveScoreText, scorecardText } from "../engine/share-text"
import { BallChip, Choice, EmptyBall, PadButton, SectionLabel, Sheet } from "../components/bits"
import { PlayerPicker, type PickResult } from "../components/PlayerPicker"
import { WhatsAppButton } from "../components/WhatsAppButton"
import { newPlayer, vibrate } from "../store"

type Ball = Extract<InningsEvent, { type: "ball" }>

export interface ScoringProps {
  match: Match
  state: MatchState
  players: Player[]
  liveLink: string
  onEvent: (ev: InningsEvent) => void
  /** Save a picked player and, for batters and bowlers, put them in the team (moving them if needed), then add the event. */
  onPlayer: (r: PickResult, team: string | null, ev: InningsEvent | null) => void
  onUndo: () => void
  onNextInnings: () => void
  onNewMatch: () => void
  onShare: () => void
}

export function Scoring(props: ScoringProps) {
  const { match, state, onEvent, onUndo, onNextInnings, onNewMatch, onShare, liveLink } = props
  const cur = state.current!
  const [extra, setExtra] = useState<Extra | null>(null)
  const [wicketOpen, setWicketOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [retireOpen, setRetireOpen] = useState(false)

  const ball = (b: Ball) => {
    vibrate(b.wicket ? 40 : b.runs >= 4 ? 25 : 12)
    onEvent(b)
  }

  const inningsNo = state.innings.length
  const line = (id: string | null) => (id ? cur.batters.find((b) => b.id === id) : undefined)
  const striker = line(cur.crease[0])
  const nonStriker = line(cur.crease[1])
  const bowler = cur.bowlers.find((b) => b.id === (cur.bowler ?? cur.lastOverBowler))
  const thisOver = cur.bowler ? cur.overs[cur.overs.length - 1]?.balls ?? [] : []
  const legalInOver = cur.legalBalls % 6
  const ballsLeft = match.overs * 6 - cur.legalBalls
  const canScore = !cur.complete && cur.needs === null
  const hasHistory = match.innings.some((inn) => inn.events.length > 0) || match.innings.length > 1

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        // While scoring, fit exactly between the top of the page and the bottom menu (4rem + safe area)
        // so Wide / No ball / Undo are never below the fold. Short phones get a more compact layout.
        cur.complete ? "pb-24" : "h-[calc(100dvh-6rem-env(safe-area-inset-bottom))] min-h-[540px] gap-2 [@media(min-height:780px)]:gap-3",
      )}
    >
      {/* Score hero */}
      <section className="relative shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-brand-blue p-4 text-white shadow-lg [@media(min-height:780px)]:p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/5" />
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-white/75">
          <span className="truncate">
            {inningsNo === 1 ? "1st innings" : "2nd innings"} · {plural(match.overs, "over")}
          </span>
          <span className="flex shrink-0 gap-1.5">
            <WhatsAppButton text={liveScoreText(match, state, liveLink)} className="h-7 rounded-full bg-white/15 px-2.5 text-xs text-white hover:bg-white/25" label="Share" />
            <button type="button" onClick={onShare} className="flex h-7 items-center gap-1.5 rounded-full bg-white/15 px-2.5 font-semibold text-white">
              <Radio className="size-3.5" /> Live
            </button>
          </span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white/85">{cur.batting}</p>
            <p className="text-4xl font-black tabular-nums leading-none tracking-tight [@media(min-height:780px)]:text-5xl">
              {cur.runs}
              <span className="text-white/60">/{cur.wickets}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">{oversText(cur.legalBalls)}</p>
            <p className="text-xs text-white/70">overs</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80 [@media(min-height:780px)]:mt-3">
          <span>CRR {runRate(cur.runs, cur.legalBalls)}</span>
          {state.target !== undefined && inningsNo === 2 ? (
            <>
              <span>Target {state.target}</span>
              <span>RRR {runRate(Math.max(0, state.target - cur.runs), ballsLeft)}</span>
              {/* Short phones: "Need …" joins this row instead of taking its own line. */}
              {!cur.complete ? (
                <span className="font-semibold text-white [@media(min-height:780px)]:hidden">
                  Need {Math.max(0, state.target - cur.runs)} off {ballsLeft}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        {state.target !== undefined && inningsNo === 2 && !cur.complete ? (
          <p className="mt-2 hidden rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold [@media(min-height:780px)]:block">
            Need {Math.max(0, state.target - cur.runs)} off {ballsLeft} ball{ballsLeft === 1 ? "" : "s"}
          </p>
        ) : null}
      </section>

      {/* Batters + bowler */}
      <section className="shrink-0 rounded-3xl bg-card p-1.5 ring-1 ring-border [@media(min-height:780px)]:p-2">
        {[striker, nonStriker].map((b, i) => (
          <div key={i} className={cn("flex items-center justify-between rounded-2xl px-3 py-1.5 [@media(min-height:780px)]:py-2.5", i === 0 && b && "bg-secondary")}>
            <span className="flex min-w-0 items-center gap-2 font-semibold">
              <span className={cn("size-2 shrink-0 rounded-full", i === 0 && b ? "bg-teal" : "bg-transparent")} />
              <span className="truncate">{b ? b.name : <span className="text-muted-foreground">Waiting for batter…</span>}</span>
            </span>
            {b ? (
              <span className="shrink-0 tabular-nums">
                <span className="text-lg font-bold">{b.runs}</span>
                <span className="text-sm text-muted-foreground"> ({b.balls})</span>
                <span className="ml-2 hidden text-xs text-muted-foreground min-[380px]:inline">SR {strikeRate(b.runs, b.balls)}</span>
              </span>
            ) : null}
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t px-3 pt-1.5 pb-1 text-sm [@media(min-height:780px)]:pt-2.5 [@media(min-height:780px)]:pb-1.5">
          <span className="truncate text-muted-foreground">
            Bowling: <span className="font-semibold text-foreground">{bowler?.name ?? "—"}</span>
          </span>
          {bowler ? (
            <span className="shrink-0 font-semibold tabular-nums">
              {oversText(bowler.balls)}-{bowler.maidens}-{bowler.runs}-{bowler.wickets}
            </span>
          ) : null}
        </div>
      </section>

      {/* This over */}
      <section className="flex shrink-0 items-center gap-3 rounded-3xl bg-card px-4 py-2 ring-1 ring-border [@media(min-height:780px)]:py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">This over</span>
        <div className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto">
          {thisOver.map((m, i) => (
            <BallChip key={i} mark={m} />
          ))}
          {cur.bowler
            ? Array.from({ length: Math.max(0, 6 - legalInOver) }).map((_, i) => <EmptyBall key={`e${i}`} />)
            : null}
        </div>
        {cur.freeHit ? (
          <Badge className="shrink-0 bg-gold text-white">
            <Zap className="size-3" /> Free hit
          </Badge>
        ) : null}
      </section>

      {/* Innings / match end */}
      {cur.complete ? (
        <section className="flex flex-col items-center gap-3 rounded-3xl bg-card p-6 text-center ring-1 ring-border">
          <Trophy className="size-10 text-gold" />
          {state.result ? (
            <>
              <p className="text-xl font-bold">{state.result}</p>
              <WhatsAppButton text={scorecardText(toScorecard(match, state))} className="h-12 w-full rounded-2xl text-base font-bold" label="Share result on WhatsApp" />
              <Button variant="outline" className="h-12 w-full rounded-2xl text-base font-bold" onClick={onNewMatch}>
                New match
              </Button>
            </>
          ) : (
            <>
              <p className="text-lg font-bold">Innings break</p>
              <p className="text-muted-foreground">
                {cur.bowling} need <span className="font-bold text-foreground">{cur.runs + 1}</span> to win from {plural(match.overs, "over")}
              </p>
              <Button className="h-12 w-full rounded-2xl text-base font-bold" onClick={onNextInnings}>
                Start 2nd innings
              </Button>
              <WhatsAppButton text={liveScoreText(match, state, liveLink)} variant="outline" className="h-12 w-full rounded-2xl text-base font-bold" label="Share innings score" />
            </>
          )}
          <Button variant="ghost" onClick={onUndo}>
            <Undo2 /> Undo last ball
          </Button>
        </section>
      ) : (
        /* Scoring pad */
        <section className="grid min-h-0 flex-1 auto-rows-fr grid-cols-4 grid-rows-4 gap-2 [&>button]:h-auto [&>button]:min-h-11">
          {[0, 1, 2, 3].map((r) => (
            <PadButton key={r} disabled={!canScore} onClick={() => ball({ type: "ball", runs: r })} sub={r === 0 ? "dot" : undefined}>
              {r}
            </PadButton>
          ))}
          <PadButton variant="four" disabled={!canScore} onClick={() => ball({ type: "ball", runs: 4 })} sub="four">
            4
          </PadButton>
          <PadButton variant="six" disabled={!canScore} onClick={() => ball({ type: "ball", runs: 6 })} sub="six">
            6
          </PadButton>
          <PadButton variant="out" disabled={!canScore} onClick={() => setWicketOpen(true)} sub={cur.freeHit ? "free hit" : "wicket"}>
            OUT
          </PadButton>
          <PadButton variant="ghost" className="text-foreground" disabled={!canScore} onClick={() => setRetireOpen(true)}>
            <UserMinus className="size-5" />
            <span className="text-[10px] font-medium uppercase">Retire</span>
          </PadButton>
          {(["wd", "nb", "b", "lb"] as Extra[]).map((x) =>
            x === "wd" ? (
              // One tap = a plain wide (1 run). Hold it (or use More) when they also ran.
              <PadButton key={x} variant="extra" disabled={!canScore} onClick={() => ball({ type: "ball", runs: 0, extra: "wd" })} onLongPress={() => setExtra("wd")}>
                Wide
                <span className="text-[9px] font-medium normal-case opacity-70">hold for runs</span>
              </PadButton>
            ) : (
              <PadButton key={x} variant="extra" disabled={!canScore} onClick={() => setExtra(x)}>
                {{ wd: "Wide", nb: "No ball", b: "Bye", lb: "Leg bye" }[x]}
              </PadButton>
            ),
          )}
          <PadButton
            variant="ghost"
            className="col-span-2"
            disabled={!hasHistory}
            onClick={() => {
              vibrate()
              onUndo()
            }}
          >
            <span className="flex items-center gap-2">
              <Undo2 className="size-5" /> Undo
            </span>
          </PadButton>
          <PadButton variant="ghost" disabled={!canScore} onClick={() => onEvent({ type: "swap" })}>
            <ArrowLeftRight className="size-5" />
            <span className="text-[10px] font-medium uppercase">Swap</span>
          </PadButton>
          <PadButton variant="ghost" disabled={!canScore} onClick={() => setMoreOpen(true)}>
            <MoreHorizontal className="size-5" />
            <span className="text-[10px] font-medium uppercase">More</span>
          </PadButton>
        </section>
      )}

      <ExtraSheet
        extra={extra}
        onClose={() => setExtra(null)}
        onBall={(b) => {
          setExtra(null)
          ball(b)
        }}
      />
      <WicketSheet
        {...props}
        open={wicketOpen}
        onClose={() => setWicketOpen(false)}
        onBall={(b) => {
          setWicketOpen(false)
          ball(b)
        }}
      />
      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="More">
        <div className="flex flex-col gap-4">
          <div>
            <SectionLabel>Runs</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {[5, 7].map((r) => (
                <PadButton
                  key={r}
                  onClick={() => {
                    setMoreOpen(false)
                    ball({ type: "ball", runs: r })
                  }}
                  sub="runs"
                >
                  {r}
                </PadButton>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            className="h-14 justify-start rounded-2xl text-base font-semibold"
            onClick={() => {
              setMoreOpen(false)
              setRetireOpen(true)
            }}
          >
            <LogOut /> Retire a batter
          </Button>
          <Button
            variant="outline"
            className="h-14 justify-start rounded-2xl text-base font-semibold"
            onClick={() => {
              setMoreOpen(false)
              setExtra("wd")
            }}
          >
            Wide + runs (they ran on a wide)
          </Button>
        </div>
      </Sheet>
      <RetireSheet
        open={retireOpen}
        striker={striker?.name ?? ""}
        nonStriker={nonStriker?.name ?? ""}
        onClose={() => setRetireOpen(false)}
        onRetire={(who, kind) => {
          setRetireOpen(false)
          vibrate(25)
          onEvent({ type: "retire", who, kind })
        }}
      />
      <PlayerSheet {...props} canUndo={hasHistory} />
    </div>
  )
}

function ExtraSheet({ extra, onClose, onBall }: { extra: Extra | null; onClose: () => void; onBall: (b: Ball) => void }) {
  const cfg = {
    wd: { title: "Wide", hint: "1 run added. Did they run any more?", runs: [0, 1, 2, 3, 4], label: (r: number) => (r === 0 ? "Wd" : r === 4 ? "Wd+4" : `+${r}`) },
    nb: { title: "No ball", hint: "1 run added and a free hit next. Runs off the bat?", runs: [0, 1, 2, 3, 4, 6], label: (r: number) => (r === 0 ? "Nb" : String(r)) },
    b: { title: "Byes", hint: "How many byes?", runs: [1, 2, 3, 4], label: (r: number) => String(r) },
    lb: { title: "Leg byes", hint: "How many leg byes?", runs: [1, 2, 3, 4], label: (r: number) => String(r) },
  }
  const c = extra ? cfg[extra] : null
  return (
    <Sheet open={extra !== null} onOpenChange={(o) => !o && onClose()} title={c?.title ?? ""} description={c?.hint}>
      <div className="grid grid-cols-3 gap-2">
        {c?.runs.map((r) => (
          <PadButton key={r} variant={r === 4 ? "four" : r === 6 ? "six" : "plain"} onClick={() => onBall({ type: "ball", runs: r, extra: extra! })}>
            {c.label(r)}
          </PadButton>
        ))}
      </div>
    </Sheet>
  )
}

/** Turns squad ids into players, using the saved list where possible. */
function resolver(match: Match, players: Player[]) {
  const byId = new Map(players.map((p) => [p.id, p]))
  return (id: string): Player => byId.get(id) ?? { id, name: match.roster[id] ?? id, createdAt: "" }
}

function WicketSheet({
  open,
  onClose,
  onBall,
  match,
  state,
  players,
  onPlayer,
}: ScoringProps & { open: boolean; onClose: () => void; onBall: (b: Ball) => void }) {
  const cur = state.current!
  const [kind, setKind] = useState<DismissalKind | null>(null)
  const [who, setWho] = useState<"striker" | "non-striker">("striker")
  const [runs, setRuns] = useState(0)
  const [fielder, setFielder] = useState<Player | null>(null)
  const [choosing, setChoosing] = useState(false)
  const resolve = resolver(match, players)
  const name = (id: string | null) => (id ? cur.batters.find((b) => b.id === id)?.name ?? "" : "")

  const reset = () => {
    setKind(null)
    setWho("striker")
    setRuns(0)
    setFielder(null)
    setChoosing(false)
  }
  const close = () => {
    reset()
    onClose()
  }
  const confirm = () => {
    onBall({ type: "ball", runs: kind === "run-out" ? runs : 0, wicket: { kind: kind!, out: kind === "run-out" ? who : "striker", fielder: fielder?.id } })
    reset()
  }
  const needsFielder = kind === "caught" || kind === "run-out" || kind === "stumped"
  const title = choosing ? (kind === "stumped" ? "Wicket keeper" : "Fielder") : kind ? DISMISSALS.find((d) => d.kind === kind)!.label : "How out?"

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()} title={title} description={!kind && cur.freeHit ? "Free hit: only a run out counts." : undefined}>
      {choosing ? (
        <PlayerPicker
          sections={[{ title: `${cur.bowling} fielders`, players: (match.squads[cur.bowling] ?? []).map(resolve) }]}
          everyone={players}
          tagOf={(p) => {
            if (isCommon(match, p.id)) return "Common player"
            const t = teamsOf(match, p.id)
            return t.length && !t.includes(cur.bowling) ? `Plays for ${t[0]} · substitute` : undefined
          }}
          newPlayer={newPlayer}
          onPick={(r) => {
            onPlayer(r, null, null)
            setFielder(r.player)
            setChoosing(false)
          }}
        />
      ) : !kind ? (
        <div className="grid grid-cols-2 gap-2">
          {DISMISSALS.map((d) => (
            <PadButton
              key={d.kind}
              className="text-lg"
              disabled={cur.freeHit && d.kind !== "run-out"}
              onClick={() => (needsKind(d.kind) ? setKind(d.kind) : onBall({ type: "ball", runs: 0, wicket: { kind: d.kind, out: "striker" } }))}
            >
              {d.label}
            </PadButton>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {kind === "run-out" ? (
            <>
              <div>
                <SectionLabel>Who is out?</SectionLabel>
                <Choice options={[{ value: "striker", label: name(cur.crease[0]) }, { value: "non-striker", label: name(cur.crease[1]) }]} value={who} onChange={setWho} />
              </div>
              <div>
                <SectionLabel>Runs completed</SectionLabel>
                <Choice options={[0, 1, 2, 3].map((r) => ({ value: r, label: r }))} value={runs} onChange={setRuns} />
              </div>
            </>
          ) : null}
          {needsFielder ? (
            <div>
              <SectionLabel>{kind === "stumped" ? "Keeper" : "Fielder"} (optional)</SectionLabel>
              <Button variant="outline" className="h-12 w-full justify-between rounded-2xl" onClick={() => setChoosing(true)}>
                <span className={cn(!fielder && "text-muted-foreground")}>{fielder ? fielder.name : kind === "caught" ? "Choose fielder (or skip for caught & bowled)" : "Choose player"}</span>
                <span className="text-xs text-muted-foreground">{fielder ? "Change" : ""}</span>
              </Button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button variant="outline" className="h-14 flex-1 rounded-2xl" onClick={() => setKind(null)}>
              Back
            </Button>
            <Button className="h-14 flex-[2] rounded-2xl bg-destructive text-lg font-bold text-white hover:bg-destructive/90" onClick={confirm}>
              Confirm out
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function RetireSheet({
  open,
  striker,
  nonStriker,
  onClose,
  onRetire,
}: {
  open: boolean
  striker: string
  nonStriker: string
  onClose: () => void
  onRetire: (who: "striker" | "non-striker", kind: "not-out" | "out") => void
}) {
  const [who, setWho] = useState<"striker" | "non-striker">("striker")
  const [kind, setKind] = useState<"not-out" | "out">("not-out")
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Retire a batter" description="No ball is bowled. The next batter comes in at the same end.">
      <div className="flex flex-col gap-5">
        <div>
          <SectionLabel>Who is retiring?</SectionLabel>
          <Choice options={[{ value: "striker", label: `${striker} (on strike)` }, { value: "non-striker", label: nonStriker }]} value={who} onChange={setWho} />
        </div>
        <div className="flex flex-col gap-2">
          <SectionLabel>Type</SectionLabel>
          {(
            [
              { k: "not-out", title: "Retired not out", text: "Not a wicket. Can come back to bat later in this innings with the same score." },
              { k: "out", title: "Retired out", text: "Counts as a wicket. Cannot bat again in this innings." },
            ] as const
          ).map((o) => (
            <button
              key={o.k}
              type="button"
              onClick={() => setKind(o.k)}
              className={cn("rounded-2xl p-4 text-left ring-1", kind === o.k ? "bg-primary/15 ring-primary" : "bg-card ring-border")}
            >
              <span className="block font-semibold">{o.title}</span>
              <span className="block text-sm text-muted-foreground">{o.text}</span>
            </button>
          ))}
        </div>
        <Button className="h-14 rounded-2xl text-base font-bold" onClick={() => onRetire(who, kind)}>
          Retire {who === "striker" ? striker : nonStriker}
        </Button>
      </div>
    </Sheet>
  )
}

const needsKind = (k: DismissalKind) => k === "caught" || k === "run-out" || k === "stumped"

/** Opens by itself whenever the innings needs a batter or a bowler before the next ball. */
function PlayerSheet({ match, state, players, onPlayer, onUndo, canUndo }: ScoringProps & { canUndo: boolean }) {
  const cur = state.current!
  const open = cur.needs !== null
  const isBatter = cur.needs === "batter"
  const team = isBatter ? cur.batting : cur.bowling
  const otherTeam = isBatter ? cur.bowling : cur.batting
  const resolve = resolver(match, players)
  const started = cur.legalBalls > 0 || cur.overs.length > 0

  let title: string
  if (isBatter) title = cur.batters.length === 0 ? "Striker" : cur.batters.length === 1 && !started ? "Non-striker" : "Next batter"
  else title = cur.overs.length === 0 ? "Opening bowler" : `Over ${Math.floor(cur.legalBalls / 6) + 1} — who bowls?`

  const squad = (match.squads[team] ?? []).map(resolve)
  const retired = cur.batters.filter((b) => b.retired && !b.out)
  const retiredIds = new Set(retired.map((b) => b.id))
  const batted = new Set(cur.batters.filter((b) => !retiredIds.has(b.id)).map((b) => b.id))
  const atCrease = new Set(cur.crease.filter((x): x is string => x !== null))
  const sections = isBatter
    ? [
        { title: "Retired — can bat again", players: retired.map((b) => resolve(b.id)) },
        { title: `${team} squad`, players: squad.filter((p) => !batted.has(p.id) && !retiredIds.has(p.id)) },
      ]
    : [{ title: `${team} bowlers`, players: [...new Map([...cur.bowlers.map((b) => resolve(b.id)), ...squad].map((p) => [p.id, p])).values()] }]

  const disabledReason = (p: Player) => {
    if (isBatter && atCrease.has(p.id)) return "Batting now"
    if (isBatter && batted.has(p.id)) return "Already batted"
    if (!isBatter && atCrease.has(p.id)) return "Batting now"
    if (!isBatter && p.id === cur.lastOverBowler) return "Bowled the last over"
    return undefined
  }
  const tagOf = (p: Player) => {
    const r = retired.find((b) => b.id === p.id)
    if (isBatter && r) return `Retired on ${r.runs} (${r.balls})`
    if (!isBatter) {
      const bl = cur.bowlers.find((b) => b.id === p.id)
      if (bl) return `${oversText(bl.balls)}-${bl.maidens}-${bl.runs}-${bl.wickets}`
    }
    if (isCommon(match, p.id)) return "Common player"
    const t = teamsOf(match, p.id)
    return t.length && !t.includes(team) ? `Plays for ${t[0]}` : undefined
  }
  const warningOf = (p: Player) => {
    const t = teamsOf(match, p.id)
    if (!t.includes(otherTeam) || t.includes(team)) return undefined
    const playedFor = match.innings.some((inn) =>
      inn.events.some((ev) => (ev.type === "batter" || ev.type === "bowler") && ev.id === p.id),
    )
    return {
      title: `${p.name} plays for ${otherTeam}`,
      text: `Move ${p.name} to ${team}, or make them a common player who can play for both teams.${playedFor ? ` What they already did for ${otherTeam} in this match stays with ${otherTeam}.` : ""}`,
      confirm: `Move to ${team}`,
      common: "Make common to both teams",
    }
  }
  // Team name first, so placeholders from the two sides never share a name ("Lions batter 3", "Tigers bowler 1").
  const guestName = isBatter ? `${team} batter ${cur.batters.length + 1}` : `${team} bowler ${cur.bowlers.length + 1}`

  return (
    <Sheet open={open} onOpenChange={() => {}} dismissible={false} title={title} description={`${team} · ${isBatter ? "batting" : "bowling"}`}>
      <div className="flex flex-col gap-4">
        <PlayerPicker
          key={`${cur.needs}-${cur.batters.length}-${cur.overs.length}-${cur.wickets}`}
          sections={sections}
          everyone={players}
          tagOf={tagOf}
          disabledReason={disabledReason}
          warningOf={warningOf}
          newPlayer={newPlayer}
          guestName={guestName}
          onPick={(r) => {
            vibrate()
            onPlayer(r, team, isBatter ? { type: "batter", id: r.player.id } : { type: "bowler", id: r.player.id })
          }}
        />
        {canUndo ? (
          <Button variant="ghost" onClick={onUndo}>
            <Undo2 /> Undo last action
          </Button>
        ) : null}
      </div>
    </Sheet>
  )
}
