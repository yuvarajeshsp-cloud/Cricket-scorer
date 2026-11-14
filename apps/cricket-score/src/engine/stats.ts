import type { Match } from "./types"
import { computeMatch, oversText } from "./score"

export interface MatchPerformance {
  matchId: string
  date: string
  title: string
  team: string
  batting?: { runs: number; balls: number; notOut: boolean; fours: number; sixes: number }
  bowling?: { balls: number; runs: number; wickets: number; maidens: number }
  result?: string
}

export interface CareerStats {
  matches: number
  batting: {
    innings: number
    runs: number
    balls: number
    notOuts: number
    best: { runs: number; notOut: boolean } | null
    fours: number
    sixes: number
    fifties: number
    hundreds: number
    ducks: number
  }
  bowling: {
    innings: number
    balls: number
    runs: number
    wickets: number
    maidens: number
    dots: number
    best: { wickets: number; runs: number } | null
    threeWickets: number
    fiveWickets: number
  }
  fielding: { catches: number; runOuts: number; stumpings: number }
  recent: MatchPerformance[]
}

/** Every team the player is on in this match: their squads, or the sides they batted or bowled for. A common player is on both. */
export function teamsOf(match: Match, playerId: string): string[] {
  const teams = new Set<string>()
  for (const [team, ids] of Object.entries(match.squads)) if (ids.includes(playerId)) teams.add(team)
  for (const inn of match.innings)
    for (const ev of inn.events) {
      if (ev.type === "batter" && ev.id === playerId) teams.add(inn.batting)
      if (ev.type === "bowler" && ev.id === playerId) teams.add(inn.bowling)
    }
  return [...teams]
}

export function teamOf(match: Match, playerId: string): string | null {
  const t = teamsOf(match, playerId)
  return t.length ? t.join(" & ") : null
}

export const isCommon = (match: Match, playerId: string) => teamsOf(match, playerId).length > 1

export function careerStats(playerId: string, matches: Match[]): CareerStats {
  const c: CareerStats = {
    matches: 0,
    batting: { innings: 0, runs: 0, balls: 0, notOuts: 0, best: null, fours: 0, sixes: 0, fifties: 0, hundreds: 0, ducks: 0 },
    bowling: { innings: 0, balls: 0, runs: 0, wickets: 0, maidens: 0, dots: 0, best: null, threeWickets: 0, fiveWickets: 0 },
    fielding: { catches: 0, runOuts: 0, stumpings: 0 },
    recent: [],
  }
  const sorted = [...matches].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  for (const m of sorted) {
    const team = teamOf(m, playerId)
    if (!team) continue
    c.matches++
    const st = computeMatch(m)
    const perf: MatchPerformance = { matchId: m.id, date: m.createdAt, title: `${m.teamA} vs ${m.teamB}`, team, result: st.result }

    for (const inn of st.innings) {
      const bat = inn.batters.find((b) => b.id === playerId)
      if (bat) {
        const notOut = !bat.out
        const B = c.batting
        B.innings++
        B.runs += bat.runs
        B.balls += bat.balls
        B.fours += bat.fours
        B.sixes += bat.sixes
        if (notOut) B.notOuts++
        if (bat.runs >= 100) B.hundreds++
        else if (bat.runs >= 50) B.fifties++
        if (bat.runs === 0 && !notOut) B.ducks++
        if (!B.best || bat.runs > B.best.runs || (bat.runs === B.best.runs && notOut)) B.best = { runs: bat.runs, notOut }
        perf.batting = { runs: bat.runs, balls: bat.balls, notOut, fours: bat.fours, sixes: bat.sixes }
      }
      const bowl = inn.bowlers.find((b) => b.id === playerId)
      if (bowl) {
        const W = c.bowling
        W.innings++
        W.balls += bowl.balls
        W.runs += bowl.runs
        W.wickets += bowl.wickets
        W.maidens += bowl.maidens
        W.dots += bowl.dots
        if (bowl.wickets >= 5) W.fiveWickets++
        else if (bowl.wickets >= 3) W.threeWickets++
        if (!W.best || bowl.wickets > W.best.wickets || (bowl.wickets === W.best.wickets && bowl.runs < W.best.runs))
          W.best = { wickets: bowl.wickets, runs: bowl.runs }
        perf.bowling = { balls: bowl.balls, runs: bowl.runs, wickets: bowl.wickets, maidens: bowl.maidens }
      }
      for (const b of inn.batters) {
        if (b.dismissal?.fielder !== playerId) continue
        if (b.dismissal.kind === "caught") c.fielding.catches++
        if (b.dismissal.kind === "run-out") c.fielding.runOuts++
        if (b.dismissal.kind === "stumped") c.fielding.stumpings++
      }
      // Caught and bowled counts as a catch for the bowler.
      for (const b of inn.batters)
        if (b.dismissal?.kind === "caught" && !b.dismissal.fielder && b.dismissal.bowler === playerId) c.fielding.catches++
    }
    c.recent.push(perf)
  }
  return c
}

export const avg = (runs: number, outs: number) => (outs > 0 ? (runs / outs).toFixed(2) : "—")
export const econ = (runs: number, balls: number) => (balls ? ((runs * 6) / balls).toFixed(2) : "—")
export const sr = (runs: number, balls: number) => (balls ? ((runs * 100) / balls).toFixed(1) : "—")
export const bestBat = (b: CareerStats["batting"]["best"]) => (b ? `${b.runs}${b.notOut ? "*" : ""}` : "—")
export const bestBowl = (b: CareerStats["bowling"]["best"]) => (b ? `${b.wickets}/${b.runs}` : "—")
export { oversText }
