import { requireAuth } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { AiChat } from "@/components/ai/ai-chat"

export default async function AiPage() {
  await requireAuth()

  return (
    <div className="flex flex-col h-[100dvh] md:h-screen">
      <Topbar />
      <div className="flex-1 min-h-0">
        <AiChat />
      </div>
    </div>
  )
}
