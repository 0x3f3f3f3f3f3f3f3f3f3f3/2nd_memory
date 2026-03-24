"use server"
import { login } from "@/lib/auth"

export async function loginAction(username: string, password: string) {
  return login(username, password)
}
