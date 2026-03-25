import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeNote, serializeTag, serializeTask } from "@/server/mobile/dtos"
import { getTagDetail } from "@/server/services/tags-service"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tagRef: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { tagRef } = await params
    const tag = await getTagDetail(auth.user.id, tagRef)

    return jsonData({
      tag: serializeTag(tag),
      tasks: tag.taskTags.map(({ task }) => serializeTask(task)),
      notes: tag.noteTags.map(({ note }) => serializeNote(note)),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
