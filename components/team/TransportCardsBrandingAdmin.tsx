"use client";

import type PocketBase from "pocketbase";
import { useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  TRANSPORT_CARD_FALLBACKS,
  TRANSPORT_CARD_MODE_ORDER,
  uiTransportCardImageUrl,
  type PbUiTransportCard,
  type TransportCardModeId,
} from "@/lib/uiTransportCards";

type Draft = {
  title: string;
  description: string;
  subtext: string;
  file: File | null;
  preview: string;
};

function draftFromRow(row: PbUiTransportCard): Draft {
  const mode = String(row.mode_id || "").toLowerCase() as TransportCardModeId;
  const fb = TRANSPORT_CARD_FALLBACKS[mode];
  return {
    title: row.title || fb?.title || "",
    description: row.description || fb?.description || "",
    subtext: row.subtext ?? fb?.subtext ?? "",
    file: null,
    preview:
      uiTransportCardImageUrl(row, "400x400") ||
      uiTransportCardImageUrl(row) ||
      fb?.image ||
      "",
  };
}

export function TransportCardsBrandingAdmin({
  getClient,
}: {
  getClient: () => PocketBase;
}) {
  const [rows, setRows] = useState<PbUiTransportCard[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      let list = await pb
        .collection("ui_transport_cards")
        .getFullList<PbUiTransportCard>({
          sort: "sort_order,mode_id",
          requestKey: null,
        });

      // Ensure the three modes exist (migration seed may not have run yet).
      const have = new Set(
        list.map((r) => String(r.mode_id || "").toLowerCase())
      );
      for (const mode of TRANSPORT_CARD_MODE_ORDER) {
        if (have.has(mode)) continue;
        const fb = TRANSPORT_CARD_FALLBACKS[mode];
        const created = (await pb.collection("ui_transport_cards").create({
          mode_id: mode,
          title: fb.title,
          description: fb.description,
          subtext: fb.subtext,
          sort_order: TRANSPORT_CARD_MODE_ORDER.indexOf(mode) + 1,
        })) as unknown as PbUiTransportCard;
        list = [...list, created];
      }

      list = [...list].sort((a, b) => {
        const ia = TRANSPORT_CARD_MODE_ORDER.indexOf(
          String(a.mode_id).toLowerCase() as TransportCardModeId
        );
        const ib = TRANSPORT_CARD_MODE_ORDER.indexOf(
          String(b.mode_id).toLowerCase() as TransportCardModeId
        );
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });

      setRows(list);
      const next: Record<string, Draft> = {};
      for (const row of list) next[row.id] = draftFromRow(row);
      setDrafts(next);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const saveRow = async (row: PbUiTransportCard) => {
    const draft = drafts[row.id];
    if (!draft) return;
    setSavingId(row.id);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const fd = new FormData();
      fd.append("title", draft.title);
      fd.append("description", draft.description);
      fd.append("subtext", draft.subtext);
      if (draft.file) fd.append("image", draft.file);

      const saved = (await pb
        .collection("ui_transport_cards")
        .update(row.id, fd)) as unknown as PbUiTransportCard;

      setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      setDrafts((prev) => ({
        ...prev,
        [saved.id]: draftFromRow(saved),
      }));
      setMsg(`Saved “${saved.mode_id}”.`);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div>
        <h3 className="font-display text-lg text-zinc-100">
          Transport Selection Cards
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Images, titles, and copy for Self-arranged / Public / Private in the
          builder transport step. Layout and lock rules stay in code.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading transport cards…</p>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {rows.map((row) => {
          const draft = drafts[row.id];
          if (!draft) return null;
          const mode = String(row.mode_id || "").toUpperCase();
          return (
            <article
              key={row.id}
              className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <p className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
                {mode}
              </p>
              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                {draft.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.preview}
                    alt=""
                    className="aspect-[3/4] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center text-xs text-zinc-600">
                    No image
                  </div>
                )}
              </div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                Image
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full text-xs text-zinc-400"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    updateDraft(row.id, {
                      file: f,
                      preview: f
                        ? URL.createObjectURL(f)
                        : draftFromRow(row).preview,
                    });
                  }}
                />
              </label>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                Title
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) =>
                    updateDraft(row.id, { title: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                Description
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) =>
                    updateDraft(row.id, { description: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
                Subtext
                <input
                  type="text"
                  value={draft.subtext}
                  onChange={(e) =>
                    updateDraft(row.id, { subtext: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-white"
                  placeholder="e.g. Invoice €0"
                />
              </label>
              <button
                type="button"
                disabled={savingId === row.id}
                onClick={() => void saveRow(row)}
                className="w-full rounded-lg bg-[#075473] py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {savingId === row.id ? "Saving…" : "Save card"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
