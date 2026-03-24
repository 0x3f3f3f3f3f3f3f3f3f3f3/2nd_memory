import { requireAuth } from "@/lib/auth"
import { Topbar } from "@/components/layout/topbar"
import { AiChat } from "@/components/ai/ai-chat"
import { getServerT } from "@/lib/server-locale"

export default async function AiPage() {
  await requireAuth()
  const { t } = await getServerT()

  return (
    <div className="flex flex-col h-[100dvh] md:h-screen">
      <Topbar title={t.ai.pageTitle} />
      <div className="flex-1 min-h-0">
        <AiChat />
      </div>
    </div>
  )
}
