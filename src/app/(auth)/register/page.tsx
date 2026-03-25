import { redirect } from "next/navigation"
import { RegisterForm } from "./register-form"
import { isAuthenticated } from "@/lib/auth"
import { sanitizeAppPath } from "@/lib/utils"
import { Sprout } from "lucide-react"

export const metadata = { title: "注册" }

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const authed = await isAuthenticated()
  const params = await searchParams
  if (authed) redirect(sanitizeAppPath(params.from))

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-stone-50 via-[#FAF9F6] to-orange-50/40 dark:from-[#1C1917] dark:via-[#1C1917] dark:to-[#211E1B] px-4 relative overflow-hidden safe-area-px safe-area-pt">
      <div className="login-orb w-72 h-72 bg-[#D97A5C] top-[-5%] left-[10%]" />
      <div className="login-orb w-96 h-96 bg-amber-300/60 bottom-[-10%] right-[5%]" style={{ animationDelay: "-3s" }} />
      <div className="login-orb w-56 h-56 bg-orange-200 top-[40%] right-[20%]" style={{ animationDelay: "-5s" }} />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#C96444] to-[#E08060] flex items-center justify-center mb-4 shadow-[0_8px_32px_rgba(201,100,68,0.25)]">
            <Sprout className="w-8 h-8 text-[--primary-foreground]" />
          </div>
          <h1 className="text-3xl font-bold text-gradient bg-gradient-to-r from-[#C96444] to-[#E08060] dark:from-[#D4785A] dark:to-[#E8906E]">
            Sage
          </h1>
        </div>
        <div className="glass rounded-2xl p-6">
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
