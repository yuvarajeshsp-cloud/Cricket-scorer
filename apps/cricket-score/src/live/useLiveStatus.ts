import { useEffect, useState } from "react"
import type { LiveStatus } from "./transport"
import { live } from "./index"

export function useLiveStatus(): LiveStatus {
  const [s, setS] = useState<LiveStatus>("local")
  useEffect(() => live.onStatus(setS), [])
  return s
}
