"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { registerAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react"

export function RegisterForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPwd, setConfirmPwd] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (username.length < 2) {
      setError("用户名至少2个字符")
      return
    }
    if (password.length < 6) {
      setError("密码至少6位")
      return
    }
    if (password !== confirmPwd) {
      setError("两次密码不一致")
      return
    }

    startTransition(async () => {
      const result = await registerAction(username, password)
      if (result.success) {
        router.push("/inbox")
        router.refresh()
      } else {
        setError(result.error ?? "注册失败")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">用户名</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--muted-foreground]" />
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="2-20个字符"
            className="pl-10 bg-[--background]/50 backdrop-blur-sm focus-glow"
            autoFocus
            required
            maxLength={20}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--muted-foreground]" />
          <Input
            id="password"
            type={showPwd ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少6位"
            className="pl-10 pr-10 bg-[--background]/50 backdrop-blur-sm focus-glow"
            required
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[--muted-foreground] hover:text-[--foreground]"
          >
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPwd">确认密码</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--muted-foreground]" />
          <Input
            id="confirmPwd"
            type={showPwd ? "text" : "password"}
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="再次输入密码"
            className="pl-10 bg-[--background]/50 backdrop-blur-sm focus-glow"
            required
          />
        </div>
      </div>
      {error && (
        <p className="text-sm text-[--destructive] bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-[#C96444] to-[#D97A5C] hover:from-[#B85A3C] hover:to-[#C96A4E] shadow-[0_4px_16px_rgba(201,100,68,0.25)] border-0"
        disabled={isPending || !username || !password || !confirmPwd}
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "注册"}
      </Button>
      <p className="text-center text-sm text-[--muted-foreground]">
        已有账号？<Link href="/login" className="text-[--primary] hover:underline">登录</Link>
      </p>
    </form>
  )
}
