import OpenAI from "openai"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    })
  : null

export async function streamNonDbChat(input: {
  locale: "zh-Hans" | "en"
  timeZone: string
  messages: ChatMessage[]
}) {
  const encoder = new TextEncoder()

  if (!client) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(input.locale === "en" ? "Chat model is not configured." : "当前未配置聊天模型。"))
        controller.close()
      },
    })
  }

  const stream = await client.chat.completions.create({
    model: "gpt-5.4-mini",
    stream: true,
    messages: [
      {
        role: "system",
        content: input.locale === "en"
          ? `You are Sage. This request is explicitly routed as a non-database chat. Do not claim to create, update, schedule, or delete tasks, notes, inbox items, or time blocks. Be concise and helpful. Timezone: ${input.timeZone}.`
          : `你是 Sage。当前请求已被明确路由为非数据库聊天。不要声称创建、更新、安排或删除任务、笔记、收件箱或时间块。请简洁并有帮助地回答。当前时区：${input.timeZone}。`,
      },
      ...input.messages,
    ],
  })

  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) controller.enqueue(encoder.encode(content))
      }
      controller.close()
    },
  })
}
