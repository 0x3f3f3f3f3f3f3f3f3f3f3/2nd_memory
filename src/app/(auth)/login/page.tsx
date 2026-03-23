import { redirect } from "next/navigation"
import { LoginForm } from "./login-form"
import { isAuthenticated } from "@/lib/auth"
import { Sprout } from "lucide-react"

export const metadata = { title: "登录" }

export default async function LoginPage() {
  const authed = await isAuthenticated()
  if (authed) redirect("/today")

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--background] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[--primary] flex items-center justify-center mb-4 shadow-lg">
            <Sprout className="w-7 h-7 text-[--primary-foreground]" />
          </div>
          <h1 className="text-2xl font-bold">记忆花园</h1>
          <p className="text-sm text-[--muted-foreground] mt-1">你的个人第二大脑</p>
        </div>
        <div className="bg-[--card] border border-[--border] rounded-2xl p-6 shadow-sm">
          <LoginForm />
        </div>
        <p className="text-center text-xs text-[--muted-foreground] mt-4">
          私人专属 · 数据安全
        </p>
      </div>
    </div>
  )
}
