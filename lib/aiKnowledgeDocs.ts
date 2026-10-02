/**
 * AI knowledge base — SOP documents stored in PocketBase `ai_knowledge_docs`.
 */

import { getAdminPocketBase } from "@/lib/pocketbase/admin";

export const AI_KNOWLEDGE_CATEGORIES = [
  "PRICING",
  "TRANSIT",
  "DISPATCH",
  "GENERAL_SOP",
] as const;

export type AiKnowledgeCategory = (typeof AI_KNOWLEDGE_CATEGORIES)[number];

export type AiKnowledgeDoc = {
  id: string;
  title: string;
  category: AiKnowledgeCategory | string;
  document_file?: string;
  extracted_text?: string;
  is_active?: boolean;
  uploaded_by?: string;
  created?: string;
  updated?: string;
};

const MAX_EXTRACT_CHARS = 48_000;
const MAX_CONTEXT_CHARS = 36_000;

export function isAiKnowledgeCategory(
  raw: string | null | undefined
): raw is AiKnowledgeCategory {
  return AI_KNOWLEDGE_CATEGORIES.includes(
    String(raw || "").trim().toUpperCase() as AiKnowledgeCategory
  );
}

export async function listAiKnowledgeDocs(opts?: {
  activeOnly?: boolean;
}): Promise<AiKnowledgeDoc[]> {
  const pb = await getAdminPocketBase();
  try {
    const filter = opts?.activeOnly ? "is_active = true" : "";
    return await pb.collection("ai_knowledge_docs").getFullList<AiKnowledgeDoc>({
      filter: filter || undefined,
      sort: "-updated",
      requestKey: null,
    });
  } catch {
    return [];
  }
}

/** Build prompt block from active docs (truncated for token budget). */
export async function buildKnowledgeBaseContext(): Promise<{
  context: string;
  docCount: number;
}> {
  const docs = await listAiKnowledgeDocs({ activeOnly: true });
  if (docs.length === 0) {
    return { context: "", docCount: 0 };
  }

  const chunks: string[] = [];
  let used = 0;
  for (const d of docs) {
    const body = String(d.extracted_text || "").trim();
    if (!body) continue;
    const header = `--- DOCUMENT: ${d.title} (${d.category}) ---`;
    const slice = body.slice(0, MAX_EXTRACT_CHARS);
    const block = `${header}\n${slice}`;
    if (used + block.length > MAX_CONTEXT_CHARS) {
      const remain = MAX_CONTEXT_CHARS - used;
      if (remain > 200) {
        chunks.push(block.slice(0, remain) + "\n…[truncated]");
      }
      break;
    }
    chunks.push(block);
    used += block.length + 2;
  }

  return {
    context: chunks.join("\n\n"),
    docCount: docs.length,
  };
}

function looksLikeTextMime(mime: string, name: string): boolean {
  const m = mime.toLowerCase();
  const n = name.toLowerCase();
  return (
    m.includes("text/") ||
    m.includes("markdown") ||
    n.endsWith(".txt") ||
    n.endsWith(".md") ||
    n.endsWith(".markdown") ||
    n.endsWith(".csv")
  );
}

function looksLikePdf(mime: string, name: string): boolean {
  return (
    mime.toLowerCase().includes("pdf") || name.toLowerCase().endsWith(".pdf")
  );
}

/** Naive PDF text scrape from content streams (no external PDF lib). */
function extractPdfTextRough(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const chunks: string[] = [];
  const re = /BT[\s\S]*?ET/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const block = match[0];
    const parts = block.match(/\((?:\\.|[^\\)])*\)/g) || [];
    for (const p of parts) {
      const inner = p
        .slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (inner.trim()) chunks.push(inner);
    }
  }
  const joined = chunks.join(" ").replace(/\s+/g, " ").trim();
  return joined.slice(0, MAX_EXTRACT_CHARS);
}

async function extractPdfViaGemini(
  buf: Buffer,
  mimeType: string
): Promise<string | null> {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;

  const model =
    String(process.env.GEMINI_MODEL || "").trim() || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const b64 = buf.toString("base64");
  // Cap ~8MB inline to stay within request limits
  if (b64.length > 10_000_000) return null;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType || "application/pdf",
                data: b64,
              },
            },
            {
              text: "Extract the full readable text from this document for our operations knowledge base. Preserve headings and bullet lists. Output plain text only.",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!res.ok) return null;
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
  return text ? text.slice(0, MAX_EXTRACT_CHARS) : null;
}

export async function extractTextFromUpload(file: File): Promise<{
  text: string;
  method: "utf8" | "pdf_rough" | "pdf_gemini" | "empty";
}> {
  const name = String(file.name || "document");
  const mime = String(file.type || "");
  const buf = Buffer.from(await file.arrayBuffer());

  if (looksLikeTextMime(mime, name)) {
    const text = buf.toString("utf8").slice(0, MAX_EXTRACT_CHARS);
    return { text, method: "utf8" };
  }

  if (looksLikePdf(mime, name)) {
    const viaGemini = await extractPdfViaGemini(
      buf,
      mime || "application/pdf"
    );
    if (viaGemini) return { text: viaGemini, method: "pdf_gemini" };

    const rough = extractPdfTextRough(buf);
    if (rough.length > 40) return { text: rough, method: "pdf_rough" };

    return {
      text: `[PDF uploaded: ${name}. Text extraction was limited — re-upload as .txt/.md or ensure GEMINI_API_KEY is set for PDF OCR.]`,
      method: "empty",
    };
  }

  // docx / unknown — store filename note; prefer .txt/.md/.pdf
  return {
    text: `[Binary document uploaded: ${name}. Convert to .txt, .md, or .pdf for full text indexing.]`,
    method: "empty",
  };
}

export async function uploadAiKnowledgeDoc(input: {
  title: string;
  category: AiKnowledgeCategory;
  file: File;
  uploadedBy?: string;
}): Promise<AiKnowledgeDoc> {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("title required");
  if (!isAiKnowledgeCategory(input.category)) {
    throw new Error("invalid category");
  }
  if (!(input.file instanceof File) || input.file.size <= 0) {
    throw new Error("document file required");
  }

  const { text } = await extractTextFromUpload(input.file);
  const pb = await getAdminPocketBase();

  const form = new FormData();
  form.append("title", title);
  form.append("category", input.category);
  form.append("is_active", "true");
  form.append("extracted_text", text);
  if (input.uploadedBy) form.append("uploaded_by", input.uploadedBy);
  form.append("document_file", input.file);

  const created = await pb
    .collection("ai_knowledge_docs")
    .create<AiKnowledgeDoc>(form, { requestKey: null });
  return created;
}

export async function setAiKnowledgeDocActive(
  id: string,
  isActive: boolean
): Promise<AiKnowledgeDoc> {
  const pb = await getAdminPocketBase();
  return pb.collection("ai_knowledge_docs").update<AiKnowledgeDoc>(
    id,
    { is_active: isActive },
    { requestKey: null }
  );
}

export async function deleteAiKnowledgeDoc(id: string): Promise<void> {
  const pb = await getAdminPocketBase();
  await pb.collection("ai_knowledge_docs").delete(id, { requestKey: null });
}
