import { MessageCircle } from "lucide-react"
import { buttonVariants, cn } from "@rajesh-hub/ui"
import { whatsappUrl } from "../engine/share-text"

/**
 * Opens WhatsApp with the text ready to send to a chat or group.
 * A real link (not window.open) so it works in every browser and inside apps.
 */
export function WhatsAppButton({
  text,
  label = "WhatsApp",
  className,
  variant = "default",
}: {
  text: string
  label?: string
  className?: string
  variant?: "default" | "outline" | "secondary"
}) {
  return (
    <a href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant }), "font-semibold", className)}>
      <MessageCircle /> {label}
    </a>
  )
}
