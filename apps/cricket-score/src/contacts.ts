import { Capacitor } from "@capacitor/core"
import { Contacts } from "@capacitor-community/contacts"

/** A person picked from the phone's contacts. */
export interface PickedContact {
  name: string
  phone: string
}

interface WebContact {
  name?: string[]
  tel?: string[]
}
type WebContacts = { select: (props: string[], opts: { multiple: boolean }) => Promise<WebContact[]> }
const webContacts = (): WebContacts | null =>
  typeof navigator !== "undefined" && "contacts" in navigator && "select" in ((navigator as unknown as { contacts: object }).contacts ?? {})
    ? (navigator as unknown as { contacts: WebContacts }).contacts
    : null

/**
 * Picking contacts works in the Android / iPhone app (the phone's own contact picker, with
 * its search) and in Chrome on Android (the browser's picker). Not in iPhone Safari or on computers.
 */
export const canPickContacts = () => Capacitor.isNativePlatform() || webContacts() !== null

/** Open the phone's contact picker. Returns the chosen people (name + their mobile number). */
export async function pickContacts(): Promise<PickedContact[]> {
  if (Capacitor.isNativePlatform()) {
    const { contact } = await Contacts.pickContact({ projection: { name: true, phones: true } })
    const n = contact.name
    const name = (n?.display || [n?.given, n?.family].filter(Boolean).join(" ")).trim()
    const phones = contact.phones ?? []
    const mobile = phones.find((p) => p.type === "mobile") ?? phones.find((p) => p.isPrimary) ?? phones[0]
    return name || mobile?.number ? [{ name: name || mobile?.number || "", phone: mobile?.number ?? "" }] : []
  }
  const web = webContacts()
  if (!web) return []
  const list = await web.select(["name", "tel"], { multiple: true })
  return list
    .map((c) => ({ name: (c.name?.[0] ?? "").trim(), phone: (c.tel?.[0] ?? "").trim() }))
    .filter((c) => c.name || c.phone)
    .map((c) => ({ name: c.name || c.phone, phone: c.phone }))
}
