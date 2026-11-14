import type { DismissalKind, Extra, Innings, InningsEvent, Match } from "./types"
import { playerOfMatch } from "./awards"

export interface BatterLine {
  id: string
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  /** Dismissal text, e.g. "b Bumrah". Undefined while not out. */
  out?: string
  dismissal?: { kind: DismissalKind; bowler: string; fielder?: string }
  /** Retired not out: off the field but can come back in this innings. */
  retired?: boolean
}

export interface BowlerLine {
  id: string
  name: string
  balls: number
  runs: number
  wickets: number
  maidens: number
  dots: number
}

export interface BallMark {
  label: string
  tone: "dot" | "run" | "four" | "six" | "wicket" | "extra"
}

export interface OverLine {
  /** Bowler's name. */
  bowler: string
  balls: BallMark[]
  runs: number
}

export interface InningsState {
  batting: string
  bowling: string
  runs: number
  wickets: number
  legalBalls: number
  extras: { wd: number; nb: number; b: number; lb: number }
  batters: BatterLine[]
  bowlers: BowlerLine[]
  /** Player ids: [striker, non-striker]; null while waiting for a new batter. */
  crease: [string | null, string | null]
  /** Player id of the current bowler. */
  bowler: string | null
  lastOverBowler: string | null
  overs: OverLine[]
  fallOfWickets: { score: number; wicket: number; batter: string; over: string }[]
  freeHit: boolean
  complete: boolean
  /** What the scorer must pick before the next ball. */
  needs: "batter" | "bowler" | null
}

export const DISMISSALS: { kind: DismissalKind; label: string; bowlerCredit: boolean }[] = [
  { kind: "bowled", label: "Bowled", bowlerCredit: true },
  { kind: "caught", label: "Caught", bowlerCredit: true },
  { kind: "lbw", label: "LBW", bowlerCredit: true },
  { kind: "run-out", label: "Run out", bowlerCredit: false },
  { kind: "stumped", label: "Stumped", bowlerCredit: true },
  { kind: "hit-wicket", label: "Hit wicket", bowlerCredit: true },
]

/** "1 over", "5 overs" */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function oversText(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`
}

export function runRate(runs: number, legalBalls: number): string {
  return legalBalls ? ((runs * 6) / legalBalls).toFixed(2) : "0.00"
}

export function strikeRate(runs: number, balls: number): string {
  return balls ? ((runs * 100) / balls).toFixed(1) : "0.0"
}

function dismissalText(kind: DismissalKind, bowler: string, fielder?: string): string {
  switch (kind) {
    case "bowled": return `b ${bowler}`
    case "caught": return fielder ? `c ${fielder} b ${bowler}` : `c & b ${bowler}`
    case "lbw": return `lbw b ${bowler}`
    case "run-out": return fielder ? `run out (${fielder})` : "run out"
    case "stumped": return fielder ? `st ${fielder} b ${bowler}` : `st b ${bowler}`
    case "hit-wicket": return `hit wicket b ${bowler}`
  }
}

export function ballMark(ev: Extract<InningsEvent, { type: "ball" }>): BallMark {
  const extraLabel: Record<Extra, string> = { wd: "Wd", nb: "Nb", b: "B", lb: "Lb" }
  let label: string
  let tone: BallMark["tone"]
  if (!ev.extra) {
    label = ev.runs === 0 ? "•" : String(ev.runs)
    tone = ev.runs === 4 ? "four" : ev.runs === 6 ? "six" : ev.runs === 0 ? "dot" : "run"
  } else if (ev.extra === "wd" || ev.extra === "nb") {
    label = ev.runs ? `${ev.runs}${extraLabel[ev.extra]}` : extraLabel[ev.extra]
    tone = "extra"
  } else {
    label = `${ev.runs}${extraLabel[ev.extra]}`
    tone = "extra"
  }
  if (ev.wicket) {
    label = ev.runs ? `${ev.runs}W` : "W"
    tone = "wicket"
  }
  return { label, tone }
}

export function computeInnings(inn: Innings, match: Pick<Match, "overs" | "playersPerSide" | "roster">, target?: number): InningsState {
  const nameOf = (id: string) => match.roster[id] ?? id
  const s: InningsState = {
    batting: inn.batting,
    bowling: inn.bowling,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { wd: 0, nb: 0, b: 0, lb: 0 },
    batters: [],
    bowlers: [],
    crease: [null, null],
    bowler: null,
    lastOverBowler: null,
    overs: [],
    fallOfWickets: [],
    freeHit: false,
    complete: false,
    needs: "batter",
  }
  let overConceded = 0
  let current: OverLine | null = null

  const batter = (id: string) => {
    let b = s.batters.find((x) => x.id === id)
    if (!b) {
      b = { id, name: nameOf(id), runs: 0, balls: 0, fours: 0, sixes: 0 }
      s.batters.push(b)
    }
    return b
  }
  const bowlerLine = (id: string) => {
    let b = s.bowlers.find((x) => x.id === id)
    if (!b) {
      b = { id, name: nameOf(id), balls: 0, runs: 0, wickets: 0, maidens: 0, dots: 0 }
      s.bowlers.push(b)
    }
    return b
  }
  const swap = () => {
    s.crease = [s.crease[1], s.crease[0]]
  }

  for (const ev of inn.events) {
    if (ev.type === "retire") {
      const id = s.crease[ev.who === "striker" ? 0 : 1]
      if (!id) continue
      const line = batter(id)
      if (ev.kind === "out") {
        line.out = "retired out"
        s.wickets++
        s.fallOfWickets.push({ score: s.runs, wicket: s.wickets, batter: line.name, over: oversText(s.legalBalls) })
      } else {
        line.retired = true
      }
      s.crease = s.crease.map((n) => (n === id ? null : n)) as InningsState["crease"]
      continue
    }
    if (ev.type === "batter") {
      // A retired batter coming back carries on with the same runs and balls.
      batter(ev.id).retired = false
      if (s.crease[0] === null) s.crease[0] = ev.id
      else if (s.crease[1] === null) s.crease[1] = ev.id
      continue
    }
    if (ev.type === "swap") {
      swap()
      continue
    }
    if (ev.type === "bowler") {
      s.bowler = ev.id
      const bl = bowlerLine(ev.id)
      current = { bowler: bl.name, balls: [], runs: 0 }
      s.overs.push(current)
      overConceded = 0
      continue
    }

    // A delivery.
    const striker = s.crease[0]!
    const nonStriker = s.crease[1]!
    const bowl = bowlerLine(s.bowler!)
    const bat = batter(striker)
    const legal = ev.extra !== "wd" && ev.extra !== "nb"
    let total = ev.runs
    let conceded = 0

    switch (ev.extra) {
      case undefined:
        bat.runs += ev.runs
        bat.balls++
        conceded = ev.runs
        if (ev.runs === 4) bat.fours++
        if (ev.runs === 6) bat.sixes++
        break
      case "nb":
        total += 1
        s.extras.nb += 1
        bat.runs += ev.runs
        bat.balls++
        conceded = 1 + ev.runs
        if (ev.runs === 4) bat.fours++
        if (ev.runs === 6) bat.sixes++
        break
      case "wd":
        total += 1
        s.extras.wd += 1 + ev.runs
        conceded = 1 + ev.runs
        break
      case "b":
      case "lb":
        s.extras[ev.extra] += ev.runs
        bat.balls++
        break
    }

    s.runs += total
    bowl.runs += conceded
    overConceded += conceded
    if (legal) {
      s.legalBalls++
      bowl.balls++
      if (total === 0 && !ev.wicket) bowl.dots++
    }
    current?.balls.push(ballMark(ev))
    if (current) current.runs += total

    if (ev.runs % 2 === 1) swap()

    if (ev.wicket) {
      const outId = ev.wicket.out === "striker" ? striker : nonStriker
      const info = DISMISSALS.find((d) => d.kind === ev.wicket!.kind)!
      const outLine = batter(outId)
      outLine.out = dismissalText(ev.wicket.kind, bowl.name, ev.wicket.fielder ? nameOf(ev.wicket.fielder) : undefined)
      outLine.dismissal = { kind: ev.wicket.kind, bowler: bowl.id, fielder: ev.wicket.fielder }
      if (info.bowlerCredit) bowl.wickets++
      s.wickets++
      s.fallOfWickets.push({ score: s.runs, wicket: s.wickets, batter: outLine.name, over: oversText(s.legalBalls) })
      s.crease = s.crease.map((n) => (n === outId ? null : n)) as InningsState["crease"]
    }

    s.freeHit = ev.extra === "nb" || (s.freeHit && !legal)

    if (legal && s.legalBalls % 6 === 0) {
      if (overConceded === 0 && current && current.balls.length >= 6) bowl.maidens++
      swap()
      s.lastOverBowler = s.bowler
      s.bowler = null
    }
  }

  const allOut = s.wickets >= match.playersPerSide - 1
  const oversDone = s.legalBalls >= match.overs * 6
  const chased = target !== undefined && s.runs >= target
  s.complete = allOut || oversDone || chased
  s.needs = s.complete ? null : s.crease.includes(null) ? "batter" : s.bowler === null ? "bowler" : null
  return s
}

export interface MatchState {
  innings: InningsState[]
  current: InningsState | null
  target?: number
  result?: string
}

export function computeMatch(match: Match): MatchState {
  const states: InningsState[] = []
  match.innings.forEach((inn, i) => {
    const target = i === 1 && states[0] ? states[0].runs + 1 : undefined
    states.push(computeInnings(inn, match, target))
  })
  const target = states[0]?.complete ? states[0].runs + 1 : undefined
  let result: string | undefined
  const second = states[1]
  if (second?.complete && target !== undefined) {
    if (second.runs >= target) {
      const left = match.playersPerSide - 1 - second.wickets
      result = `${second.batting} won by ${left} wicket${left === 1 ? "" : "s"}`
    } else if (second.runs === target - 1) {
      result = "Match tied"
    } else {
      const by = target - 1 - second.runs
      result = `${states[0].batting} won by ${by} run${by === 1 ? "" : "s"}`
    }
  }
  return { innings: states, current: states[states.length - 1] ?? null, target, result }
}

export function battingFirst(m: Pick<Match, "teamA" | "teamB" | "tossWinner" | "tossChoice">): [string, string] {
  const other = m.tossWinner === m.teamA ? m.teamB : m.teamA
  return m.tossChoice === "bat" ? [m.tossWinner, other] : [other, m.tossWinner]
}

/** What a scorecard shows, for the scorer's Scorecard screen, viewers and the PDF. Read-only. */
export interface ScorecardData {
  match: Pick<Match, "teamA" | "teamB" | "overs" | "playersPerSide" | "tossWinner" | "tossChoice" | "createdAt">
  innings: InningsCard[]
  result?: string
  /** Player of the match, once it's finished. */
  award?: { name: string; line: string }
}

export interface InningsCard {
  batting: string
  bowling: string
  runs: number
  wickets: number
  legalBalls: number
  extras: InningsState["extras"]
  batters: (Pick<BatterLine, "id" | "name" | "runs" | "balls" | "fours" | "sixes" | "out" | "retired"> & { notOut?: boolean })[]
  bowlers: Pick<BowlerLine, "id" | "name" | "balls" | "maidens" | "runs" | "wickets">[]
  fallOfWickets: InningsState["fallOfWickets"]
  overs: OverLine[]
}

export function toScorecard(match: Match, st: MatchState): ScorecardData {
  return {
    match: {
      teamA: match.teamA,
      teamB: match.teamB,
      overs: match.overs,
      playersPerSide: match.playersPerSide,
      tossWinner: match.tossWinner,
      tossChoice: match.tossChoice,
      createdAt: match.createdAt,
    },
    result: st.result,
    ...(st.result ? awardOf(match) : {}),
    innings: st.innings.map((inn) => {
      const atCrease = new Set(inn.crease.filter(Boolean))
      return {
        batting: inn.batting,
        bowling: inn.bowling,
        runs: inn.runs,
        wickets: inn.wickets,
        legalBalls: inn.legalBalls,
        extras: inn.extras,
        batters: inn.batters.map(({ id, name, runs, balls, fours, sixes, out, retired }) => ({
          id,
          name,
          runs,
          balls,
          fours,
          sixes,
          ...(out ? { out } : {}),
          ...(retired ? { retired } : {}),
          ...(atCrease.has(id) ? { notOut: true } : {}),
        })),
        bowlers: inn.bowlers.map(({ id, name, balls, maidens, runs, wickets }) => ({ id, name, balls, maidens, runs, wickets })),
        fallOfWickets: inn.fallOfWickets,
        overs: inn.overs,
      }
    }),
  }
}

function awardOf(match: Match): { award?: ScorecardData["award"] } {
  const a = playerOfMatch(match)
  return a ? { award: { name: a.name, line: a.line } } : {}
}

/** The summary viewers receive after every ball, with the full scorecard for the Scorecard tab. */
export interface LiveSnapshot {
  matchId: string
  title: string
  batting: string
  bowling: string
  runs: number
  wickets: number
  overs: string
  maxOvers: number
  crr: string
  target?: number
  need?: string
  batters: { name: string; runs: number; balls: number; onStrike: boolean }[]
  bowler?: { name: string; figures: string }
  thisOver: BallMark[]
  freeHit: boolean
  result?: string
  inningsNo: number
  firstInnings?: string
  /** Full read-only scorecard. Missing from snapshots sent by older app versions. */
  card?: ScorecardData
  updatedAt: number
}

export function toSnapshot(match: Match, st: MatchState): LiveSnapshot | null {
  const cur = st.current
  if (!cur) return null
  const ballsLeft = match.overs * 6 - cur.legalBalls
  const need =
    st.target !== undefined && st.innings.length === 2 && !st.result
      ? `Need ${Math.max(0, st.target - cur.runs)} off ${ballsLeft} ball${ballsLeft === 1 ? "" : "s"}`
      : undefined
  const bowlerName = cur.bowler ?? cur.lastOverBowler
  const bl = cur.bowlers.find((b) => b.id === bowlerName)
  const first = st.innings[0]
  return {
    matchId: match.id,
    title: `${match.teamA} vs ${match.teamB}`,
    batting: cur.batting,
    bowling: cur.bowling,
    runs: cur.runs,
    wickets: cur.wickets,
    overs: oversText(cur.legalBalls),
    maxOvers: match.overs,
    crr: runRate(cur.runs, cur.legalBalls),
    target: st.innings.length === 2 ? st.target : undefined,
    need,
    batters: cur.crease
      .filter((n): n is string => n !== null)
      .map((n) => {
        const b = cur.batters.find((x) => x.id === n)!
        return { name: b.name, runs: b.runs, balls: b.balls, onStrike: cur.crease[0] === n }
      }),
    bowler: bl ? { name: bl.name, figures: `${oversText(bl.balls)}-${bl.maidens}-${bl.runs}-${bl.wickets}` } : undefined,
    thisOver: cur.overs[cur.overs.length - 1]?.balls ?? [],
    freeHit: cur.freeHit,
    result: st.result,
    inningsNo: st.innings.length,
    firstInnings: st.innings.length === 2 ? `${first.batting} ${first.runs}/${first.wickets} (${oversText(first.legalBalls)})` : undefined,
    card: toScorecard(match, st),
    updatedAt: Date.now(),
  }
}
