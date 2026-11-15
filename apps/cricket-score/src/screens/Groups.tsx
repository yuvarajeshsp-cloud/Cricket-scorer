import { useEffect, useMemo, useState } from "react"
import QRCode from "qrcode"
import { ArrowLeft, Bell, Check, ChevronRight, Copy, LogOut, MessageCircle, Pencil, Phone, Plus, RefreshCw, Trash2, UserCheck, UserPlus, Users } from "lucide-react"
import { toast } from "sonner"
import { Button, Input, Label, Spinner, Tabs, TabsList, TabsTrigger } from "@rajesh-hub/ui"
import type { Match } from "../engine/types"
import { computeMatch, oversText, plural, toScorecard } from "../engine/score"
import { careerStats, sr } from "../engine/stats"
import { econText, inSeason, leaderboards, playerOfMatch, seasonsOf, type Leader } from "../engine/awards"
import { whatsappUrl } from "../engine/share-text"
import { SectionLabel, Sheet } from "../components/bits"
import { SignIn } from "../components/AccountSheet"
import { PdfShareButton } from "../components/PdfShareButton"
import { useNotifyPermission } from "../alerts"
import { Scorecard } from "./Scorecard"
import { Avatar, PlayerProfile } from "./Players"
import {
  addGroupPlayer,
  asPlayer,
  claimPlayer,
  createGroup,
  deleteGroup,
  deleteGroupMatch,
  groupForInvite,
  inviteUrl,
  joinGroup,
  leaveGroup,
  removeGroupPlayer,
  resetInvite,
  updateGroupPlayer,
  useGroupData,
  type Group,
  type GroupMatch,
  type GroupPlayer,
} from "../groups"

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/* ------------------------------------------------------------------ Home section */

/** "Your groups" on Home: open a group or create one. */
export function GroupsSection({ signedIn, groups, onOpen, onCreated }: { signedIn: boolean; groups: Group[] | null; onOpen: (id: string) => void; onCreated: (g: Group) => void }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const notify = useNotifyPermission()

  if (!signedIn) {
    return (
      <section className="flex flex-col gap-2">
        <SectionLabel>Groups</SectionLabel>
        <p className="rounded-3xl border-2 border-dashed p-5 text-center text-sm text-muted-foreground">
          Sign in (top right) to create a group for the people you play with, or to join one from an invite link.
        </p>
      </section>
    )
  }

  const create = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const g = await createGroup(name)
      toast.success(`Group “${g.name}” created`)
      setCreating(false)
      setName("")
      onCreated(g)
    } catch (e) {
      toast.error(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your groups</p>
        <Button variant="link" size="sm" onClick={() => setCreating(true)}>
          <Plus /> New group
        </Button>
      </div>
      {groups === null ? (
        <div className="flex justify-center p-4">
          <Spinner />
        </div>
      ) : groups.length ? (
        groups.map((g) => (
          <button key={g.id} type="button" onClick={() => onOpen(g.id)} className="flex items-center gap-3 rounded-3xl bg-card p-4 text-left ring-1 ring-border">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-brand-blue">
              <Users className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{g.name}</span>
              <span className="block text-sm text-muted-foreground">{g.role === "admin" ? "Admin" : "Member"}</span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>
        ))
      ) : (
        <p className="rounded-3xl border-2 border-dashed p-5 text-center text-sm text-muted-foreground">
          No groups yet. Create one for your team or friends, then share the invite link on WhatsApp.
        </p>
      )}
      {groups?.length && notify.perm === "default" ? (
        <Button variant="outline" className="h-11 rounded-2xl" onClick={() => void notify.ask()}>
          <Bell /> Alert me when a group match starts or ends
        </Button>
      ) : null}

      <Sheet open={creating} onOpenChange={setCreating} title="New group" description="Everyone you invite sees the group's matches, live scores, players and stats.">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <Label htmlFor="group-name">Group name</Label>
          <Input id="group-name" placeholder="e.g. Sunday Cricket Club" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl text-base" autoFocus />
          <Button type="submit" className="h-12 rounded-xl text-base font-semibold" disabled={busy || !name.trim()}>
            {busy ? <Spinner /> : <Plus />} Create group
          </Button>
        </form>
      </Sheet>
    </section>
  )
}

/* ------------------------------------------------------------------ Group page */

const matchState = (m: Match) => {
  const st = computeMatch(m)
  const started = m.innings.some((i) => i.events.some((e) => e.type === "ball"))
  return { st, live: !st.result && started, notStarted: !started }
}

export function GroupPage({
  group,
  userId,
  onBack,
  onStartMatch,
  onChanged,
}: {
  group: Group
  userId: string
  onBack: () => void
  onStartMatch: () => void
  /** Group renamed, left or deleted: reload the list. */
  onChanged: () => void
}) {
  const { players, matches, members, error, reload, setPlayers } = useGroupData(group.id)
  const [tab, setTab] = useState<"matches" | "leaders" | "players" | "invite">("matches")
  const [openMatch, setOpenMatch] = useState<GroupMatch | null>(null)
  const [profile, setProfile] = useState<GroupPlayer | null>(null)
  const isAdmin = group.role === "admin"
  const allMatches = useMemo(() => (matches ?? []).map((m) => m.data), [matches])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, openMatch, profile])

  if (openMatch) {
    const st = computeMatch(openMatch.data)
    return (
      <div className="flex flex-col gap-3">
        <Button variant="ghost" className="self-start" onClick={() => setOpenMatch(null)}>
          <ArrowLeft /> {group.name}
        </Button>
        <Scorecard card={toScorecard(openMatch.data, st)} />
        {isAdmin ? (
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={async () => {
              if (!confirm("Delete this match from the group for everyone? It also leaves everyone's stats here.")) return
              try {
                await deleteGroupMatch(group.id, openMatch.id)
                toast("Match deleted from the group")
                setOpenMatch(null)
                void reload()
              } catch (e) {
                toast.error(errText(e))
              }
            }}
          >
            <Trash2 /> Delete from group (admins only)
          </Button>
        ) : null}
      </div>
    )
  }

  if (profile) {
    return (
      <PlayerProfile
        player={asPlayer(profile)}
        matches={allMatches}
        onBack={() => setProfile(null)}
        onRename={async (name) => {
          try {
            const p = await updateGroupPlayer(group.id, profile.id, name, profile.phone ?? "")
            setPlayers((list) => list?.map((x) => (x.id === p.id ? p : x)) ?? null)
            setProfile(p)
          } catch (e) {
            toast.error(errText(e))
          }
        }}
        onOpenMatch={(id) => {
          const m = matches?.find((x) => x.id === id)
          if (m) {
            setProfile(null)
            setOpenMatch(m)
          }
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <header className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onBack} aria-label="Back">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">
            {members ?? "…"} member{members === 1 ? "" : "s"} · {players?.length ?? "…"} players · {isAdmin ? "you're an admin" : "member"}
          </p>
        </div>
        <Button size="icon" variant="ghost" aria-label="Refresh" onClick={() => void reload()}>
          <RefreshCw />
        </Button>
      </header>

      <Button className="h-12 rounded-2xl text-base font-semibold" onClick={onStartMatch}>
        <Plus /> Start a match in this group
      </Button>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid h-11 w-full grid-cols-4 rounded-2xl">
          <TabsTrigger value="matches" className="rounded-xl">Matches</TabsTrigger>
          <TabsTrigger value="leaders" className="rounded-xl">Leaders</TabsTrigger>
          <TabsTrigger value="players" className="rounded-xl">Players</TabsTrigger>
          <TabsTrigger value="invite" className="rounded-xl">Invite</TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

      {tab === "matches" ? <GroupMatches matches={matches} onOpen={setOpenMatch} /> : null}
      {tab === "leaders" ? <GroupLeaders players={players} matches={allMatches} onOpen={setProfile} /> : null}
      {tab === "players" ? (
        <GroupPlayers group={group} userId={userId} players={players} matches={allMatches} setPlayers={setPlayers} onOpen={setProfile} reload={reload} />
      ) : null}
      {tab === "invite" ? <GroupInvite group={group} userId={userId} onChanged={onChanged} onBack={onBack} /> : null}
    </div>
  )
}

function GroupMatches({ matches, onOpen }: { matches: GroupMatch[] | null; onOpen: (m: GroupMatch) => void }) {
  if (matches === null)
    return (
      <div className="flex justify-center p-6">
        <Spinner />
      </div>
    )
  if (!matches.length)
    return <p className="rounded-3xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">No matches yet. Start one above; everyone in the group can follow it live.</p>
  const rows = matches.map((m) => ({ m, ...matchState(m.data) }))
  const live = rows.filter((r) => r.live || r.notStarted)
  const done = rows.filter((r) => !r.live && !r.notStarted).sort((a, b) => b.m.data.createdAt.localeCompare(a.m.data.createdAt))
  return (
    <div className="flex flex-col gap-4">
      {live.length ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>Live now</SectionLabel>
          {live.map((r) => (
            <MatchCard key={r.m.id} m={r.m.data} st={r.st} live onClick={() => (location.hash = `#/live/${r.m.id}`)} />
          ))}
        </section>
      ) : null}
      {done.length ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>Results</SectionLabel>
          {done.map((r) => (
            <MatchCard key={r.m.id} m={r.m.data} st={r.st} onClick={() => onOpen(r.m)} />
          ))}
        </section>
      ) : null}
    </div>
  )
}

function MatchCard({ m, st, live, onClick }: { m: Match; st: ReturnType<typeof computeMatch>; live?: boolean; onClick: () => void }) {
  const date = new Date(m.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })
  return (
    <div className="flex items-start gap-1 rounded-3xl bg-card p-4 ring-1 ring-border">
    <button type="button" onClick={onClick} className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
      <span className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {date} · {plural(m.overs, "over")}
        </span>
        {live ? (
          <span className="flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 font-bold text-white">
            <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE
          </span>
        ) : null}
      </span>
      {[m.teamA, m.teamB].map((t) => {
        const inn = st.innings.find((i) => i.batting === t)
        return (
          <span key={t} className="flex justify-between font-semibold">
            <span className="truncate">{t}</span>
            <span className="tabular-nums">{inn ? `${inn.runs}/${inn.wickets} (${oversText(inn.legalBalls)})` : "—"}</span>
          </span>
        )
      })}
      <span className="text-sm text-teal">{st.result ?? (live ? "Tap to watch live" : "Not started yet")}</span>
      {st.result ? <AwardLine m={m} /> : null}
    </button>
    {st.innings.length ? <PdfShareButton match={m} variant="icon" className="-mr-2 -mt-1" /> : null}
    </div>
  )
}

function GroupPlayers({
  group,
  userId,
  players,
  matches,
  setPlayers,
  onOpen,
  reload,
}: {
  group: Group
  userId: string
  players: GroupPlayer[] | null
  matches: Match[]
  setPlayers: (fn: (p: GroupPlayer[] | null) => GroupPlayer[] | null) => void
  onOpen: (p: GroupPlayer) => void
  reload: () => Promise<void>
}) {
  const [editing, setEditing] = useState<GroupPlayer | "new" | null>(null)
  const [sort, setSort] = useState<"runs" | "wickets" | "name">("runs")
  const rows = useMemo(() => (players ?? []).map((p) => ({ p, c: careerStats(p.id, matches) })), [players, matches])
  const mine = players?.find((p) => p.userId === userId)

  if (players === null)
    return (
      <div className="flex justify-center p-6">
        <Spinner />
      </div>
    )

  const sorted = [...rows].sort((a, b) =>
    sort === "name" ? a.p.name.localeCompare(b.p.name) : sort === "runs" ? b.c.batting.runs - a.c.batting.runs : b.c.bowling.wickets - a.c.bowling.wickets,
  )

  const claim = async (p: GroupPlayer) => {
    try {
      await claimPlayer(group.id, p.id)
      toast.success(`You're ${p.name} in ${group.name}`)
      await reload()
    } catch (e) {
      toast.error(errText(e))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" className="h-12 rounded-2xl font-semibold" onClick={() => setEditing("new")}>
        <UserPlus /> Add a player
      </Button>
      {!mine && players.length ? <p className="text-sm text-muted-foreground">Are you one of these players? Tap “This is me” so your stats follow you.</p> : null}
      <div className="flex gap-2">
        {(["runs", "wickets", "name"] as const).map((s) => (
          <Button key={s} size="sm" variant={sort === s ? "default" : "outline"} className="rounded-full capitalize" onClick={() => setSort(s)}>
            {s === "runs" ? "Most runs" : s === "wickets" ? "Most wickets" : "A–Z"}
          </Button>
        ))}
      </div>
      {!players.length ? <p className="rounded-3xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">No players yet. Add the people who play in this group.</p> : null}
      {sorted.map(({ p, c }) => (
        <div key={p.id} className="flex items-center gap-3 rounded-3xl bg-card p-3 ring-1 ring-border">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpen(p)}>
            <Avatar name={p.name} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="truncate">{p.name}</span>
                {p.userId === userId ? <span className="rounded-full bg-teal px-1.5 py-0.5 text-[10px] font-bold text-white">YOU</span> : null}
              </span>
              <span className="block text-xs text-muted-foreground">
                {c.matches} match{c.matches === 1 ? "" : "es"} · {c.batting.runs} runs · {c.bowling.wickets} wkts
              </span>
              {p.phone ? <span className="block text-xs text-muted-foreground tabular-nums">{p.phone}</span> : null}
            </span>
          </button>
          <div className="flex shrink-0 items-center">
            {p.phone ? (
              <>
                <Button size="icon" variant="ghost" aria-label={`Call ${p.name}`} asChild>
                  <a href={`tel:${p.phone}`}>
                    <Phone />
                  </a>
                </Button>
                <Button size="icon" variant="ghost" aria-label={`WhatsApp ${p.name}`} asChild>
                  <a href={`https://wa.me/${p.phone.replace(/[^\d]/g, "").replace(/^(?=\d{10}$)/, "91")}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle />
                  </a>
                </Button>
              </>
            ) : null}
            {!mine && !p.userId ? (
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => void claim(p)}>
                <UserCheck /> This is me
              </Button>
            ) : null}
            <Button size="icon" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}>
              <Pencil />
            </Button>
          </div>
        </div>
      ))}

      <PlayerForm
        open={editing !== null}
        player={editing === "new" ? null : editing}
        isAdmin={group.role === "admin"}
        onClose={() => setEditing(null)}
        onSave={async (name, phone) => {
          const p = editing === "new" ? await addGroupPlayer(group.id, name, phone) : await updateGroupPlayer(group.id, editing!.id, name, phone)
          setPlayers((list) => (editing === "new" ? [...(list ?? []), p] : (list ?? []).map((x) => (x.id === p.id ? p : x))))
          setEditing(null)
          toast.success(editing === "new" ? `${p.name} added` : "Saved")
        }}
        onRemove={async () => {
          if (editing === "new" || !editing) return
          await removeGroupPlayer(group.id, editing.id)
          setPlayers((list) => (list ?? []).filter((x) => x.id !== editing.id))
          setEditing(null)
          toast(`${editing.name} removed from the group (their past scores stay in old matches)`)
        }}
      />
    </div>
  )
}

/** Add or edit a group player's name and phone number. */
export function PlayerForm({
  open,
  player,
  isAdmin,
  onClose,
  onSave,
  onRemove,
  title,
}: {
  open: boolean
  player: GroupPlayer | null
  isAdmin?: boolean
  onClose: () => void
  onSave: (name: string, phone: string) => Promise<void>
  onRemove?: () => Promise<void>
  title?: string
}) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setName(player?.name ?? "")
      setPhone(player?.phone ?? "")
      setError(null)
    }
  }, [open, player])
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }
  const phoneOk = !phone.trim() || /^\+?[\d\s-]{6,16}$/.test(phone.trim())
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={title ?? (player ? `Edit ${player.name}` : "Add a player")}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim() && phoneOk) void run(() => onSave(name, phone))
        }}
      >
        <Label htmlFor="player-name">Name</Label>
        <Input id="player-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl text-base" autoFocus />
        <Label htmlFor="player-phone">Phone number (optional)</Label>
        <Input
          id="player-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="e.g. 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-12 rounded-xl text-base"
        />
        {!phoneOk ? <p className="text-sm text-destructive">Enter a phone number with 6–16 digits.</p> : null}
        <p className="text-xs text-muted-foreground">Everyone in the group can see phone numbers.</p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="h-12 rounded-xl text-base font-semibold" disabled={busy || !name.trim() || !phoneOk}>
          {busy ? <Spinner /> : <Check />} Save
        </Button>
        {player && isAdmin && onRemove ? (
          <Button type="button" variant="ghost" className="h-11 text-destructive" disabled={busy} onClick={() => void run(onRemove)}>
            <Trash2 /> Remove from group
          </Button>
        ) : null}
      </form>
    </Sheet>
  )
}

function GroupInvite({ group, userId, onChanged, onBack }: { group: Group; userId: string; onChanged: () => void; onBack: () => void }) {
  const [code, setCode] = useState(group.inviteCode)
  const [qr, setQr] = useState<string | null>(null)
  const url = inviteUrl(code)
  const isAdmin = group.role === "admin"
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M" }).then(setQr, () => setQr(null))
  }, [url])
  const text = `Join our cricket group “${group.name}” to follow every match live and see everyone's stats:\n${url}`

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Anyone with this link can join after signing in with their email. Members see all the group's matches, players, phone numbers and stats.</p>
      <div className="flex justify-center rounded-3xl bg-white p-4">{qr ? <img src={qr} alt="QR code for the group invite link" className="size-52" /> : <div className="size-52" />}</div>
      <p className="break-all rounded-2xl bg-muted p-3 text-sm">{url}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild className="h-12 rounded-2xl font-semibold">
          <a href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> WhatsApp
          </a>
        </Button>
        <Button
          variant="outline"
          className="h-12 rounded-2xl font-semibold"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
              toast.success("Link copied")
            } catch {
              toast.error("Couldn't copy. Long-press the link to copy it.")
            }
          }}
        >
          <Copy /> Copy link
        </Button>
      </div>
      {isAdmin ? (
        <Button
          variant="ghost"
          onClick={async () => {
            try {
              setCode(await resetInvite(group.id))
              toast.success("New link made. The old link no longer works.")
              onChanged()
            } catch (e) {
              toast.error(errText(e))
            }
          }}
        >
          <RefreshCw /> Make a new link (old one stops working)
        </Button>
      ) : null}
      <div className="mt-4 border-t pt-4">
        {isAdmin ? (
          <Button
            variant="ghost"
            className="w-full text-destructive"
            onClick={async () => {
              if (!confirm(`Delete “${group.name}” for everyone? Its shared matches and player list are deleted. Matches saved on scorers' phones stay there.`)) return
              try {
                await deleteGroup(group.id)
                toast(`“${group.name}” deleted`)
                onChanged()
                onBack()
              } catch (e) {
                toast.error(errText(e))
              }
            }}
          >
            <Trash2 /> Delete group
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="w-full text-destructive"
            onClick={async () => {
              if (!confirm(`Leave “${group.name}”? You can rejoin with an invite link.`)) return
              try {
                await leaveGroup(group.id, userId)
                toast(`You left “${group.name}”`)
                onChanged()
                onBack()
              } catch (e) {
                toast.error(errText(e))
              }
            }}
          >
            <LogOut /> Leave group
          </Button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Join from an invite link */

export function JoinGroup({ code, userId, onJoined }: { code: string; userId: string | null; onJoined: (groupId: string) => void }) {
  const [group, setGroup] = useState<{ id: string; name: string } | null | undefined>(undefined)
  const [step, setStep] = useState<"join" | "who">("join")
  const [players, setPlayers] = useState<GroupPlayer[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    groupForInvite(code).then(setGroup, () => setGroup(null))
  }, [code])

  const join = async () => {
    setBusy(true)
    try {
      const g = await joinGroup(code)
      const { groupPlayers } = await import("../groups")
      const list = await groupPlayers(g.id)
      setPlayers(list)
      if (list.some((p) => p.userId === userId)) onJoined(g.id)
      else setStep("who")
    } catch (e) {
      toast.error(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const done = () => (location.hash = "")

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col gap-5 p-4">
      <header className="flex items-center gap-3 pt-2">
        <img src="/favicon.svg" alt="" className="size-12 rounded-2xl" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal">Group invite</p>
          <h1 className="text-2xl font-black tracking-tight">{group === undefined ? "…" : group ? group.name : "Link not valid"}</h1>
        </div>
      </header>

      {group === null ? (
        <>
          <p className="text-muted-foreground">This invite link isn't valid any more. Ask the group admin for a new one.</p>
          <Button className="h-12 rounded-2xl" onClick={done}>
            Open Cricket Score
          </Button>
        </>
      ) : group === undefined ? (
        <Spinner />
      ) : !userId ? (
        <div className="flex flex-col gap-4 rounded-3xl bg-card p-4 ring-1 ring-border">
          <SignIn onDone={() => undefined} />
        </div>
      ) : step === "join" ? (
        <>
          <p className="text-muted-foreground">
            Join <span className="font-semibold text-foreground">{group.name}</span> to follow its matches live and see everyone's stats.
          </p>
          <Button className="h-14 rounded-2xl text-lg font-bold" disabled={busy} onClick={() => void join()}>
            {busy ? <Spinner /> : <Users />} Join group
          </Button>
          <Button variant="ghost" onClick={done}>
            Not now
          </Button>
        </>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-bold">Which player are you?</h2>
            <p className="text-sm text-muted-foreground">So your runs and wickets in this group are linked to you.</p>
          </div>
          <div className="flex flex-col gap-2">
            {(players ?? [])
              .filter((p) => !p.userId)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex items-center gap-3 rounded-3xl bg-card p-3 text-left ring-1 ring-border"
                  onClick={async () => {
                    try {
                      await claimPlayer(group.id, p.id)
                      toast.success(`Welcome, ${p.name}!`)
                      onJoined(group.id)
                    } catch (e) {
                      toast.error(errText(e))
                    }
                  }}
                >
                  <Avatar name={p.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    {p.phone ? <span className="block text-xs text-muted-foreground">{p.phone}</span> : null}
                  </span>
                  <span className="text-sm font-semibold text-brand-blue">This is me</span>
                </button>
              ))}
          </div>
          <Button variant="outline" className="h-12 rounded-2xl" onClick={() => setAdding(true)}>
            <UserPlus /> I'm not in the list
          </Button>
          <Button variant="ghost" onClick={() => onJoined(group.id)}>
            Skip for now
          </Button>
          <PlayerForm
            open={adding}
            player={null}
            title="Add yourself"
            onClose={() => setAdding(false)}
            onSave={async (name, phone) => {
              const p = await addGroupPlayer(group.id, name, phone)
              await claimPlayer(group.id, p.id)
              toast.success(`Welcome, ${p.name}!`)
              onJoined(group.id)
            }}
          />
        </>
      )}
    </main>
  )
}


function AwardLine({ m }: { m: Match }) {
  const a = useMemo(() => playerOfMatch(m), [m])
  if (!a) return null
  return (
    <span className="text-xs">
      <span className="font-semibold text-gold">★</span> <span className="font-semibold">{a.name}</span> <span className="text-muted-foreground">{a.line}</span>
    </span>
  )
}

/** Season leaderboards for a group: runs, wickets, sixes, fielding and player-of-the-match awards. */
function GroupLeaders({ players, matches, onOpen }: { players: GroupPlayer[] | null; matches: Match[]; onOpen: (p: GroupPlayer) => void }) {
  const seasons = useMemo(() => seasonsOf(matches), [matches])
  const [season, setSeason] = useState<number | null>(() => new Date().getFullYear())
  const year = season !== null && !seasons.includes(season) ? (seasons[0] ?? null) : season
  const board = useMemo(
    () => (players ? leaderboards(players, matches.filter((m) => inSeason(m, year))) : null),
    [players, matches, year],
  )
  if (!board)
    return (
      <div className="flex justify-center p-6">
        <Spinner />
      </div>
    )
  const open = (id: string) => {
    const p = players?.find((x) => x.id === id)
    if (p) onOpen(p)
  }
  const List = ({ title, rows, value, sub }: { title: string; rows: Leader[]; value: (l: Leader) => string; sub: (l: Leader) => string }) =>
    rows.length ? (
      <section className="overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        <p className="bg-secondary px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        {rows.map((l, i) => (
          <button key={l.id} type="button" onClick={() => open(l.id)} className="flex w-full items-center gap-3 border-t px-4 py-2.5 text-left first:border-0">
            <span className={i === 0 ? "w-5 font-black text-gold" : "w-5 font-semibold text-muted-foreground"}>{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{l.name}</span>
              <span className="block text-xs text-muted-foreground">{sub(l)}</span>
            </span>
            <span className="text-lg font-bold tabular-nums">{value(l)}</span>
          </button>
        ))}
      </section>
    ) : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {seasons.map((y) => (
          <Button key={y} size="sm" variant={year === y ? "default" : "outline"} className="rounded-full" onClick={() => setSeason(y)}>
            {y}
          </Button>
        ))}
        <Button size="sm" variant={year === null ? "default" : "outline"} className="rounded-full" onClick={() => setSeason(null)}>
          All time
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {board.matches} match{board.matches === 1 ? "" : "es"} {year === null ? "in all" : `in ${year}`}. Tap a player for their full record.
      </p>
      {!board.runs.length && !board.wickets.length ? (
        <p className="rounded-3xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
          {board.matches
            ? "No group players have scored yet. Leaderboards count the group's players (Players tab), not quick-pick placeholders like “Team A batter 1”."
            : "No scores yet. Leaderboards fill in as the group plays."}
        </p>
      ) : null}
      {board.awards.length ? (
        <section className="overflow-hidden rounded-3xl bg-card ring-1 ring-border">
          <p className="bg-secondary px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">★ Player of the match awards</p>
          {board.awards.map((a, i) => (
            <button key={a.id} type="button" onClick={() => open(a.id)} className="flex w-full items-center gap-3 border-t px-4 py-2.5 text-left first:border-0">
              <span className={i === 0 ? "w-5 font-black text-gold" : "w-5 font-semibold text-muted-foreground"}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{a.name}</span>
              <span className="text-lg font-bold tabular-nums">{a.count}</span>
            </button>
          ))}
        </section>
      ) : null}
      <List
        title="Most runs"
        rows={board.runs}
        value={(l) => String(l.stats.batting.runs)}
        sub={(l) => `${l.stats.batting.innings} inns · SR ${sr(l.stats.batting.runs, l.stats.batting.balls)} · best ${l.stats.batting.best ? `${l.stats.batting.best.runs}${l.stats.batting.best.notOut ? "*" : ""}` : "—"}`}
      />
      <List
        title="Most wickets"
        rows={board.wickets}
        value={(l) => String(l.stats.bowling.wickets)}
        sub={(l) => `Econ ${econText(l.stats.bowling.runs, l.stats.bowling.balls)} · best ${l.stats.bowling.best ? `${l.stats.bowling.best.wickets}/${l.stats.bowling.best.runs}` : "—"}`}
      />
      <List title="Most sixes" rows={board.sixes} value={(l) => String(l.stats.batting.sixes)} sub={(l) => `${l.stats.batting.fours} fours`} />
      <List
        title="Fielding (catches, run outs, stumpings)"
        rows={board.catches}
        value={(l) => String(l.stats.fielding.catches + l.stats.fielding.runOuts + l.stats.fielding.stumpings)}
        sub={(l) => `${l.stats.fielding.catches} ct · ${l.stats.fielding.runOuts} ro · ${l.stats.fielding.stumpings} st`}
      />
    </div>
  )
}
