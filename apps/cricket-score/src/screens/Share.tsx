import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Check, Copy, Eye, Globe, MonitorPlay, Smartphone, Wifi, X } from "lucide-react"
import { Badge, Button, cn } from "@rajesh-hub/ui"
import type { Match } from "../engine/types"
import type { MatchState } from "../engine/score"
import { liveScoreText } from "../engine/share-text"
import { WhatsAppButton } from "../components/WhatsAppButton"
import { SectionLabel } from "../components/bits"
import { Viewer } from "./Viewer"
import { isOnline, liveUrl, STATUS_TEXT } from "../live"
import { useLiveStatus } from "../live/useLiveStatus"

const MODES = [
  { key: "device", icon: Smartphone, title: "This device", text: "Viewer in another tab on this phone. Used when no Supabase project is set.", ready: !isOnline },
  { key: "online", icon: Globe, title: "Online", text: "Anyone, anywhere, through Supabase. No login.", ready: isOnline },
  { key: "ground", icon: Wifi, title: "Ground (hotspot)", text: "Phones at the ground join your hotspot. No internet needed.", ready: false },
] as const

export function Share({ match, state }: { match: Match; state: MatchState }) {
  const url = liveUrl(match.id)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const status = useLiveStatus()

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M" }).then(setQr, () => setQr(null))
  }, [url])

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  const waText = liveScoreText(match, state, url)

  return (
    <div className="flex flex-col gap-4 pb-24">
      <header>
        <h1 className="text-xl font-bold">Share live score</h1>
        <p className="text-sm text-muted-foreground">Viewers just open the link. No app, no login.</p>
      </header>

      <section className="flex flex-col items-center gap-4 rounded-3xl bg-card p-5 ring-1 ring-border">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="relative flex size-2.5">
            <span className={cn("absolute inline-flex size-full rounded-full opacity-60", status === "live" && "animate-ping bg-destructive", status === "offline" ? "bg-gold" : "bg-destructive")} />
            <span className={cn("relative inline-flex size-2.5 rounded-full", status === "offline" ? "bg-gold" : status === "local" ? "bg-muted-foreground" : "bg-destructive")} />
          </span>
          {STATUS_TEXT[status]}
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Match code <span className="font-mono tracking-widest">{match.id}</span>
        </p>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          {qr ? <img src={qr} alt="QR code for the live score link" className="size-52" /> : <div className="size-52" />}
        </div>
        <p className="text-center text-xs text-muted-foreground">Scan to watch live</p>
        <div className="grid w-full grid-cols-2 gap-2">
          <WhatsAppButton text={waText} className="h-12 rounded-2xl" />
          <Button variant="outline" className="h-12 rounded-2xl font-semibold" onClick={() => copy(url, "link")}>
            {copied === "link" ? <Check /> : <Copy />} {copied === "link" ? "Copied" : "Copy link"}
          </Button>
          <Button variant="secondary" className="h-12 rounded-2xl font-semibold" onClick={() => setPreview(true)}>
            <Eye /> Viewer preview
          </Button>
          <Button variant="secondary" className="h-12 rounded-2xl font-semibold" onClick={() => copy(liveUrl(match.id, "overlay"), "overlay")}>
            {copied === "overlay" ? <Check /> : <MonitorPlay />} {copied === "overlay" ? "Copied" : "Stream overlay"}
          </Button>
        </div>
      </section>

      <p className="break-all rounded-2xl bg-muted px-4 py-3 font-mono text-xs text-muted-foreground select-all">{url}</p>

      <section>
        <SectionLabel>Broadcast through</SectionLabel>
        <div className="flex flex-col gap-2">
          {MODES.map((m) => (
            <div key={m.key} className={cn("flex items-center gap-3 rounded-2xl bg-card p-4 ring-1", m.ready ? "ring-primary" : "ring-border opacity-70")}>
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", m.ready ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <m.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{m.title}</span>
                <span className="block text-xs text-muted-foreground">{m.text}</span>
              </span>
              {m.ready ? <Badge>On</Badge> : <Badge variant="outline">{m.key === "ground" ? "Later" : "Off"}</Badge>}
            </div>
          ))}
        </div>
      </section>

      {preview ? (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">
          <button
            type="button"
            onClick={() => setPreview(false)}
            aria-label="Close preview"
            className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2 flex size-10 items-center justify-center rounded-full bg-card shadow-lg ring-1 ring-border"
          >
            <X className="size-5" />
          </button>
          <div className="pb-20">
            <Viewer matchId={match.id} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
