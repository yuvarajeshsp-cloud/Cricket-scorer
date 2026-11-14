import type { ReactNode } from "react"
import { cn, Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@rajesh-hub/ui"
import type { BallMark } from "../engine/score"

const TONE: Record<BallMark["tone"], string> = {
  dot: "bg-muted text-muted-foreground",
  run: "bg-secondary text-secondary-foreground",
  four: "bg-brand-blue text-white",
  six: "bg-gold text-white",
  wicket: "bg-destructive text-white",
  extra: "bg-accent text-accent-foreground",
}

export function BallChip({ mark, size = "md" }: { mark: BallMark; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums",
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-10 text-sm",
        TONE[mark.tone],
      )}
    >
      {mark.label}
    </span>
  )
}

export function EmptyBall({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full border-2 border-dashed border-current opacity-25",
        size === "sm" && "size-6",
        size === "md" && "size-8",
        size === "lg" && "size-10",
      )}
    />
  )
}

/** Bottom sheet tuned for one-hand use. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  dismissible = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  children: ReactNode
  dismissible?: boolean
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} dismissible={dismissible}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-lg">{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
        </DrawerHeader>
        <div className="max-h-[70vh] overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">{children}</div>
      </DrawerContent>
    </Drawer>
  )
}

/** Big square button used on the scoring pad and in sheets. */
export function PadButton({
  children,
  onClick,
  variant = "plain",
  className,
  disabled,
  sub,
}: {
  children: ReactNode
  onClick: () => void
  variant?: "plain" | "four" | "six" | "out" | "extra" | "ghost"
  className?: string
  disabled?: boolean
  sub?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-16 flex-col items-center justify-center rounded-2xl text-2xl font-bold tabular-nums shadow-sm disabled:opacity-40",
        variant === "plain" && "bg-card text-card-foreground ring-1 ring-border",
        variant === "four" && "bg-brand-blue text-white",
        variant === "six" && "bg-gold text-white",
        variant === "out" && "bg-destructive text-white",
        variant === "extra" && "bg-accent text-accent-foreground text-lg",
        variant === "ghost" && "bg-muted text-muted-foreground text-base",
        className,
      )}
    >
      {children}
      {sub ? <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">{sub}</span> : null}
    </button>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
}

/** Pick-one chips. */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: ReactNode; disabled?: boolean }[]
  value: T | null
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-11 min-w-11 rounded-full px-4 text-sm font-semibold ring-1 transition-colors disabled:opacity-35",
            value === o.value ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-border",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
