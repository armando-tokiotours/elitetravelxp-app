import { NextResponse } from "next/server";
import {
  deleteAiKnowledgeDoc,
  isAiKnowledgeCategory,
  listAiKnowledgeDocs,
  setAiKnowledgeDocActive,
  uploadAiKnowledgeDoc,
  type AiKnowledgeCategory,
} from "@/lib/aiKnowledgeDocs";

/**
 * GET /api/ops/ai-knowledge — list knowledge docs
 * POST multipart — upload (title, category, document_file, uploaded_by?)
 * PATCH JSON — { id, is_active }
 * DELETE JSON — { id }
 */

export async function GET() {
  try {
    const docs = await listAiKnowledgeDocs();
    return NextResponse.json({
      ok: true,
      docs: docs.map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        is_active: d.is_active !== false,
        uploaded_by: d.uploaded_by || null,
        created: d.created || null,
        updated: d.updated || null,
        has_text: Boolean(String(d.extracted_text || "").trim()),
        text_preview: String(d.extracted_text || "")
          .trim()
          .slice(0, 180),
        document_file: d.document_file || null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "List failed" },
      { status: 500 }
    );
  }
}

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
        { error: "category must be PRICING | TRANSIT | DISPATCH | GENERAL_SOP" },
        { status: 400 }
      );
    }
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json(
        { error: "document_file required (.pdf, .txt, .md)" },
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
        has_text: Boolean(String(doc.extracted_text || "").trim()),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; is_active?: boolean };
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const doc = await setAiKnowledgeDocActive(id, Boolean(body.is_active));
    return NextResponse.json({
      ok: true,
      doc: { id: doc.id, is_active: doc.is_active !== false },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await deleteAiKnowledgeDoc(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
