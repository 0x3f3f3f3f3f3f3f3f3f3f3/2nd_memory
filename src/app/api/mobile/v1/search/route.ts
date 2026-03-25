import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeNote, serializeTag, serializeTask } from "@/server/mobile/dtos"
import { searchEverything } from "@/server/services/search-service"

export async function GET(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") ?? ""
    const result = await searchEverything(auth.user.id, query)

    return jsonData({
      tasks: result.tasks.map((task) => {
        const dto = serializeTask(task)
        return {
          id: dto.id,
          title: dto.title,
          status: dto.status,
          priority: dto.priority,
          dueAt: dto.dueAt,
        }
      }),
      notes: result.notes.map((note) => {
        const dto = serializeNote(note)
        return {
          id: dto.id,
          title: dto.title,
          slug: dto.slug,
          summary: dto.summary,
          type: dto.type,
        }
      }),
      tags: result.tags.map((tag) => {
        const dto = serializeTag(tag)
        return {
          id: dto.id,
          name: dto.name,
          slug: dto.slug,
          color: dto.color,
        }
      }),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
