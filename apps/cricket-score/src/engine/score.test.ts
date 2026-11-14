// Scoring rules, checked against real match situations. Run: npm test (in apps/cricket-score).
import { test } from "node:test"
import assert from "node:assert/strict"
import type { InningsEvent, Match } from "./types"
import { computeInnings, computeMatch, toScorecard, toSnapshot } from "./score"

const roster = Object.fromEntries("a b c d e f g h i j k x y z".split(" ").map((n) => [n, n.toUpperCase()]))
const cfg = { overs: 2, playersPerSide: 4, roster }
const start: InningsEvent[] = [
  { type: "batter", id: "a" },
  { type: "batter", id: "b" },
  { type: "bowler", id: "x" },
]
const ball = (runs: number, more: Partial<Extract<InningsEvent, { type: "ball" }>> = {}): InningsEvent => ({ type: "ball", runs, ...more })
const inn = (events: InningsEvent[]) => computeInnings({ batting: "A", bowling: "B", events: [...start, ...events] }, cfg)

test("singles change strike; even runs don't", () => {
  const s = inn([ball(1)])
  assert.deepEqual(s.crease, ["b", "a"])
  assert.deepEqual(inn([ball(2)]).crease, ["a", "b"])
  assert.deepEqual(inn([ball(3)]).crease, ["b", "a"])
})

test("end of over: batters swap, bowler cleared, next over needs a bowler", () => {
  const s = inn([ball(0), ball(0), ball(0), ball(0), ball(0), ball(1)])
  assert.equal(s.legalBalls, 6)
  // single on the last ball swaps, then the over swaps back
  assert.deepEqual(s.crease, ["a", "b"])
  assert.equal(s.bowler, null)
  assert.equal(s.lastOverBowler, "x")
  assert.equal(s.needs, "bowler")
})

test("maiden over and dots", () => {
  const s = inn([ball(0), ball(0), ball(0), ball(0), ball(0), ball(0)])
  const x = s.bowlers[0]
  assert.equal(x.maidens, 1)
  assert.equal(x.dots, 6)
  assert.equal(s.overs[0].runs, 0)
})

test("byes keep a maiden; runs off the bat spoil it", () => {
  assert.equal(inn([ball(0), ball(1, { extra: "b" }), ball(0), ball(0), ball(0), ball(0)]).bowlers[0].maidens, 1)
  assert.equal(inn([ball(0), ball(1), ball(0), ball(0), ball(0), ball(0)]).bowlers[0].maidens, 0)
})

test("wide: 1 + runs to extras and bowler, not a legal ball, no batter ball", () => {
  const s = inn([ball(0, { extra: "wd" }), ball(2, { extra: "wd" })])
  assert.equal(s.runs, 4)
  assert.equal(s.extras.wd, 4)
  assert.equal(s.legalBalls, 0)
  assert.equal(s.bowlers[0].runs, 4)
  assert.equal(s.batters[0].balls, 0)
})

test("no-ball: 1 extra, bat runs to batter, ball faced, free hit next", () => {
  const s = inn([ball(4, { extra: "nb" })])
  assert.equal(s.runs, 5)
  assert.equal(s.extras.nb, 1)
  assert.equal(s.batters[0].runs, 4)
  assert.equal(s.batters[0].fours, 1)
  assert.equal(s.batters[0].balls, 1)
  assert.equal(s.legalBalls, 0)
  assert.equal(s.freeHit, true)
  // a wide keeps the free hit; a legal ball uses it up
  assert.equal(inn([ball(0, { extra: "nb" }), ball(0, { extra: "wd" })]).freeHit, true)
  assert.equal(inn([ball(0, { extra: "nb" }), ball(0)]).freeHit, false)
})

test("byes and leg byes: extras, legal ball, batter faces it, bowler not charged", () => {
  const s = inn([ball(2, { extra: "lb" }), ball(1, { extra: "b" })])
  assert.equal(s.runs, 3)
  assert.equal(s.extras.lb, 2)
  assert.equal(s.extras.b, 1)
  assert.equal(s.legalBalls, 2)
  assert.equal(s.bowlers[0].runs, 0)
  assert.equal(s.batters.find((b) => b.id === "a")!.balls, 2)
})

test("wickets: bowler credit except run out; fall of wickets; new batter needed", () => {
  const s = inn([ball(0, { wicket: { kind: "caught", out: "striker", fielder: "y" } })])
  assert.equal(s.wickets, 1)
  assert.equal(s.bowlers[0].wickets, 1)
  assert.equal(s.batters[0].out, "c Y b X")
  assert.deepEqual(s.fallOfWickets, [{ score: 0, wicket: 1, batter: "A", over: "0.1" }])
  assert.equal(s.needs, "batter")
  const r = inn([ball(1, { wicket: { kind: "run-out", out: "non-striker", fielder: "z" } })])
  assert.equal(r.bowlers[0].wickets, 0)
  assert.equal(r.runs, 1)
  assert.equal(r.batters.find((b) => b.id === "b")!.out, "run out (Z)")
})

test("new batter after a catch takes strike", () => {
  const s = inn([ball(0, { wicket: { kind: "caught", out: "striker", fielder: "y" } }), { type: "batter", id: "c" }])
  assert.deepEqual(s.crease, ["c", "b"])
})

test("all out at playersPerSide - 1 wickets completes the innings", () => {
  const out = (id: string): InningsEvent[] => [ball(0, { wicket: { kind: "bowled", out: "striker" } }), { type: "batter", id }]
  const s = inn([...out("c"), ...out("d"), ball(0, { wicket: { kind: "bowled", out: "striker" } })])
  assert.equal(s.wickets, 3)
  assert.equal(s.complete, true)
  assert.equal(s.needs, null)
})

test("overs used up completes the innings", () => {
  const over = [ball(1), ball(1), ball(1), ball(1), ball(1), ball(1)]
  const s = inn([...over, { type: "bowler", id: "y" }, ...over])
  assert.equal(s.legalBalls, 12)
  assert.equal(s.complete, true)
  assert.equal(s.runs, 12)
})

test("retired not out can return with the same score; retired out is a wicket", () => {
  const s = inn([ball(4), { type: "retire", who: "striker", kind: "not-out" }, { type: "batter", id: "c" }, ball(1)])
  assert.equal(s.wickets, 0)
  assert.equal(s.batters.find((b) => b.id === "a")!.retired, true)
  const back = inn([ball(4), { type: "retire", who: "striker", kind: "not-out" }, { type: "batter", id: "c" }, ball(0, { wicket: { kind: "bowled", out: "striker" } }), { type: "batter", id: "a" }])
  const a = back.batters.find((b) => b.id === "a")!
  assert.equal(a.retired, false)
  assert.equal(a.runs, 4)
  const ro = inn([{ type: "retire", who: "non-striker", kind: "out" }])
  assert.equal(ro.wickets, 1)
  assert.equal(ro.batters.find((b) => b.id === "b")!.out, "retired out")
  assert.equal(ro.bowlers[0].wickets, 0)
  assert.deepEqual(ro.fallOfWickets.map((f) => f.batter), ["B"])
})

const match = (first: InningsEvent[], second: InningsEvent[]): Match => ({
  id: "m1",
  createdAt: "2026-11-14T00:00:00Z",
  teamA: "A",
  teamB: "B",
  overs: 2,
  playersPerSide: 4,
  tossWinner: "A",
  tossChoice: "bat",
  squads: { A: ["a", "b", "c", "d"], B: ["x", "y", "z", "k"] },
  roster,
  innings: [
    { batting: "A", bowling: "B", events: [...start, ...first] },
    ...(second.length ? [{ batting: "B", bowling: "A", events: second }] : []),
  ],
})
const chaseStart: InningsEvent[] = [{ type: "batter", id: "x" }, { type: "batter", id: "y" }, { type: "bowler", id: "a" }]
const sixOver = (r: number) => Array.from({ length: 6 }, () => ball(r))

test("chase reached mid-over: innings complete, won by wickets", () => {
  const m = match([...sixOver(1), { type: "bowler", id: "y" }, ...sixOver(1)], [...chaseStart, ball(6), ball(6), ball(1)])
  const st = computeMatch(m)
  assert.equal(st.target, 13)
  assert.equal(st.innings[1].complete, true)
  assert.equal(st.result, "B won by 3 wickets")
})

test("defended total: won by runs; tie", () => {
  const first = [...sixOver(1), { type: "bowler", id: "y" } as InningsEvent, ...sixOver(1)]
  const lose = computeMatch(match(first, [...chaseStart, ...sixOver(0), { type: "bowler", id: "b" }, ...sixOver(1)]))
  assert.equal(lose.result, "A won by 6 runs")
  const tie = computeMatch(match(first, [...chaseStart, ...sixOver(1), { type: "bowler", id: "b" }, ...sixOver(1)]))
  assert.equal(tie.result, "Match tied")
})

test("live snapshot carries the full scorecard and stays small", () => {
  const m = match([...sixOver(1)], [])
  const st = computeMatch(m)
  const snap = toSnapshot(m, st)!
  assert.equal(snap.runs, 6)
  assert.equal(snap.card?.innings.length, 1)
  assert.ok(JSON.stringify(snap).length < 64 * 1024)
  assert.deepEqual(toScorecard(m, st).innings[0].batters.filter((b) => b.notOut).map((b) => b.id).sort(), ["a", "b"])
})
