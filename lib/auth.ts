import { cookies } from "next/headers";

export async function requireAuth(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get("app_auth")?.value;
  const expected = process.env.APP_PASSWORD_HASH ?? process.env.APP_PASSWORD;

  if (!token || token !== expected) {
    throw new Response("Unauthorized", { status: 401 });
  }
}

export const SYSTEM_USER_ID = "denniskral";
