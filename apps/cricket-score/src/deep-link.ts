import { App as CapApp } from "@capacitor/app"
import { Capacitor } from "@capacitor/core"

/** Custom scheme the iPhone app answers to (iOS Universal Links need a paid Apple account). */
export const APP_SCHEME = "cricketscore"
export const ANDROID_PACKAGE = "com.rajesh.cricketscore"

/**
 * The viewer route in any link we hand out, as this app's hash route:
 *   https://site/live/<id>, https://site/#/live/<id>, cricketscore://live/<id>  →  #/live/<id>
 */
export function routeFromUrl(url: string): string | null {
  const m = url.match(/\/(live|overlay)\/([a-z0-9]+)\/?(?:[?#]|$)/)
  return m ? `#/${m[1]}/${m[2]}` : null
}

/** Call once before rendering. Keeps all routing hash-based whichever way the app was opened. */
export function setupDeepLinks() {
  // Website opened at /live/<id> (the shared link): switch to the hash form in place.
  if (location.pathname !== "/" && !location.hash) {
    const route = routeFromUrl(location.pathname)
    if (route) history.replaceState(null, "", `/${route}`)
  }
  if (!Capacitor.isNativePlatform()) return
  const open = (url?: string) => {
    const route = url && routeFromUrl(url)
    if (route) location.hash = route
  }
  // Cold start from a link, then links tapped while the app is already open.
  void CapApp.getLaunchUrl().then((r) => open(r?.url))
  void CapApp.addListener("appUrlOpen", ({ url }) => open(url))
}

export type OpenInApp = { href: string; label: string } | null

/** On a phone's browser: a link that opens this match in the installed app. Null elsewhere. */
export function openInAppLink(matchId: string): OpenInApp {
  if (Capacitor.isNativePlatform() || typeof navigator === "undefined") return null
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return { href: `${APP_SCHEME}://live/${matchId}`, label: "Open in the app" }
  if (/Android/.test(ua)) {
    // Opens the app if it is installed; otherwise Chrome follows the fallback to the APK download.
    const fallback = encodeURIComponent(`${location.origin}/cricket-score.apk`)
    return {
      href: `intent://${location.host}/live/${matchId}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`,
      label: "Open in the app",
    }
  }
  return null
}
