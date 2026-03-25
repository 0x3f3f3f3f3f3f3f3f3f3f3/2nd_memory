"use client"
import { createContext, useContext, useEffect, useMemo, useState } from "react"

const MOBILE_QUERY = "(max-width: 767px)"
const HOVER_QUERY = "(hover: hover)"
const COARSE_QUERY = "(pointer: coarse)"
const STANDALONE_QUERY = "(display-mode: standalone)"

type ResponsiveState = {
  isMobile: boolean
  canHover: boolean
  isTouchDevice: boolean
  isStandalone: boolean
  isIosSafari: boolean
}

const DEFAULT_STATE: ResponsiveState = {
  isMobile: false,
  canHover: true,
  isTouchDevice: false,
  isStandalone: false,
  isIosSafari: false,
}

const ResponsiveContext = createContext<ResponsiveState>(DEFAULT_STATE)

function detectResponsiveState(initialIsMobileHint = false): ResponsiveState {
  if (typeof window === "undefined") {
    return { ...DEFAULT_STATE, isMobile: initialIsMobileHint }
  }

  const ua = window.navigator.userAgent.toLowerCase()
  const isStandalone = window.matchMedia(STANDALONE_QUERY).matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  const canHover = window.matchMedia(HOVER_QUERY).matches
  const coarsePointer = window.matchMedia(COARSE_QUERY).matches
  const isTouchDevice = coarsePointer || window.navigator.maxTouchPoints > 0
  const isMobileViewport = window.matchMedia(MOBILE_QUERY).matches
  const isAppleMobile = /iphone|ipad|ipod/.test(ua)
  const isIosSafari = isAppleMobile && /safari/.test(ua) && !/crios|fxios|edgios|opios/.test(ua)

  return {
    isMobile: isMobileViewport || (initialIsMobileHint && isTouchDevice && window.innerWidth < 768),
    canHover,
    isTouchDevice,
    isStandalone,
    isIosSafari,
  }
}

function syncDocumentState(state: ResponsiveState) {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("app-standalone", state.isStandalone)
  document.documentElement.classList.toggle("app-touch", state.isTouchDevice)
  document.documentElement.dataset.displayMode = state.isStandalone ? "standalone" : "browser"
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`)
}

export function ResponsiveProvider({
  children,
  initialIsMobileHint = false,
}: {
  children: React.ReactNode
  initialIsMobileHint?: boolean
}) {
  const [state, setState] = useState<ResponsiveState>(() => detectResponsiveState(initialIsMobileHint))

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const isSecureContext = window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    if (!isSecureContext) return

    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const queries = [
      window.matchMedia(MOBILE_QUERY),
      window.matchMedia(HOVER_QUERY),
      window.matchMedia(COARSE_QUERY),
      window.matchMedia(STANDALONE_QUERY),
    ]

    const sync = () => setState(detectResponsiveState(initialIsMobileHint))

    sync()
    queries.forEach((query) => query.addEventListener("change", sync))
    window.addEventListener("resize", sync)
    window.addEventListener("orientationchange", sync)
    window.visualViewport?.addEventListener("resize", sync)

    return () => {
      queries.forEach((query) => query.removeEventListener("change", sync))
      window.removeEventListener("resize", sync)
      window.removeEventListener("orientationchange", sync)
      window.visualViewport?.removeEventListener("resize", sync)
    }
  }, [initialIsMobileHint])

  useEffect(() => {
    syncDocumentState(state)
  }, [state])

  const value = useMemo(() => state, [state])
  return <ResponsiveContext.Provider value={value}>{children}</ResponsiveContext.Provider>
}

export function useResponsiveState() {
  return useContext(ResponsiveContext)
}

export function useIsMobile() {
  return useResponsiveState().isMobile
}

export function useCanHover() {
  return useResponsiveState().canHover
}

export function useIsTouchDevice() {
  return useResponsiveState().isTouchDevice
}

export function useIsStandalone() {
  return useResponsiveState().isStandalone
}

export function useIsIosSafari() {
  return useResponsiveState().isIosSafari
}
