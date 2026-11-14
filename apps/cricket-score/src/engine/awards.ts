import type { Match } from "./types"
import { computeMatch, oversText } from "./score"
import { careerStats, teamOf, type CareerStats } from "./stats"

/**
 * Player of the match and season leaderboards, worked out from the matches
 * (nothing extra is stored).
 *
 * Player-of-the-match points: 1 per run, 25 per wicket, 10 per catch / run out /
 * stumping, 5 per maiden. Ties go to a player on the winning side, then to the
 * one with more runs.
 */

export interface MatchAward {
  id: string
  name: string
  team: string
  points: number
  /** e.g. "45 (30) & 2/18" */
  line: string
}

export function playerOfMatch(m: Match): MatchAward | null {
  const st = computeMatch(m)
  if (!st.result) return null
  const pts = new Map<string, { runs: number; balls: number; batted: boolean; notOut: boolean; wkts: number; conceded: number; bowled: boolean; field: number; maidens: number }>()
  const get = (id: string) => {
    let p = pts.get(id)
    if (!p) {
      p = { runs: 0, balls: 0, batted: false, notOut: false, wkts: 0, conceded: 0, bowled: false, field: 0, maidens: 0 }
      pts.set(id, p)
    }
    return p
  }
  for (const inn of st.innings) {
    for (const b of inn.batters) {
      const p = get(b.id)
      p.runs += b.runs
      p.balls += b.balls
      p.batted = true
      p.notOut = !b.out
      const d = b.dismissal
      if (d && d.kind !== "bowled" && d.kind !== "lbw" && d.kind !== "hit-wicket") {
        const fielder = d.fielder ?? (d.kind === "caught" ? d.bowler : undefined)
        if (fielder) get(fielder).field++
      }
    }
    for (const w of inn.bowlers) {
      const p = get(w.id)
      p.wkts += w.wickets
      p.conceded += w.runs
      p.maidens += w.maidens
      p.bowled = p.bowled || w.balls > 0
    }
  }
  const winner = st.result.match(/^(.*) won by/)?.[1]
  let best: MatchAward | null = null
  let bestRuns = -1
  for (const [id, p] of pts) {
    const points = p.runs + p.wkts * 25 + p.field * 10 + p.maidens * 5
    if (points <= 0) continue
    const team = teamOf(m, id) ?? ""
    const parts: string[] = []
    // Leave out "0* (0)" for a batter who never faced a ball.
    if (p.batted && (p.balls > 0 || !p.notOut)) parts.push(`${p.runs}${p.notOut ? "*" : ""} (${p.balls})`)
    if (p.bowled) parts.push(`${p.wkts}/${p.conceded}`)
    if (p.field) parts.push(`${p.field} ct/ro`)
    const cand: MatchAward = { id, name: m.roster[id] ?? id, team, points, line: parts.join(" & ") }
    const better =
      !best ||
      points > best.points ||
      (points === best.points && winner && team === winner && best.team !== winner) ||
      (points === best.points && (team === winner) === (best.team === winner) && p.runs > bestRuns)
    if (better) {
      best = cand
      bestRuns = p.runs
    }
  }
  return best
}

export interface Leader {
  id: string
  name: string
  stats: CareerStats
}

export interface Leaderboards {
  matches: number
  runs: Leader[]
  wickets: Leader[]
  sixes: Leader[]
  catches: Leader[]
  /** Player-of-the-match awards, most first. */
  awards: { id: string; name: string; count: number }[]
}

/** Matches played in a given year (null = all time). Season = calendar year. */
export const inSeason = (m: Match, year: number | null) => year === null || new Date(m.createdAt).getFullYear() === year

export function seasonsOf(matches: Match[]): number[] {
  return [...new Set(matches.map((m) => new Date(m.createdAt).getFullYear()))].sort((a, b) => b - a)
}

/** Top players across matches. players: id → name (the group's players; guests are left out). */
export function leaderboards(players: { id: string; name: string }[], matches: Match[], top = 5): Leaderboards {
  const finished = matches.filter((m) => computeMatch(m).innings.some((i) => i.legalBalls > 0))
  const rows: Leader[] = players.map((p) => ({ id: p.id, name: p.name, stats: careerStats(p.id, finished) })).filter((r) => r.stats.matches > 0)
  const by = (f: (s: CareerStats) => number, tie: (s: CareerStats) => number = () => 0) =>
    rows
      .filter((r) => f(r.stats) > 0)
      .sort((a, b) => f(b.stats) - f(a.stats) || tie(b.stats) - tie(a.stats))
      .slice(0, top)
  const count = new Map<string, number>()
  for (const m of matches) {
    const a = playerOfMatch(m)
    if (a) count.set(a.id, (count.get(a.id) ?? 0) + 1)
  }
  const names = new Map(players.map((p) => [p.id, p.name]))
  return {
    matches: finished.length,
    runs: by((s) => s.batting.runs, (s) => -s.batting.balls),
    wickets: by((s) => s.bowling.wickets, (s) => -s.bowling.runs),
    sixes: by((s) => s.batting.sixes),
    catches: by((s) => s.fielding.catches + s.fielding.runOuts + s.fielding.stumpings),
    awards: [...count.entries()]
      .filter(([id]) => names.has(id))
      .map(([id, n]) => ({ id, name: names.get(id)!, count: n }))
      .sort((a, b) => b.count - a.count)
      .slice(0, top),
  }
}

export const econText = (runs: number, balls: number) => (balls ? ((runs * 6) / balls).toFixed(2) : "—")
export { oversText }
