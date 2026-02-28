import { NextRequest, NextResponse } from "next/server";
import { getDb, newId, assertNoError } from "@/lib/db";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

const MAX_PROMPT_LENGTH = 2000;

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const { data: prompts, error } = await db
      .from("SavedPrompt")
      .select("*")
      .eq("userId", SYSTEM_USER_ID)
      .order("createdAt", { ascending: false });

    assertNoError(error, "GET /api/prompts");
    return NextResponse.json({ prompts: prompts ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/prompts error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (text.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt darf maximal ${MAX_PROMPT_LENGTH} Zeichen haben` },
        { status: 400 }
      );
    }

    const db = getDb();
    const { data: prompt, error } = await db
      .from("SavedPrompt")
      .insert({ id: newId(), userId: SYSTEM_USER_ID, text: text.trim(), createdAt: new Date().toISOString() })
      .select()
      .single();

    assertNoError(error, "POST /api/prompts");
    return NextResponse.json({ prompt }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/prompts error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
