"use client"
import { useEffect, useMemo, useState } from "react"
import { Share, PlusSquare, X } from "lucide-react"
import { useI18n } from "@/contexts/locale-context"
import { PWA_INSTALL_HINT_COOKIE, readDocumentCookie, writeDocumentCookie } from "@/lib/preferences"
import { useIsIosSafari, useIsMobile, useIsStandalone } from "@/hooks/use-is-mobile"

const DISMISS_DAYS = 60 * 60 * 24 * 14

export function PwaInstallPrompt() {
  const { t } = useI18n()
  const isMobile = useIsMobile()
  const isStandalone = useIsStandalone()
  const isIosSafari = useIsIosSafari()
  const [visible, setVisible] = useState(false)

  const shouldShow = useMemo(() => {
    if (!isMobile || isStandalone || !isIosSafari) return false
    return !readDocumentCookie(PWA_INSTALL_HINT_COOKIE)
  }, [isIosSafari, isMobile, isStandalone])

  useEffect(() => {
    if (!shouldShow) {
      setVisible(false)
      return
    }

    const timer = window.setTimeout(() => setVisible(true), 1600)
    return () => window.clearTimeout(timer)
  }, [shouldShow])

  if (!visible) return null

  return (
    <aside
      className="md:hidden fixed left-3 right-3 z-50 glass-flat-panel rounded-2xl px-4 py-3 shadow-[0_16px_34px_rgba(28,25,23,0.12)]"
      style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
      aria-label={t.pwa.installTitle}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-2xl bg-[--primary]/12 text-[--primary] p-2">
          <PlusSquare className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-5">{t.pwa.installTitle}</p>
              <p className="text-xs text-[--muted-foreground] mt-1 leading-5">
                {t.pwa.installBody}
              </p>
            </div>
            <button
              type="button"
              className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-[--muted-foreground]"
              aria-label={t.pwa.close}
              onClick={() => {
                writeDocumentCookie(PWA_INSTALL_HINT_COOKIE, "1", DISMISS_DAYS)
                setVisible(false)
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[--foreground]/85">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--liquid-glass-bg-soft)] border border-[var(--liquid-glass-border-soft)] px-2.5 py-1.5">
              <Share className="w-3.5 h-3.5" />
              {t.pwa.stepShare}
            </span>
            <span className="text-[--muted-foreground]">→</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--liquid-glass-bg-soft)] border border-[var(--liquid-glass-border-soft)] px-2.5 py-1.5">
              <PlusSquare className="w-3.5 h-3.5" />
              {t.pwa.stepAdd}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
