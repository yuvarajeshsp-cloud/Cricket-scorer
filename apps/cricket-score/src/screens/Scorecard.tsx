import { useState } from "react"
import { FileDown } from "lucide-react"
import { toast } from "sonner"
import { Button, cn, Tabs, TabsList, TabsTrigger } from "@rajesh-hub/ui"
import { shareFile } from "@rajesh-hub/native"
import { oversText, runRate, strikeRate, type ScorecardData } from "../engine/score"
import { BallChip } from "../components/bits"
import { WhatsAppButton } from "../components/WhatsAppButton"
import { scorecardText } from "../engine/share-text"

/** The full scorecard. Read-only when there is no onOpenPlayer (viewers). */
export function Scorecard({ card, onOpenPlayer }: { card: ScorecardData; onOpenPlayer?: (id: string) => void }) {
  const { match } = card
  const [tab, setTab] = useState(String(card.innings.length - 1))
  const inn = card.innings[Number(tab)] ?? card.innings[card.innings.length - 1]
  if (!inn) return null
  const extras = inn.extras.wd + inn.extras.nb + inn.extras.b + inn.extras.lb

  return (
    <div className="flex flex-col gap-4 pb-24">
      <header>
        <h1 className="text-xl font-bold">Scorecard</h1>
        <p className="text-sm text-muted-foreground">
          {match.teamA} vs {match.teamB} · {match.overs} overs
        </p>
        {card.result ? <p className="mt-1 font-semibold text-teal">{card.result}</p> : null}
        <WhatsAppButton text={scorecardText(card)} className="mt-3 h-11 w-full rounded-2xl" label="Share scorecard on WhatsApp" />
        <PdfButton card={card} />
      </header>

      {card.innings.length > 1 ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-2xl">
            {card.innings.map((s, i) => (
              <TabsTrigger key={i} value={String(i)} className="rounded-xl">
                {s.batting} {s.runs}/{s.wickets}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <section className="overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        <div className="flex items-center justify-between bg-secondary px-4 py-3">
          <span className="font-bold">{inn.batting}</span>
          <span className="font-bold tabular-nums">
            {inn.runs}/{inn.wickets} <span className="text-sm font-medium text-muted-foreground">({oversText(inn.legalBalls)} ov · RR {runRate(inn.runs, inn.legalBalls)})</span>
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-2 text-left font-medium">Batter</th>
              <th className="px-1 text-right font-medium">R</th>
              <th className="px-1 text-right font-medium">B</th>
              <th className="px-1 text-right font-medium">4s</th>
              <th className="px-1 text-right font-medium">6s</th>
              <th className="px-4 text-right font-medium">SR</th>
            </tr>
          </thead>
          <tbody>
            {inn.batters.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <button type="button" disabled={!onOpenPlayer} onClick={() => onOpenPlayer?.(b.id)} className={cn("text-left font-semibold underline-offset-2 enabled:hover:underline", b.notOut && "text-teal")}>
                    {b.name}
                    {b.notOut ? "*" : ""}
                  </button>
                  <p className="text-xs text-muted-foreground">{b.out ?? (b.retired ? "retired not out" : b.notOut ? "not out" : "")}</p>
                </td>
                <td className="px-1 text-right font-bold tabular-nums">{b.runs}</td>
                <td className="px-1 text-right tabular-nums text-muted-foreground">{b.balls}</td>
                <td className="px-1 text-right tabular-nums">{b.fours}</td>
                <td className="px-1 text-right tabular-nums">{b.sixes}</td>
                <td className="px-4 text-right tabular-nums text-muted-foreground">{strikeRate(b.runs, b.balls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between border-t px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Extras</span>
          <span className="tabular-nums">
            <span className="font-bold">{extras}</span>{" "}
            <span className="text-muted-foreground">
              (wd {inn.extras.wd}, nb {inn.extras.nb}, b {inn.extras.b}, lb {inn.extras.lb})
            </span>
          </span>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-2 text-left font-medium">Bowler</th>
              <th className="px-1 text-right font-medium">O</th>
              <th className="px-1 text-right font-medium">M</th>
              <th className="px-1 text-right font-medium">R</th>
              <th className="px-1 text-right font-medium">W</th>
              <th className="px-4 text-right font-medium">Econ</th>
            </tr>
          </thead>
          <tbody>
            {inn.bowlers.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="px-4 py-2.5">
                  <button type="button" disabled={!onOpenPlayer} onClick={() => onOpenPlayer?.(b.id)} className="text-left font-semibold underline-offset-2 enabled:hover:underline">
                    {b.name}
                  </button>
                </td>
                <td className="px-1 text-right tabular-nums">{oversText(b.balls)}</td>
                <td className="px-1 text-right tabular-nums">{b.maidens}</td>
                <td className="px-1 text-right tabular-nums">{b.runs}</td>
                <td className="px-1 text-right font-bold tabular-nums">{b.wickets}</td>
                <td className="px-4 text-right tabular-nums text-muted-foreground">{runRate(b.runs, b.balls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {inn.fallOfWickets.length ? (
        <section className="rounded-3xl bg-card p-4 ring-1 ring-border">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fall of wickets</p>
          <div className="flex flex-wrap gap-2 text-sm">
            {inn.fallOfWickets.map((f) => (
              <span key={f.wicket} className="rounded-full bg-muted px-3 py-1 tabular-nums">
                {f.score}-{f.wicket} <span className="text-muted-foreground">({f.batter}, {f.over})</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {inn.overs.length ? (
        <section className="rounded-3xl bg-card p-4 ring-1 ring-border">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Over by over</p>
          <div className="flex flex-col gap-3">
            {[...inn.overs].reverse().map((o, ri) => {
              const i = inn.overs.length - ri
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-xs text-muted-foreground">
                    Ov {i}
                    <br />
                    <span className="font-semibold text-foreground">{o.runs} runs</span>
                  </span>
                  <div className="flex flex-1 flex-wrap gap-1">
                    {o.balls.map((m, j) => (
                      <BallChip key={j} mark={m} size="sm" />
                    ))}
                  </div>
                  <span className="max-w-24 truncate text-xs text-muted-foreground">{o.bowler}</span>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}

/** Full scorecard as a PDF: the share sheet on phones (WhatsApp, Drive, print), a download on computers. */
function PdfButton({ card }: { card: ScorecardData }) {
  const { match } = card
  const [busy, setBusy] = useState(false)
  const share = async () => {
    setBusy(true)
    try {
      // Loaded on tap so the PDF library doesn't slow down opening the app.
      const { scorecardPdf, scorecardFileName } = await import("../engine/scorecard-pdf")
      const title = `${match.teamA} vs ${match.teamB} scorecard`
      await shareFile(scorecardPdf(card), scorecardFileName(match), title, card.result ?? title)
    } catch (e) {
      toast.error(`Couldn't make the PDF: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="outline" className="mt-2 h-11 w-full rounded-2xl font-semibold" disabled={busy} onClick={() => void share()}>
      <FileDown /> {busy ? "Making PDF…" : "Share scorecard as PDF"}
    </Button>
  )
}
