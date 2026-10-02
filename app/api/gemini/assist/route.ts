import { NextResponse } from "next/server";
import { runGeminiAssist } from "@/lib/geminiAssist";

/**
 * POST /api/gemini/assist
 * {
 *   pnr?,
 *   guestMessage?,
 *   promptType?: DISCOUNT_RULE | DRAFT_REPLY | SUICA_EXPLAIN | WORKLOAD_RULE | GENERAL,
 *   prompt?: string,          // free-form Ask AI
 *   enableSearch?: boolean    // Google Search grounding (default true)
 * }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pnr?: string;
      guestMessage?: string;
      promptType?: string;
      prompt?: string;
      enableSearch?: boolean;
    };

    const result = await runGeminiAssist({
      pnr: body.pnr,
      guestMessage: body.guestMessage,
      promptType: body.promptType,
      prompt: body.prompt,
      enableSearch: body.enableSearch !== false,
    });

    return NextResponse.json({
      ok: true,
      reply: result.reply,
      source: result.source,
      model: result.model || null,
      knowledgeDocCount: result.knowledgeDocCount ?? 0,
      searchEnabled: Boolean(result.searchEnabled),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Assist failed",
        reply: "",
      },
      { status: 500 }
    );
  }
}
