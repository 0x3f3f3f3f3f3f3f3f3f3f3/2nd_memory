import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { isAuthenticated, getCurrentUserId } from "@/lib/auth"
import { streamAiChat } from "@/server/services/ai-chat-service"

function revalidateAll() {
  for (const path of ["/tasks", "/timeline", "/ddl", "/inbox", "/notes", "/tags"]) {
    revalidatePath(path)
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const userId = await getCurrentUserId()
  const body = await request.json().catch(() => null)
  if (!body?.messages?.length) {
    return NextResponse.json({ error: "无效请求" }, { status: 400 })
  }

  const stream = await streamAiChat({
    userId,
    locale: body.locale === "en" ? "en" : "zh-Hans",
    timeZone: typeof body.timezone === "string" && body.timezone ? body.timezone : "UTC",
    messages: body.messages,
    onMutation: revalidateAll,
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  })
}
