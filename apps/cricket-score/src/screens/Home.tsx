import type React from "react"
import { ChevronRight, Eye, Plus, Radio, Trash2 } from "lucide-react"
import { Button, ModeToggle } from "@rajesh-hub/ui"
import type { Match } from "../engine/types"
import { computeMatch, oversText } from "../engine/score"
import { forgetWatched, useWatched } from "../watching"
import { plural } from "../engine/score"

export function Home({
  matches,
  currentId,
  onNew,
  onOpen,
  onDelete,
  account,
  groups,
}: {
  matches: Match[]
  currentId: string | null
  onNew: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  /** Sign-in / sync button for the header. */
  account?: React.ReactNode
  /** "Your groups" section (signed-in features). */
  groups?: React.ReactNode
}) {
  const sorted = [...matches].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const live = sorted.find((m) => m.id === currentId && !computeMatch(m).result)
  // Matches opened from a shared link (not ones this phone is scoring).
  const following = useWatched().filter((w) => !matches.some((m) => m.id === w.id))

  return (
    <div className="flex flex-col gap-5 pb-24">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-12 rounded-2xl shadow-sm" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal">Live scoring</p>
            <h1 className="text-2xl font-black tracking-tight">Cricket Score</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {account}
          <ModeToggle />
        </div>
      </header>

      <button
        type="button"
        onClick={onNew}
        className="relative flex items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-brand-blue p-5 text-left text-white shadow-lg"
      >
        <span className="pointer-events-none absolute -right-8 -bottom-12 size-40 rounded-full bg-white/5" />
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <Plus className="size-7" />
        </span>
        <span>
          <span className="block text-lg font-bold">New match</span>
          <span className="block text-sm text-white/75">Teams, overs and toss in under a minute</span>
        </span>
      </button>

      {live ? <MatchRow match={live} live onOpen={onOpen} /> : null}

      {following.length ? (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Matches you follow</p>
          {following.map((w) => (
            <div key={w.id} className="flex items-center gap-2 rounded-3xl bg-card p-4 ring-1 ring-border">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => (location.hash = `#/live/${w.id}`)}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-brand-blue">
                  <Eye className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{w.title}</span>
                  <span className="block truncate text-sm text-muted-foreground">{w.result ?? w.score}</span>
                </span>
              </button>
              <Button variant="ghost" size="icon" aria-label={`Remove ${w.title}`} onClick={() => void forgetWatched(w.id)}>
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      {groups}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent matches</p>
        </div>
        {sorted.filter((m) => m !== live).map((m) => (
          <MatchRow key={m.id} match={m} onOpen={onOpen} onDelete={onDelete} />
        ))}
        {!matches.length ? (
          <div className="rounded-3xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
            Your matches are saved on this phone and show up here.
          </div>
        ) : null}
      </section>
    </div>
  )
}

function MatchRow({ match, live, onOpen, onDelete }: { match: Match; live?: boolean; onOpen: (id: string) => void; onDelete?: (id: string) => void }) {
  const st = computeMatch(match)
  return (
    <div className="flex items-center gap-2 rounded-3xl bg-card p-4 ring-1 ring-border">
      <button type="button" className="flex min-w-0 flex-1 flex-col gap-1.5 text-left" onClick={() => onOpen(match.id)}>
        <span className="flex items-center gap-2">
          {live ? (
            <span className="flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">
              <Radio className="size-3" /> LIVE
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {new Date(match.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {plural(match.overs, "over")}
          </span>
        </span>
        {st.innings.map((s, i) => (
          <span key={i} className="flex justify-between gap-2 font-semibold">
            <span className="truncate">{s.batting}</span>
            <span className="shrink-0 tabular-nums">
              {s.runs}/{s.wickets} <span className="text-xs font-normal text-muted-foreground">({oversText(s.legalBalls)})</span>
            </span>
          </span>
        ))}
        {!st.innings.length ? <span className="font-semibold">{match.teamA} vs {match.teamB}</span> : null}
        {st.result ? <span className="text-sm font-medium text-teal">{st.result}</span> : null}
      </button>
      {onDelete && !live ? (
        <Button size="icon" variant="ghost" className="text-muted-foreground" aria-label="Delete match" onClick={() => onDelete(match.id)}>
          <Trash2 />
        </Button>
      ) : (
        <ChevronRight className="text-muted-foreground" />
      )}
    </div>
  )
}
