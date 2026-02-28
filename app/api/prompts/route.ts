import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

const MAX_PROMPT_LENGTH = 2000;

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prompts = await prisma.savedPrompt.findMany({
      where: { userId: SYSTEM_USER_ID },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ prompts });
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

    const prompt = await prisma.savedPrompt.create({
      data: { userId: SYSTEM_USER_ID, text: text.trim() },
    });

    return NextResponse.json({ prompt }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/prompts error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
