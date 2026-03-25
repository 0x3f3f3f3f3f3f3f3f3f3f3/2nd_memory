import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeTag } from "@/server/mobile/dtos"
import { tagWriteSchema } from "@/server/mobile/validators"
import { createTag, listTags } from "@/server/services/tags-service"

export async function GET(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const tags = await listTags(auth.user.id)
    return jsonData(tags.map(serializeTag))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireMobileSession(request)
    const body = tagWriteSchema.parse(await request.json())
    const tag = await createTag(auth.user.id, body)
    return jsonData(serializeTag(tag), { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
