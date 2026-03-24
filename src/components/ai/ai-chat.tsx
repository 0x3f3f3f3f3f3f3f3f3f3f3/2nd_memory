"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Send, Bot, User, Loader2, Sparkles, Trash2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useI18n } from "@/contexts/locale-context"

interface Message {
  role: "user" | "assistant"
  content: string
}

export function AiChat() {
  const { t, locale, timezone } = useI18n()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])
  useEffect(() => { inputRef.current?.focus() }, [])

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    const userMsg: Message = { role: "user", content: msg }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    if (inputRef.current) inputRef.current.style.height = "auto"

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, locale, timezone }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      // Stream response — text appears word by word
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let content = ""
      setMessages([...newMessages, { role: "assistant", content: "" }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
        setMessages([...newMessages, { role: "assistant", content }])
      }

      if (!content.trim()) {
        setMessages([...newMessages, { role: "assistant", content: locale === "en" ? "No response." : "AI 未返回内容。" }])
      }
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: "assistant", content: t.ai.error(err.message) },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleTextareaInput = () => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 120) + "px"
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 animate-page-enter">
            <div className={cn(
              "w-16 h-16 rounded-3xl mb-5 flex items-center justify-center",
              "bg-gradient-to-br from-[--primary] to-[#E08060]",
              "shadow-[0_8px_32px_rgba(201,100,68,0.3)]",
            )}>
              <Sparkles className="w-8 h-8 text-[--primary-foreground]" />
            </div>
            <h2 className="text-lg font-semibold mb-1">{t.ai.greeting}</h2>
            <p className="text-sm text-[--muted-foreground] mb-6 text-center max-w-xs">
              {t.ai.subtitle}
            </p>

            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {t.ai.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className={cn(
                    "text-xs px-3 py-2 rounded-xl",
                    "bg-[var(--liquid-glass-bg)] border border-[var(--liquid-glass-border)]",
                    "backdrop-blur-sm",
                    "shadow-[var(--liquid-glass-shadow-soft)]",
                    "hover:bg-[var(--liquid-glass-hover-bg)]",
                    "hover:-translate-y-px hover:shadow-md",
                    "active:scale-[0.98]",
                    "transition-all duration-150",
                    "text-[--foreground]/80",
                    "animate-card-enter",
                  )}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3 max-w-2xl animate-card-enter",
              msg.role === "user" ? "ml-auto flex-row-reverse" : "",
            )}
            style={{ animationDelay: "0ms" }}
          >
            <div className={cn(
              "w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center",
              msg.role === "assistant"
                ? "bg-gradient-to-br from-[--primary] to-[#E08060] shadow-sm"
                : "bg-[--foreground]/10",
            )}>
              {msg.role === "assistant"
                ? <Bot className="w-3.5 h-3.5 text-[--primary-foreground]" />
                : <User className="w-3.5 h-3.5 text-[--foreground]/60" />
              }
            </div>

            <div className={cn(
              "rounded-2xl px-4 py-3 max-w-[75%] min-w-0",
              msg.role === "user"
                ? [
                    "bg-[--primary] text-[--primary-foreground]",
                    "rounded-br-lg",
                    "shadow-[0_2px_12px_rgba(201,100,68,0.2)]",
                  ]
                : [
                    "bg-[var(--liquid-glass-bg)]",
                    "border border-[var(--liquid-glass-border)]",
                    "backdrop-blur-md",
                    "shadow-[var(--liquid-glass-shadow-soft)]",
                    "rounded-bl-lg",
                  ],
            )}>
              {msg.role === "user" ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="prose prose-sm max-w-none text-[--foreground] prose-p:my-1.5 prose-ul:my-1 prose-li:my-0.5 prose-headings:mt-3 prose-headings:mb-1.5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 animate-card-enter">
            <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[--primary] to-[#E08060] shadow-sm">
              <Bot className="w-3.5 h-3.5 text-[--primary-foreground]" />
            </div>
            <div className={cn(
              "rounded-2xl rounded-bl-lg px-4 py-3",
              "bg-[var(--liquid-glass-bg)]",
              "border border-[var(--liquid-glass-border)]",
              "backdrop-blur-md",
              "shadow-[var(--liquid-glass-shadow-soft)]",
            )}>
              <div className="flex gap-1.5 items-center h-5">
                <span className="w-1.5 h-1.5 rounded-full bg-[--muted-foreground]/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[--muted-foreground]/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[--muted-foreground]/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 pt-2 pb-32 md:pb-20 mb-8 md:mb-12 safe-area-pb">
        <div className={cn(
          "ai-input-flat",
          "flex items-center gap-2 max-w-2xl mx-auto",
          "rounded-2xl px-4 py-2",
          "bg-[var(--liquid-glass-bg-strong)]",
          "border border-[var(--liquid-glass-border)]",
          "shadow-[var(--liquid-glass-shadow)]",
          "focus-within:shadow-[0_4px_24px_rgba(201,100,68,0.12),inset_0_1px_0_rgba(255,255,255,0.6)]",
          "dark:bg-[--muted] dark:border-[--border] dark:backdrop-blur-none dark:shadow-none dark:focus-within:shadow-none dark:focus-within:border-[--ring]",
          "transition-all duration-200",
        )}>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="flex-shrink-0 p-2.5 md:p-1.5 rounded-lg hover:bg-[--foreground]/[0.05] transition-colors text-[--muted-foreground] hover:text-[--foreground] "
              title={t.ai.clearChat}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); handleTextareaInput() }}
            onKeyDown={handleKeyDown}
            placeholder={t.ai.placeholder}
            rows={1}
            className="flex-1 bg-transparent border-0 outline-none resize-none text-sm py-1 placeholder:text-[--muted-foreground]/50 max-h-[120px]"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className={cn(
              "flex-shrink-0 w-10 h-10 md:w-8 md:h-8 rounded-xl flex items-center justify-center transition-all duration-150 ",
              input.trim() && !loading
                ? "bg-[--primary] text-[--primary-foreground] shadow-sm hover:opacity-90 active:scale-95 dark:shadow-none"
                : "bg-[--foreground]/[0.05] text-[--muted-foreground]/40 dark:bg-[var(--secondary)]",
            )}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
