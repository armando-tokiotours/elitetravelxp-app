/// <reference path="../pb_data/types.d.ts" />
/**
 * AI knowledge base — uploaded SOP / rules documents for Gemini Assist.
 */
migrate((app) => {
  try {
    app.findCollectionByNameOrId("ai_knowledge_docs");
    console.log("[1791080000] ai_knowledge_docs already exists");
    return;
  } catch (_) {
    /* create */
  }

  const col = new Collection({
    type: "base",
    name: "ai_knowledge_docs",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
    fields: [
      { name: "title", type: "text", required: true, max: 200 },
      {
        name: "category",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["PRICING", "TRANSIT", "DISPATCH", "GENERAL_SOP"],
      },
      {
        name: "document_file",
        type: "file",
        required: false,
        maxSelect: 1,
        maxSize: 15728640,
        mimeTypes: [
          "application/pdf",
          "text/plain",
          "text/markdown",
          "text/x-markdown",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      },
      { name: "extracted_text", type: "editor", required: false },
      { name: "is_active", type: "bool", required: false },
      { name: "uploaded_by", type: "text", required: false, max: 120 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX idx_ai_knowledge_active ON ai_knowledge_docs (`is_active`)",
      "CREATE INDEX idx_ai_knowledge_category ON ai_knowledge_docs (`category`)",
    ],
  });
  app.save(col);
  console.log("[1791080000] ai_knowledge_docs created");
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId("ai_knowledge_docs"));
  } catch (_) {
    /* ignore */
  }
});
