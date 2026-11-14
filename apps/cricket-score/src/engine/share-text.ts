import type { Match, Player } from "./types"
import { oversText, plural, runRate, type MatchState, type ScorecardData } from "./score"
import { avg, bestBat, bestBowl, econ, sr, type CareerStats } from "./stats"

/** Short live score for a WhatsApp message. */
export function liveScoreText(match: Match, st: MatchState, link?: string): string {
  const cur = st.current
  const lines = [`🏏 *${match.teamA} vs ${match.teamB}*`]
  if (st.innings.length === 2) {
    const f = st.innings[0]
    lines.push(`${f.batting} ${f.runs}/${f.wickets} (${oversText(f.legalBalls)})`)
  }
  if (cur) {
    lines.push(`*${cur.batting} ${cur.runs}/${cur.wickets}* (${oversText(cur.legalBalls)} ov) · CRR ${runRate(cur.runs, cur.legalBalls)}`)
    for (const id of cur.crease) {
      const b = cur.batters.find((x) => x.id === id)
      if (b) lines.push(`🏏 ${b.name}${id === cur.crease[0] ? "*" : ""} ${b.runs} (${b.balls})`)
    }
    const bl = cur.bowlers.find((b) => b.id === (cur.bowler ?? cur.lastOverBowler))
    if (bl) lines.push(`⚾ ${bl.name} ${oversText(bl.balls)}-${bl.maidens}-${bl.runs}-${bl.wickets}`)
    if (st.target !== undefined && st.innings.length === 2 && !st.result) {
      const left = match.overs * 6 - cur.legalBalls
      lines.push(`🎯 Need ${Math.max(0, st.target - cur.runs)} off ${left} ball${left === 1 ? "" : "s"}`)
    }
  }
  if (st.result) lines.push(`🏆 *${st.result}*`)
  if (link) lines.push("", `Live score: ${link}`)
  return lines.join("\n")
}

/** Full scorecard: both innings, top batters and bowlers. */
export function scorecardText(card: ScorecardData): string {
  const { match } = card
  const lines = [`🏏 *${match.teamA} vs ${match.teamB}* · ${plural(match.overs, "over")}`]
  if (card.result) lines.push(`🏆 *${card.result}*`)
  for (const inn of card.innings) {
    const ex = inn.extras.wd + inn.extras.nb + inn.extras.b + inn.extras.lb
    lines.push("", `*${inn.batting} ${inn.runs}/${inn.wickets}* (${oversText(inn.legalBalls)} ov)`)
    for (const b of inn.batters)
      lines.push(`${b.name}${b.out ? "" : "*"} ${b.runs} (${b.balls})${b.out ? ` — ${b.out}` : b.retired ? " — retired not out" : ""}`)
    lines.push(`Extras ${ex}`)
    lines.push("_Bowling_")
    for (const b of inn.bowlers) lines.push(`${b.name} ${oversText(b.balls)}-${b.maidens}-${b.runs}-${b.wickets}`)
  }
  return lines.join("\n")
}

export function playerText(p: Player, c: CareerStats): string {
  const B = c.batting
  const W = c.bowling
  const outs = B.innings - B.notOuts
  return [
    `🏏 *${p.name}* · ${c.matches} match${c.matches === 1 ? "" : "es"}`,
    `Batting: ${B.runs} runs · Avg ${avg(B.runs, outs)} · SR ${sr(B.runs, B.balls)} · Best ${bestBat(B.best)} · 4s ${B.fours} · 6s ${B.sixes}`,
    `Bowling: ${W.wickets} wkts · Econ ${econ(W.runs, W.balls)} · Best ${bestBowl(W.best)}`,
    `Fielding: ${c.fielding.catches} ct · ${c.fielding.runOuts} ro · ${c.fielding.stumpings} st`,
  ].join("\n")
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
