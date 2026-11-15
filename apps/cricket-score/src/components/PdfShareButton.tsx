import { useState } from "react"
import { FileDown } from "lucide-react"
import { toast } from "sonner"
import { Button, cn, Spinner } from "@rajesh-hub/ui"
import { shareFile } from "@rajesh-hub/native"
import type { Match } from "../engine/types"
import { computeMatch, toScorecard, type ScorecardData } from "../engine/score"

/**
 * Share a match's full scorecard as a PDF: the share sheet on phones (WhatsApp, Drive, print),
 * a download on computers. "full" is the wide button on the Scorecard; "icon" sits on a match row.
 */
export function PdfShareButton({
  card,
  match,
  variant = "full",
  className,
}: {
  card?: ScorecardData
  /** Pass a match instead of a card (e.g. from a list); the scorecard is worked out on tap. */
  match?: Match
  variant?: "full" | "icon"
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const share = async () => {
    setBusy(true)
    try {
      const data = card ?? (match ? toScorecard(match, computeMatch(match)) : null)
      if (!data) return
      // Loaded on tap so the PDF library doesn't slow down opening the app.
      const { scorecardPdf, scorecardFileName } = await import("../engine/scorecard-pdf")
      const title = `${data.match.teamA} vs ${data.match.teamB} scorecard`
      await shareFile(scorecardPdf(data), scorecardFileName(data.match), title, data.result ?? title)
    } catch (e) {
      toast.error(`Couldn't make the PDF: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }
  if (variant === "icon") {
    return (
      <Button
        size="icon"
        variant="ghost"
        className={cn("text-brand-blue", className)}
        aria-label="Share scorecard as PDF"
        title="Share scorecard as PDF"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation()
          void share()
        }}
      >
        {busy ? <Spinner /> : <FileDown />}
      </Button>
    )
  }
  return (
    <Button variant="outline" className={cn("h-11 w-full rounded-2xl font-semibold", className)} disabled={busy} onClick={() => void share()}>
      {busy ? <Spinner /> : <FileDown />} {busy ? "Making PDF…" : "Share scorecard as PDF"}
    </Button>
  )
}
