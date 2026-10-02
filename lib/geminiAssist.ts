/**
 * Gemini Assist — grounded on TokioTours SOPs + uploaded knowledge docs.
 * Optional Google Search grounding for live Tokyo / web facts.
 */

import { buildKnowledgeBaseContext } from "@/lib/aiKnowledgeDocs";
import {
  TOKIO_TOURS_SYSTEM_RULES,
  fallbackAssistReply,
  promptTypeInstruction,
  type GeminiAssistPromptType,
} from "@/lib/tokioToursSystemRules";

export type GeminiAssistResult = {
  reply: string;
  source: "gemini" | "rules_fallback";
  model?: string;
  knowledgeDocCount?: number;
  searchEnabled?: boolean;
};

function normalizePromptType(raw: unknown): GeminiAssistPromptType {
  const v = String(raw || "")
    .trim()
    .toUpperCase();
  if (
    v === "DISCOUNT_RULE" ||
    v === "DRAFT_REPLY" ||
    v === "SUICA_EXPLAIN" ||
    v === "WORKLOAD_RULE" ||
    v === "GENERAL"
  ) {
    return v;
  }
  return "GENERAL";
}

async function callGeminiGenerate(input: {
  prompt: string;
  enableSearch?: boolean;
}): Promise<{ text: string; model: string } | null> {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;

  const model =
    String(process.env.GEMINI_MODEL || "").trim() || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: input.prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  };

  // Google Search grounding (Gemini 1.5+/2.x REST)
  if (input.enableSearch) {
    body.tools = [{ google_search: {} }];
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Retry once without search if grounding tool is unsupported for the model
    if (input.enableSearch && (res.status === 400 || res.status === 404)) {
      const errText = await res.text().catch(() => "");
      console.warn(
        "[gemini] search grounding failed, retrying without tools:",
        res.status,
        errText.slice(0, 200)
      );
      return callGeminiGenerate({ prompt: input.prompt, enableSearch: false });
    }
    const errText = await res.text().catch(() => "");
    console.warn("[gemini]", res.status, errText.slice(0, 300));
    return null;
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text = String(
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      .trim() || ""
  );
  if (!text) return null;
  return { text, model };
}

export async function runGeminiAssist(input: {
  pnr?: string;
  guestMessage?: string;
  promptType?: unknown;
  /** Free-form staff question (Ask AI bar) */
  prompt?: string;
  enableSearch?: boolean;
}): Promise<GeminiAssistResult> {
  const pnr = String(input.pnr || "")
    .trim()
    .toUpperCase();
  const guestMessage = String(input.guestMessage || "").trim();
  const customPrompt = String(input.prompt || "").trim();
  const promptType = normalizePromptType(input.promptType);
  const enableSearch = input.enableSearch !== false;

  const { context: knowledgeBaseContext, docCount } =
    await buildKnowledgeBaseContext();

  const staffTask = customPrompt
    ? `PNR ${pnr || "n/a"}. Staff question:\n${customPrompt}${
        guestMessage ? `\n\nGuest / composer context:\n${guestMessage}` : ""
      }`
    : promptTypeInstruction(promptType, guestMessage, pnr);

  const fullPrompt = [
    "You are the official AI Knowledge & Rules Assistant for TokioTours Operations Staff.",
    "Answer using uploaded SOP documents and the built-in system rules first.",
    "If real-time external info is needed (Tokyo train status, venue hours, ticket availability, FX, weather) and search grounding is available, use live web facts.",
    "Be concise, direct, and factual. For DRAFT_REPLY, write guest-ready text only.",
    "",
    "=== BUILT-IN TOKIOTOURS SYSTEM RULES ===",
    TOKIO_TOURS_SYSTEM_RULES,
    "",
    "=== OFFICIAL UPLOADED RULES & SOPS ===",
    knowledgeBaseContext || "No custom SOP documents uploaded yet.",
    "",
    "=== STAFF REQUEST ===",
    staffTask,
  ].join("\n");

  try {
    const gemini = await callGeminiGenerate({
      prompt: fullPrompt,
      enableSearch,
    });
    if (gemini) {
      return {
        reply: gemini.text,
        source: "gemini",
        model: gemini.model,
        knowledgeDocCount: docCount,
        searchEnabled: enableSearch,
      };
    }
  } catch (err) {
    console.warn("[gemini] call failed", err);
  }

  // Fallback: if custom prompt, stitch KB excerpt + rules
  if (customPrompt) {
    const kbHint = knowledgeBaseContext
      ? knowledgeBaseContext.slice(0, 2500)
      : "(no uploaded SOPs)";
    return {
      reply: [
        `Rules fallback (set GEMINI_API_KEY for live AI + web search).`,
        ``,
        `Your question: ${customPrompt}`,
        ``,
        `Built-in rules excerpt:`,
        TOKIO_TOURS_SYSTEM_RULES.slice(0, 1200),
        ``,
        `Uploaded SOP excerpt:`,
        kbHint,
      ].join("\n"),
      source: "rules_fallback",
      knowledgeDocCount: docCount,
      searchEnabled: false,
    };
  }

  return {
    reply: fallbackAssistReply(promptType, guestMessage, pnr),
    source: "rules_fallback",
    knowledgeDocCount: docCount,
    searchEnabled: false,
  };
}
