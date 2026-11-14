import { useState } from "react"
import { CircleUserRound, Cloud, CloudOff, LogOut, Mail, RefreshCw } from "lucide-react"
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
import { isEmail, sendSignInEmail, signOut, verifyCode } from "../account"
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
}: {
  session: Session | null | undefined
  status: SyncStatus
  lastSynced: Date | null
  error: string | null
  onSyncNow: () => void
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
          <SignedIn session={session} status={status} lastSynced={lastSynced} error={error} onSyncNow={onSyncNow} onDone={() => setOpen(false)} />
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
  onDone,
}: {
  session: Session
  status: SyncStatus
  lastSynced: Date | null
  error: string | null
  onSyncNow: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const bad = status === "error" || status === "offline"
  return (
    <>
      <SheetHeader className="px-0">
        <SheetTitle className="text-xl">Your account</SheetTitle>
        <SheetDescription className="break-all">{session.user.email}</SheetDescription>
      </SheetHeader>
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
