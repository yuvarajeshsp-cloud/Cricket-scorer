import { useEffect, useState } from "react"
import { ArrowLeft, Radio, Smartphone, Zap } from "lucide-react"
import { Capacitor } from "@capacitor/core"
import { cn, Tabs, TabsList, TabsTrigger } from "@rajesh-hub/ui"
import { Scorecard } from "./Scorecard"
import { plural, type LiveSnapshot } from "../engine/score"
import { live } from "../live"
import { BallChip, EmptyBall } from "../components/bits"
import { openInAppLink } from "../deep-link"
import { rememberWatched } from "../watching"

/** In a phone's browser: open this match in the installed app. In the app: go back to scoring. */
function ViewerActions({ matchId }: { matchId: string }) {
  if (Capacitor.isNativePlatform()) {
    return (
      <button
        type="button"
        onClick={() => {
          location.hash = ""
        }}
        className="inline-flex items-center gap-1.5 self-center rounded-full border px-4 py-2 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" /> Back to scoring
      </button>
    )
  }
  const link = openInAppLink(matchId)
  if (!link) return null
  return (
    <a href={link.href} className="inline-flex items-center gap-1.5 self-center rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white">
      <Smartphone className="size-4" /> {link.label}
    </a>
  )
}

function useLive(matchId: string) {
  const [snap, setSnap] = useState<LiveSnapshot | null>(null)
  useEffect(() => live.subscribe(matchId, setSnap), [matchId])
  return snap
}

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  return s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`
}

/** What anyone with the link sees. No login, no install. */
export function Viewer({ matchId }: { matchId: string }) {
  const snap = useLive(matchId)
  const [view, setView] = useState<"live" | "card">("live")
  // Keep it on Home's list, so it can be reopened without the link.
  useEffect(() => {
    void rememberWatched(matchId, snap)
  }, [matchId, snap])
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(t)
  }, [])

  if (!snap) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
        <Radio className="size-10 animate-pulse text-brand-blue" />
        <p className="text-lg font-semibold">Waiting for the scorer…</p>
        <p className="max-w-xs text-sm text-muted-foreground">The score appears here as soon as the first ball is scored.</p>
        <ViewerActions matchId={matchId} />
      </div>
    )
  }

  const legal = snap.thisOver.filter((m) => !/Wd|Nb/.test(m.label)).length
  const showCard = view === "card" && snap.card

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <p className="truncate font-semibold">{snap.title}</p>
        <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white", snap.result ? "bg-teal" : "bg-destructive")}>
          {snap.result ? "FINAL" : (<><span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE</>)}
        </span>
      </header>

      {snap.card ? (
        <Tabs value={view} onValueChange={(v) => setView(v as "live" | "card")}>
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-2xl">
            <TabsTrigger value="live" className="rounded-xl">Live</TabsTrigger>
            <TabsTrigger value="card" className="rounded-xl">Scorecard</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {showCard ? (
        // Same scorecard the scorer sees, read-only (no player links, nothing to edit).
        <Scorecard card={snap.card!} />
      ) : (
      <>

      <section className="rounded-3xl bg-gradient-to-br from-navy to-brand-blue p-6 text-white shadow-lg">
        <p className="text-sm font-semibold text-white/80">{snap.batting}</p>
        <div className="flex items-end justify-between">
          <p className="text-6xl font-black tabular-nums leading-none tracking-tight">
            {snap.runs}
            <span className="text-white/60">/{snap.wickets}</span>
          </p>
          <p className="text-right">
            <span className="block text-3xl font-bold tabular-nums">{snap.overs}</span>
            <span className="text-xs text-white/70">of {plural(snap.maxOvers, "over")}</span>
          </p>
        </div>
        <p className="mt-3 text-sm text-white/80">
          CRR {snap.crr}
          {snap.target ? ` · Target ${snap.target}` : ""}
        </p>
        {snap.need ? <p className="mt-2 rounded-xl bg-white/10 px-3 py-2 font-semibold">{snap.need}</p> : null}
        {snap.result ? <p className="mt-2 rounded-xl bg-white/15 px-3 py-2 text-lg font-bold">{snap.result}</p> : null}
        {snap.firstInnings ? <p className="mt-2 text-xs text-white/70">1st innings: {snap.firstInnings}</p> : null}
      </section>

      <section className="rounded-3xl bg-card p-2 ring-1 ring-border">
        {snap.batters.map((b) => (
          <div key={b.name} className={cn("flex items-center justify-between rounded-2xl px-3 py-3", b.onStrike && "bg-secondary")}>
            <span className="flex items-center gap-2 font-semibold">
              <span className={cn("size-2 rounded-full", b.onStrike ? "bg-teal" : "bg-transparent")} />
              {b.name}
            </span>
            <span className="tabular-nums">
              <span className="text-lg font-bold">{b.runs}</span>
              <span className="text-sm text-muted-foreground"> ({b.balls})</span>
            </span>
          </div>
        ))}
        {snap.bowler ? (
          <div className="flex justify-between border-t px-3 pt-3 pb-2 text-sm">
            <span className="text-muted-foreground">
              Bowling: <span className="font-semibold text-foreground">{snap.bowler.name}</span>
            </span>
            <span className="font-semibold tabular-nums">{snap.bowler.figures}</span>
          </div>
        ) : null}
      </section>

      <section className="flex items-center gap-2 rounded-3xl bg-card px-4 py-4 ring-1 ring-border">
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {snap.thisOver.map((m, i) => (
            <BallChip key={i} mark={m} size="lg" />
          ))}
          {Array.from({ length: Math.max(0, 6 - legal) }).map((_, i) => (
            <EmptyBall key={i} size="lg" />
          ))}
        </div>
        {snap.freeHit ? (
          <span className="flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-white">
            <Zap className="size-3" /> Free hit
          </span>
        ) : null}
      </section>

      </>
      )}

      <div className="mt-auto flex flex-col items-center gap-3 pt-4">
        <ViewerActions matchId={matchId} />
        <p className="text-center text-xs text-muted-foreground">Updated {ago(snap.updatedAt, now)}</p>
      </div>
    </div>
  )
}

/** Thin score strip for OBS / YouTube streams. The page background is transparent. */
export function Overlay({ matchId }: { matchId: string }) {
  const snap = useLive(matchId)
  useEffect(() => {
    document.documentElement.style.background = "transparent"
    document.body.style.background = "transparent"
  }, [])
  if (!snap) return null
  const striker = snap.batters.find((b) => b.onStrike)
  const other = snap.batters.find((b) => !b.onStrike)
  return (
    <div className="fixed inset-x-0 bottom-6 flex justify-center px-4">
      <div className="flex items-stretch overflow-hidden rounded-2xl text-white shadow-2xl">
        <div className="flex items-center gap-3 bg-navy px-4 py-2">
          <span className="text-sm font-bold uppercase">{snap.batting}</span>
          <span className="text-2xl font-black tabular-nums">
            {snap.runs}-{snap.wickets}
          </span>
          <span className="text-sm tabular-nums text-white/75">{snap.overs}</span>
        </div>
        <div className="hidden items-center gap-4 bg-brand-blue px-4 text-sm sm:flex">
          {striker ? <span className="font-semibold">{striker.name}* {striker.runs} ({striker.balls})</span> : null}
          {other ? <span className="text-white/80">{other.name} {other.runs} ({other.balls})</span> : null}
        </div>
        <div className="flex items-center gap-1 bg-teal px-3">
          {snap.thisOver.map((m, i) => (
            <BallChip key={i} mark={m} size="sm" />
          ))}
        </div>
        {snap.need ? <div className="hidden items-center bg-gold px-4 text-sm font-semibold md:flex">{snap.need}</div> : null}
      </div>
    </div>
  )
}
