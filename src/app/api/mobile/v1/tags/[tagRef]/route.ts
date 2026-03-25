import { requireMobileSession } from "@/server/mobile/auth"
import { handleRouteError, jsonData } from "@/server/mobile/http"
import { serializeTag } from "@/server/mobile/dtos"
import { tagUpdateSchema } from "@/server/mobile/validators"
import { deleteTag, updateTag } from "@/server/services/tags-service"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tagRef: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { tagRef } = await params
    const body = tagUpdateSchema.parse(await request.json())
    const tag = await updateTag(auth.user.id, tagRef, body)
    return jsonData(serializeTag(tag))
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tagRef: string }> },
) {
  try {
    const auth = await requireMobileSession(request)
    const { tagRef } = await params
    await deleteTag(auth.user.id, tagRef)
    return jsonData({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
