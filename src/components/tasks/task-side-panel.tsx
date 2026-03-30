"use client"

import type { ReactNode } from "react"
import { createPortal } from "react-dom"

const PANEL_W = 320
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

type TaskSidePanelProps = {
  mounted: boolean
  visible: boolean
  children: ReactNode
  dataAttribute?: string
  transitionDelayMs?: number
  durationMs?: number
}

export function TaskSidePanel({
  mounted,
  visible,
  children,
  dataAttribute,
  transitionDelayMs = 0,
  durationMs = 420,
}: TaskSidePanelProps) {
  const duration = `${durationMs}ms`
  const widthTransition = `width ${duration} ${EASING} ${transitionDelayMs}ms`
  const panelTransition = `transform ${duration} ${EASING} ${transitionDelayMs}ms`

  return (
    <>
      <div
        data-task-side-panel-spacer="true"
        className="flex-shrink-0"
        style={{
          width: visible ? PANEL_W : 0,
          transition: widthTransition,
        }}
      />
      {mounted && createPortal(
        <div
          {...(dataAttribute ? { [dataAttribute]: "true" } : {})}
          className="fixed z-40"
          style={{
            top: "5rem",
            right: "1.5rem",
            bottom: "1rem",
            width: PANEL_W,
            overflow: "hidden",
            pointerEvents: visible ? "auto" : "none",
          }}
        >
          <div
            data-task-side-panel-content="true"
            style={{
              height: "100%",
              transform: visible ? "translateX(0)" : "translateX(100%)",
              transition: panelTransition,
              willChange: "transform",
            }}
          >
            {children}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
