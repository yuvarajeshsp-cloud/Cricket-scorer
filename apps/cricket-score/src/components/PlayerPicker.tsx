import { useMemo, useState } from "react"
import { AlertTriangle, ArrowRightLeft, Check, Search, UserPlus, Users, X } from "lucide-react"
import { Button, cn, Input } from "@rajesh-hub/ui"
import type { Player } from "../engine/types"
import { SectionLabel } from "./bits"

export interface PickerSection {
  title: string
  players: Player[]
}

export interface PickResult {
  player: Player
  /** Not in the player list yet: the caller saves it. */
  isNew: boolean
  /** Keep them in their other team too (a common player for both sides). */
  common?: boolean
}

export interface PickWarning {
  title: string
  text: string
  /** Main button, e.g. "Move to Tigers". */
  confirm: string
  /** Second button that picks them as a common player, e.g. "Make common to both teams". */
  common?: string
}

/**
 * Pick a player: the team first, then everyone else on this phone, with
 * search and "add new". A pick that needs confirming (the player is on the
 * other team) shows a warning first.
 */
export function PlayerPicker({
  sections,
  everyone,
  tagOf,
  disabledReason,
  warningOf,
  selected,
  onPick,
  newPlayer,
  guestName,
}: {
  sections: PickerSection[]
  /** Every saved player; shown under "Other players" and searched. */
  everyone: Player[]
  /** Small label beside a name, e.g. the team they play for in this match. */
  tagOf?: (p: Player) => string | undefined
  disabledReason?: (p: Player) => string | undefined
  /** Text of the warning to confirm before this pick, if any. */
  warningOf?: (p: Player) => PickWarning | undefined
  selected?: Set<string>
  onPick: (r: PickResult) => void
  newPlayer: (name: string, guest?: boolean) => Player
  /** One-tap placeholder name, e.g. "Batter 3". */
  guestName?: string
}) {
  const [q, setQ] = useState("")
  const [pending, setPending] = useState<{ r: PickResult; w: PickWarning } | null>(null)

  const shownIds = new Set(sections.flatMap((s) => s.players.map((p) => p.id)))
  const others = everyone.filter((p) => !p.guest && !shownIds.has(p.id)).sort((a, b) => a.name.localeCompare(b.name))
  const query = q.trim().toLowerCase()
  const all = useMemo(() => {
    const seen = new Map<string, Player>()
    for (const s of sections) for (const p of s.players) seen.set(p.id, p)
    for (const p of everyone) if (!p.guest) seen.set(p.id, p)
    return [...seen.values()]
  }, [sections, everyone])
  const matches = query ? all.filter((p) => p.name.toLowerCase().includes(query)).sort((a, b) => a.name.localeCompare(b.name)) : []
  const exact = query ? all.find((p) => p.name.toLowerCase() === query) : undefined

  const attempt = (r: PickResult) => {
    const w = r.isNew ? undefined : warningOf?.(r.player)
    if (w) setPending({ r, w })
    else {
      setQ("")
      onPick(r)
    }
  }

  if (pending) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-3 rounded-2xl bg-gold/15 p-4 ring-1 ring-gold/40">
          <AlertTriangle className="size-6 shrink-0 text-gold" />
          <div>
            <p className="font-bold">{pending.w.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{pending.w.text}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            className="h-14 rounded-2xl text-base font-bold"
            onClick={() => {
              const r = pending.r
              setPending(null)
              setQ("")
              onPick(r)
            }}
          >
            <ArrowRightLeft /> {pending.w.confirm}
          </Button>
          {pending.w.common ? (
            <Button
              variant="secondary"
              className="h-14 rounded-2xl text-base font-bold"
              onClick={() => {
                const r = pending.r
                setPending(null)
                setQ("")
                onPick({ ...r, common: true })
              }}
            >
              <Users /> {pending.w.common}
            </Button>
          ) : null}
          <Button variant="ghost" className="h-12 rounded-2xl" onClick={() => setPending(null)}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  const row = (p: Player) => {
    const reason = disabledReason?.(p)
    const tag = tagOf?.(p)
    const on = selected?.has(p.id)
    return (
      <button
        key={p.id}
        type="button"
        disabled={!!reason}
        onClick={() => attempt({ player: p, isNew: false })}
        className={cn(
          "flex h-14 items-center gap-2 rounded-2xl px-3 text-left ring-1 disabled:opacity-40",
          on ? "bg-primary/15 ring-primary" : "bg-card ring-border",
        )}
      >
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          {on ? <Check className="size-4" /> : initials(p.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{p.name}</span>
          {reason || tag ? <span className="block truncate text-[11px] text-muted-foreground">{reason ?? tag}</span> : null}
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-12 rounded-2xl pl-10 pr-10 text-base"
          placeholder="Search or type a new name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query) attempt(exact ? { player: exact, isNew: false } : { player: newPlayer(q), isNew: true })
          }}
        />
        {q ? (
          <button type="button" aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground" onClick={() => setQ("")}>
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {query ? (
        <>
          <Button variant={exact ? "outline" : "default"} className="h-12 justify-start rounded-2xl" onClick={() => attempt({ player: newPlayer(q), isNew: true })}>
            <UserPlus /> {exact ? `Add another player called “${q.trim()}”` : `Add new player “${q.trim()}”`}
          </Button>
          {matches.length ? <div className="grid grid-cols-2 gap-2">{matches.map(row)}</div> : null}
        </>
      ) : (
        <>
          {sections.map((s) =>
            s.players.length ? (
              <div key={s.title}>
                <SectionLabel>{s.title}</SectionLabel>
                <div className="grid grid-cols-2 gap-2">{s.players.map(row)}</div>
              </div>
            ) : null,
          )}
          {others.length ? (
            <div>
              <SectionLabel>Other players</SectionLabel>
              <div className="grid grid-cols-2 gap-2">{others.map(row)}</div>
            </div>
          ) : null}
          {guestName ? (
            <Button variant="secondary" className="h-12 rounded-2xl" onClick={() => attempt({ player: newPlayer(guestName, true), isNew: true })}>
              Quick pick: {guestName}
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? ""))).toUpperCase()
}
