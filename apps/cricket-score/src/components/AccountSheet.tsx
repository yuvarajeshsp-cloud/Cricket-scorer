import { useState } from "react"
import { CircleUserRound, Cloud, CloudOff, LogOut, Mail, Pencil, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import type { Session } from "@supabase/supabase-js"
import {
  Button,
  cn,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Spinner,
} from "@rajesh-hub/ui"
import { isEmail, sendSignInEmail, signInWithGoogle, signOut, verifyCode } from "../account"
import { providerName, type Profile } from "../profile"
import { ProfileForm } from "./ProfileForm"
import type { SyncStatus } from "../sync"

export const CODE_LENGTH = 6

const STATUS: Record<SyncStatus, string> = {
  off: "Not syncing",
  syncing: "Syncing…",
  synced: "Matches saved online",
  offline: "No internet · will sync when back online",
  error: "Couldn't sync",
}

/** Header button + sheet: email sign-in for scorers, and their sync status once signed in. */
export function AccountSheet({
  session,
  status,
  lastSynced,
  error,
  onSyncNow,
  profile,
  onSaveProfile,
}: {
  session: Session | null | undefined
  status: SyncStatus
  lastSynced: Date | null
  error: string | null
  onSyncNow: () => void
  profile?: Profile | null
  onSaveProfile?: (name: string, phone: string) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const signedIn = Boolean(session)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="icon"
        className={cn("relative rounded-xl", signedIn && "text-brand-blue")}
        aria-label={signedIn ? "Account and sync" : "Sign in"}
        onClick={() => setOpen(true)}
      >
        <CircleUserRound />
        {signedIn ? (
          <span className={cn("absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background", status === "error" || status === "offline" ? "bg-gold" : "bg-teal")} />
        ) : null}
      </Button>
      <SheetContent side="bottom" className="mx-auto max-w-lg gap-4 rounded-t-3xl px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {session ? (
          <SignedIn
            session={session}
            status={status}
            lastSynced={lastSynced}
            error={error}
            onSyncNow={onSyncNow}
            profile={profile ?? null}
            onSaveProfile={onSaveProfile}
            onDone={() => setOpen(false)}
          />
        ) : (
          <SignIn inSheet onDone={() => setOpen(false)} />
        )}
      </SheetContent>
    </Sheet>
  )
}

/** inSheet: heading uses the sheet's title (required inside a sheet); off for pages like the group invite. */
export function SignIn({ onDone, inSheet = false }: { onDone: () => void; inSheet?: boolean }) {
  const [email, setEmail] = useState("")
  const [step, setStep] = useState<"email" | "code">("email")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (!isEmail(email)) return setError("Enter a valid email address.")
    setBusy(true)
    setError(null)
    try {
      await sendSignInEmail(email)
      setStep("code")
      setCode("")
      toast.success(`Code sent to ${email.trim()}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const verify = async (value = code) => {
    if (value.length !== CODE_LENGTH) return
    setBusy(true)
    setError(null)
    try {
      await verifyCode(email, value)
      toast.success("Signed in. Your matches are being saved online.")
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setCode("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {inSheet ? (
        <SheetHeader className="px-0">
          <SheetTitle className="text-xl">Sign in to save your matches</SheetTitle>
          <SheetDescription>
            Signed-in scorers get their matches, players and stats on every phone they sign in on, and can carry on scoring a match from another phone.
            Viewers never need to sign in.
          </SheetDescription>
        </SheetHeader>
      ) : (
        <div>
          <h2 className="text-lg font-bold">Sign in to join</h2>
          <p className="text-sm text-muted-foreground">Viewing a group needs a free account, so the group knows who you are.</p>
        </div>
      )}

      {step === "email" ? (
        <>
        <Button
          variant="outline"
          className="h-12 rounded-xl text-base font-semibold"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError(null)
            try {
              await signInWithGoogle()
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e))
            } finally {
              setBusy(false)
            }
          }}
        >
          <GoogleMark /> Continue with Google
        </Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or use your email <span className="h-px flex-1 bg-border" />
        </div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <Label htmlFor="signin-email">Email</Label>
          <Input
            id="signin-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl text-base"
            autoFocus
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="h-12 rounded-xl text-base font-semibold" disabled={busy}>
            {busy ? <Spinner /> : <Mail />} Email me a sign-in code
          </Button>
          <p className="text-xs text-muted-foreground">No password. We email you a {CODE_LENGTH}-digit code and a sign-in link; the first time also creates your account.</p>
        </form>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Enter the {CODE_LENGTH}-digit code sent to <span className="font-semibold">{email.trim()}</span>. Or open the email in this browser and tap <span className="font-semibold">Sign in</span>.
          </p>
          <div className="flex justify-center">
            <InputOTP
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(v) => {
                const digits = v.replace(/\D/g, "")
                setCode(digits)
                if (digits.length === CODE_LENGTH) void verify(digits)
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={busy}
              autoFocus
            >
              <InputOTPGroup>
                {Array.from({ length: CODE_LENGTH }, (_, i) => (
                  <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
          <Button className="h-12 rounded-xl text-base font-semibold" disabled={busy || code.length !== CODE_LENGTH} onClick={() => void verify()}>
            {busy ? <Spinner /> : null} Sign in
          </Button>
          <div className="flex justify-between">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setStep("email")}>
              Use a different email
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void send()}>
              Send a new code
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

function SignedIn({
  session,
  status,
  lastSynced,
  error,
  onSyncNow,
  profile,
  onSaveProfile,
  onDone,
}: {
  session: Session
  status: SyncStatus
  lastSynced: Date | null
  error: string | null
  onSyncNow: () => void
  profile: Profile | null
  onSaveProfile?: (name: string, phone: string) => Promise<unknown>
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const bad = status === "error" || status === "offline"
  return (
    <>
      <SheetHeader className="px-0">
        <SheetTitle className="text-xl">Your profile</SheetTitle>
        <SheetDescription className="break-all">Signed in as {session.user.email}</SheetDescription>
      </SheetHeader>
      {editing && onSaveProfile ? (
        <ProfileForm
          initial={{ name: profile?.name ?? providerName(session), phone: profile?.phone ?? "" }}
          email={session.user.email}
          onSave={async (n, ph) => {
            await onSaveProfile(n, ph)
            setEditing(false)
            toast.success("Profile saved")
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal to-brand-blue text-lg font-bold text-white">
            {(profile?.name || session.user.email || "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate text-base font-semibold">{profile?.name || "Add your name"}</p>
            <p className="truncate text-muted-foreground tabular-nums">{profile?.phone || "No phone number yet"}</p>
            <p className="truncate text-muted-foreground">{session.user.email}</p>
          </div>
          {onSaveProfile ? (
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
          ) : null}
        </div>
      )}
      <div className={cn("flex items-start gap-3 rounded-2xl p-4", bad ? "bg-gold/15" : "bg-secondary")}>
        {bad ? <CloudOff className="mt-0.5 size-5 shrink-0 text-gold" /> : <Cloud className="mt-0.5 size-5 shrink-0 text-teal" />}
        <div className="min-w-0 text-sm">
          <p className="font-semibold">{STATUS[status]}</p>
          {lastSynced && status !== "syncing" ? <p className="text-muted-foreground">Last synced {lastSynced.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p> : null}
          {status === "error" && error ? <p className="mt-1 break-words text-muted-foreground">{error}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Button variant="outline" className="h-12 rounded-xl font-semibold" disabled={status === "syncing"} onClick={onSyncNow}>
          <RefreshCw className={cn(status === "syncing" && "animate-spin")} /> Sync now
        </Button>
        <Button
          variant="ghost"
          className="h-12 rounded-xl text-destructive"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await signOut()
            setBusy(false)
            toast("Signed out. Matches already on this phone stay here.")
            onDone()
          }}
        >
          <LogOut /> Sign out
        </Button>
      </div>
    </>
  )
}

/** Google's "G" mark for the sign-in button. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
