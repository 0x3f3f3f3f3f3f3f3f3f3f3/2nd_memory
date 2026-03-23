"use client"
import { useEffect, useRef } from "react"

interface VditorEditorProps {
  value: string
  onChange: (value: string) => void
  height?: number
}

// Wraps selected text or inserts at cursor with before/after markers
function wrapOrInsert(vd: any, before: string, after: string, placeholder: string) {
  // Vditor IR mode: use insertValue to insert markdown
  const selection = window.getSelection()?.toString()
  if (selection) {
    vd.insertValue(`${before}${selection}${after}`)
  } else {
    vd.insertValue(`${before}${placeholder}${after}`)
  }
}

// Insert heading prefix at start of current line
function insertHeading(vd: any, level: number) {
  const prefix = "#".repeat(level) + " "
  vd.insertValue(prefix)
}

export function VditorEditor({ value, onChange, height = 480 }: VditorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const vditorRef = useRef<any>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (mountedRef.current || !containerRef.current) return
    mountedRef.current = true

    import("vditor").then(({ default: Vditor }) => {
      if (!containerRef.current) return

      vditorRef.current = new Vditor(containerRef.current, {
        height,
        mode: "ir",
        value,
        lang: "zh_CN",
        input: onChange,
        cache: { enable: false },
        toolbar: [
          "headings",
          "bold",
          "italic",
          "strike",
          "link",
          "|",
          "list",
          "ordered-list",
          "check",
          "quote",
          "line",
          "|",
          "code",
          "inline-code",
          "table",
          "|",
          "undo",
          "redo",
          "|",
          "preview",
          "fullscreen",
        ],
        preview: {
          markdown: { toc: true },
        },
        after() {
          // Attach shortcut handler via capture so we intercept before Vditor
          const container = containerRef.current
          if (!container) return

          const handler = (e: KeyboardEvent) => {
            const vd = vditorRef.current
            if (!vd) return
            const mod = e.metaKey || e.ctrlKey
            // Only handle Ctrl/Cmd + single key, no Alt/Option
            if (!mod || e.altKey) return

            switch (e.key) {
              // Headings
              case "1": e.preventDefault(); insertHeading(vd, 1); break
              case "2": e.preventDefault(); insertHeading(vd, 2); break
              case "3": e.preventDefault(); insertHeading(vd, 3); break
              case "4": e.preventDefault(); insertHeading(vd, 4); break
              // Inline formatting
              case "b": case "B":
                // Vditor has built-in Ctrl+B, let it handle. But ensure no Alt needed.
                break
              case "i": case "I":
                // Vditor has built-in Ctrl+I
                break
              case "d": case "D":
                e.preventDefault()
                wrapOrInsert(vd, "~~", "~~", "删除线")
                break
              case "`":
                e.preventDefault()
                if (e.shiftKey) {
                  wrapOrInsert(vd, "\n```\n", "\n```\n", "代码块")
                } else {
                  wrapOrInsert(vd, "`", "`", "代码")
                }
                break
              case "k": case "K":
                e.preventDefault()
                wrapOrInsert(vd, "[", "](https://)", "链接文字")
                break
              case "q": case "Q":
                e.preventDefault()
                vd.insertValue("> ")
                break
              case "l": case "L":
                e.preventDefault()
                vd.insertValue("- ")
                break
              case "e": case "E":
                e.preventDefault()
                wrapOrInsert(vd, "\n```\n", "\n```\n", "代码块")
                break
            }
          }

          // Use capture to intercept before Vditor's own handlers
          container.addEventListener("keydown", handler, true)
        },
      })
    })

    return () => {
      vditorRef.current?.destroy()
      vditorRef.current = null
      mountedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} />
}
