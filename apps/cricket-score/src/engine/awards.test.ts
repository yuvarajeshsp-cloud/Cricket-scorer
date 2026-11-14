import { test } from "node:test"
import assert from "node:assert/strict"
import type { InningsEvent, Match } from "./types"
import { inSeason, leaderboards, playerOfMatch, seasonsOf } from "./awards"

const roster = Object.fromEntries("a b c d x y z k".split(" ").map((n) => [n, n.toUpperCase()]))
const ball = (runs: number, more: Partial<Extract<InningsEvent, { type: "ball" }>> = {}): InningsEvent => ({ type: "ball", runs, ...more })
const six = (r: number) => Array.from({ length: 6 }, () => ball(r))

function match(id: string, createdAt: string, first: InningsEvent[], second: InningsEvent[]): Match {
  return {
    id,
    createdAt,
    teamA: "A",
    teamB: "B",
    overs: 2,
    playersPerSide: 4,
    tossWinner: "A",
    tossChoice: "bat",
    squads: { A: ["a", "b", "c", "d"], B: ["x", "y", "z", "k"] },
    roster,
    innings: [
      { batting: "A", bowling: "B", events: [{ type: "batter", id: "a" }, { type: "batter", id: "b" }, { type: "bowler", id: "x" }, ...first] },
      { batting: "B", bowling: "A", events: [{ type: "batter", id: "x" }, { type: "batter", id: "y" }, { type: "bowler", id: "c" }, ...second] },
    ],
  }
}

// A: "a" scores 4s off the first over, then two wickets to "y" in the second. B chases with "x" hitting sixes.
const m1 = match(
  "m1",
  "2026-03-01T10:00:00Z",
  [...six(4), { type: "bowler", id: "y" }, ball(0, { wicket: { kind: "bowled", out: "striker" } }), { type: "batter", id: "c" }, ball(0, { wicket: { kind: "caught", out: "striker", fielder: "z" } }), { type: "batter", id: "d" }, ball(1), ball(0), ball(0), ball(0)],
  [ball(6), ball(6), ball(6), ball(6), ball(2)],
)

test("player of the match: most points, with the right line", () => {
  const a = playerOfMatch(m1)!
  // x: 26 runs (B won); y: 2 wickets = 50 points beats a's 24 runs
  assert.equal(a.id, "y")
  assert.equal(a.line, "2/1")
})

test("no award before the match is finished", () => {
  const unfinished = { ...m1, innings: [m1.innings[0]] }
  assert.equal(playerOfMatch(unfinished), null)
})

test("leaderboards: runs, wickets, awards; season filter", () => {
  const m2 = { ...match("m2", "2025-05-01T10:00:00Z", [...six(1)], []), innings: [match("m2", "2025-05-01T10:00:00Z", six(1), []).innings[0]] }
  const players = Object.entries(roster).map(([id, name]) => ({ id, name }))
  const all = leaderboards(players, [m1, m2])
  assert.equal(all.runs[0].id, "a") // 24 + 3 runs over two matches
  assert.equal(all.runs[0].stats.batting.runs, 27)
  assert.equal(all.wickets[0].id, "y")
  assert.deepEqual(all.awards, [{ id: "y", name: "Y", count: 1 }])
  assert.deepEqual(seasonsOf([m1, m2]), [2026, 2025])
  const only2025 = leaderboards(players, [m1, m2].filter((m) => inSeason(m, 2025)))
  assert.equal(only2025.wickets.length, 0)
  assert.equal(only2025.runs[0].stats.batting.runs, 3)
})
