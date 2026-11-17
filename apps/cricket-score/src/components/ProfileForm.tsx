import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { Button, Input, Label, Spinner } from "@rajesh-hub/ui"
import { Sheet } from "./bits"
import { validPhone, type Profile } from "../profile"

/** Name + phone (required) and the sign-in email (read only). */
export function ProfileForm({
  initial,
  email,
  submitLabel = "Save",
  onSave,
  onCancel,
}: {
  initial: { name: string; phone: string }
  email: string | null | undefined
  submitLabel?: string
  onSave: (name: string, phone: string) => Promise<unknown>
  onCancel?: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [phone, setPhone] = useState(initial.phone)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setName(initial.name)
    setPhone(initial.phone)
  }, [initial.name, initial.phone])
  const phoneOk = validPhone(phone)
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim() || !phoneOk) return
        setBusy(true)
        setError(null)
        try {
          await onSave(name, phone)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <Label htmlFor="profile-name">Your name</Label>
      <Input id="profile-name" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl text-base" />
      <Label htmlFor="profile-phone">Phone number</Label>
      <Input
        id="profile-phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="e.g. 98765 43210"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="h-12 rounded-xl text-base"
      />
      {phone && !phoneOk ? <p className="text-sm text-destructive">Enter a phone number with 6–16 digits.</p> : null}
      <p className="text-xs text-muted-foreground">Your phone number links you to your player in groups and to friends' phone contacts. People in your groups can see it.</p>
      {email ? (
        <>
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email} readOnly disabled className="h-12 rounded-xl text-base" />
        </>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="h-12 rounded-xl text-base font-semibold" disabled={busy || !name.trim() || !phoneOk}>
        {busy ? <Spinner /> : <Check />} {submitLabel}
      </Button>
      {onCancel ? (
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      ) : null}
    </form>
  )
}

/** Shown once after the first sign-in until name + phone are saved. */
export function CompleteProfile({
  open,
  suggestedName,
  email,
  onSave,
}: {
  open: boolean
  suggestedName: string
  email: string | null | undefined
  onSave: (name: string, phone: string) => Promise<Profile>
}) {
  return (
    <Sheet open={open} onOpenChange={() => {}} dismissible={false} title="Complete your profile" description="Just once: your name and phone number, so friends can find you in their groups.">
      <ProfileForm initial={{ name: suggestedName, phone: "" }} email={email} submitLabel="Save and continue" onSave={onSave} />
    </Sheet>
  )
}
