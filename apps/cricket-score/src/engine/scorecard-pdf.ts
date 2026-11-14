import { jsPDF } from "jspdf"
import { oversText, runRate, strikeRate, type InningsCard, type ScorecardData } from "./score"

type RGB = [number, number, number]

/** A hub colour token (e.g. "navy") as RGB for the PDF, read from the page's CSS so it always matches the brand. */
function token(name: string): RGB {
  try {
    // @rajesh-hub/tokens defines the brand colours as --navy, --brand-blue, ... (Tailwind's --color-* are build-time only).
    const css = getComputedStyle(document.documentElement)
    const value = (css.getPropertyValue(`--${name}`) || css.getPropertyValue(`--color-${name}`)).trim()
    const ctx = document.createElement("canvas").getContext("2d")
    if (!value || !ctx) return [0, 0, 0]
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b]
  } catch {
    return [0, 0, 0]
  }
}

// Neutral greys for paper (not brand colours): rule lines, header bands and secondary text.
const GREY_TEXT: RGB = [110, 110, 110]
const GREY_LINE: RGB = [220, 220, 220]
const GREY_BAND: RGB = [243, 244, 246]

const PAGE_W = 210
const PAGE_H = 297
const M = 14 // margin
const W = PAGE_W - M * 2

interface Col {
  label: string
  width: number
  align?: "left" | "right"
}

export function scorecardFileName(match: ScorecardData["match"]): string {
  const slug = `${match.teamA}-vs-${match.teamB}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return `scorecard-${slug || "match"}-${match.createdAt.slice(0, 10)}.pdf`
}

/** The full scorecard (every innings) as an A4 PDF. */
export function scorecardPdf(card: ScorecardData): Blob {
  const { match } = card
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const navy = token("navy")
  const blue = token("brand-blue")
  const teal = token("teal")
  let y = M

  const ensure = (h: number) => {
    if (y + h > PAGE_H - M) {
      doc.addPage()
      y = M
    }
  }
  const text = (s: string, x: number, yy: number, opts: { size?: number; bold?: boolean; color?: RGB; align?: "left" | "right" | "center" } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal")
    doc.setFontSize(opts.size ?? 10)
    doc.setTextColor(...(opts.color ?? ([20, 20, 20] as RGB)))
    doc.text(s, x, yy, { align: opts.align ?? "left" })
  }
  const fit = (s: string, maxW: number) => {
    if (doc.getTextWidth(s) <= maxW) return s
    let t = s
    while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1)
    return `${t}…`
  }

  // Title band
  doc.setFillColor(...navy)
  doc.rect(0, 0, PAGE_W, 34, "F")
  text("SCORECARD", M, 11, { size: 9, bold: true, color: [255, 255, 255] })
  text(fit(`${match.teamA} vs ${match.teamB}`, W), M, 21, { size: 18, bold: true, color: [255, 255, 255] })
  const date = new Date(match.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  text(`${match.overs} overs · ${match.playersPerSide} a side · ${date}`, M, 29, { size: 9, color: [255, 255, 255] })
  y = 42
  if (card.result) {
    text(card.result, M, y, { size: 13, bold: true, color: teal })
    y += 8
  }
  const toss = `${match.tossWinner} won the toss and chose to ${match.tossChoice}`
  text(toss, M, y, { size: 9, color: GREY_TEXT })
  y += 8

  const table = (cols: Col[], rows: { cells: string[]; sub?: string; bold?: number[] }[]) => {
    const head = 6.5
    ensure(head + 8)
    doc.setFillColor(...GREY_BAND)
    doc.rect(M, y, W, head, "F")
    let x = M
    for (const c of cols) {
      const tx = c.align === "right" ? x + c.width - 2 : x + 2
      text(c.label, tx, y + 4.8, { size: 8, bold: true, color: GREY_TEXT, align: c.align === "right" ? "right" : "left" })
      x += c.width
    }
    y += head
    for (const r of rows) {
      const h = r.sub ? 8.6 : 6.6
      ensure(h)
      x = M
      r.cells.forEach((cell, i) => {
        const c = cols[i]
        const right = c.align === "right"
        doc.setFont("helvetica", r.bold?.includes(i) ? "bold" : "normal")
        doc.setFontSize(10)
        const s = right ? cell : fit(cell, c.width - 4)
        text(s, right ? x + c.width - 2 : x + 2, y + 4.4, { bold: r.bold?.includes(i), align: right ? "right" : "left" })
        x += c.width
      })
      if (r.sub) text(fit(r.sub, cols[0].width - 4), M + 2, y + 7.6, { size: 7.5, color: GREY_TEXT })
      y += h
      doc.setDrawColor(...GREY_LINE)
      doc.line(M, y, M + W, y)
    }
  }

  const innings = (inn: InningsCard, i: number) => {
    ensure(30)
    // Innings header
    doc.setFillColor(...blue)
    doc.rect(M, y, W, 9, "F")
    text(`${i === 0 ? "1st" : "2nd"} innings · ${inn.batting}`, M + 3, y + 6.2, { size: 11, bold: true, color: [255, 255, 255] })
    text(`${inn.runs}/${inn.wickets} (${oversText(inn.legalBalls)} ov · RR ${runRate(inn.runs, inn.legalBalls)})`, M + W - 3, y + 6.2, {
      size: 11,
      bold: true,
      color: [255, 255, 255],
      align: "right",
    })
    y += 12

    const nameW = W - 18 * 4 - 22
    table(
      [
        { label: "Batter", width: nameW },
        { label: "R", width: 18, align: "right" },
        { label: "B", width: 18, align: "right" },
        { label: "4s", width: 18, align: "right" },
        { label: "6s", width: 18, align: "right" },
        { label: "SR", width: 22, align: "right" },
      ],
      inn.batters.map((b) => ({
        cells: [`${b.name}${b.notOut ? "*" : ""}`, String(b.runs), String(b.balls), String(b.fours), String(b.sixes), strikeRate(b.runs, b.balls)],
        sub: b.out ?? (b.retired ? "retired not out" : b.notOut ? "not out" : undefined),
        bold: [0, 1],
      })),
    )
    const ex = inn.extras
    ensure(14)
    text("Extras", M + 2, y + 5, { size: 9, color: GREY_TEXT })
    text(`${ex.wd + ex.nb + ex.b + ex.lb}  (wd ${ex.wd}, nb ${ex.nb}, b ${ex.b}, lb ${ex.lb})`, M + W - 2, y + 5, { size: 9, align: "right" })
    y += 7
    text("Total", M + 2, y + 5, { size: 10, bold: true })
    text(`${inn.runs}/${inn.wickets}  (${oversText(inn.legalBalls)} overs)`, M + W - 2, y + 5, { size: 10, bold: true, align: "right" })
    y += 10

    if (inn.bowlers.length) {
      table(
        [
          { label: "Bowler", width: nameW },
          { label: "O", width: 18, align: "right" },
          { label: "M", width: 18, align: "right" },
          { label: "R", width: 18, align: "right" },
          { label: "W", width: 18, align: "right" },
          { label: "Econ", width: 22, align: "right" },
        ],
        inn.bowlers.map((b) => ({
          cells: [b.name, oversText(b.balls), String(b.maidens), String(b.runs), String(b.wickets), runRate(b.runs, b.balls)],
          bold: [0, 4],
        })),
      )
      y += 3
    }

    if (inn.fallOfWickets.length) {
      ensure(12)
      text("Fall of wickets", M + 2, y + 4, { size: 8, bold: true, color: GREY_TEXT })
      y += 6
      const fow = inn.fallOfWickets.map((f) => `${f.score}-${f.wicket} (${f.batter}, ${f.over})`).join(",  ")
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      const lines: string[] = doc.splitTextToSize(fow, W - 4)
      for (const line of lines) {
        ensure(5)
        text(line, M + 2, y + 3.5, { size: 9 })
        y += 5
      }
    }
    y += 5
  }

  card.innings.forEach(innings)

  // Footer on every page
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    text("Cricket Score", M, PAGE_H - 7, { size: 7.5, color: GREY_TEXT })
    text(`Page ${p} of ${pages}`, PAGE_W - M, PAGE_H - 7, { size: 7.5, color: GREY_TEXT, align: "right" })
  }

  return doc.output("blob")
}
