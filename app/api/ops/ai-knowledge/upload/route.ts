import { NextResponse } from "next/server";
import {
  isAiKnowledgeCategory,
  uploadAiKnowledgeDoc,
  type AiKnowledgeCategory,
} from "@/lib/aiKnowledgeDocs";

/**
 * POST /api/ops/ai-knowledge/upload
 * multipart: title, category, document_file [, uploaded_by]
 * Alias of POST /api/ops/ai-knowledge for the AI Rules manager form.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const categoryRaw = String(form.get("category") || "GENERAL_SOP")
      .trim()
      .toUpperCase();
    const uploadedBy = String(form.get("uploaded_by") || "").trim();
    const file =
      form.get("document_file") || form.get("file") || form.get("document");

    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    if (!isAiKnowledgeCategory(categoryRaw)) {
      return NextResponse.json(
        { error: "invalid category" },
        { status: 400 }
      );
    }
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json(
        { error: "document_file required" },
        { status: 400 }
      );
    }

    const doc = await uploadAiKnowledgeDoc({
      title,
      category: categoryRaw as AiKnowledgeCategory,
      file,
      uploadedBy: uploadedBy || undefined,
    });

    return NextResponse.json({
      ok: true,
      doc: {
        id: doc.id,
        title: doc.title,
        category: doc.category,
        is_active: doc.is_active !== false,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
