"use client";

import type PocketBase from "pocketbase";
import { useEffect, useState } from "react";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  BRANDING_UI_FALLBACKS,
  CONCIERGE_POSTER_FALLBACK,
  isVideoFilename,
} from "@/lib/brandingUi";
import {
  brandingUiMediaUrl,
  brandingUiPosterUrl,
  type PbBrandingUiItem,
} from "@/lib/pocketbase/client";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

type PbClient = PocketBase;

const CATEGORY_LABEL: Record<string, string> = {
  pace: "Travel Pace cards",
  quiz_vibe: "Style Quiz · Vibe",
  quiz_pace: "Style Quiz · Pace",
  quiz_crowd: "Style Quiz · Access",
  concierge: "Elite Concierge modal",
  matcher: "Activity Matcher banner",
  planner: "Budget Planner page",
  value: "Value proposition",
};

const CATEGORY_ORDER = [
  "value",
  "matcher",
  "planner",
  "concierge",
  "pace",
  "quiz_vibe",
  "quiz_pace",
  "quiz_crowd",
] as const;

type Draft = {
  title: string;
  subtitle: string;
  description: string;
  ctaPrimary: string;
  ctaSecondary: string;
  inclusionTitle: string;
  inclusionBody: string;
  creditTitle: string;
  creditBody: string;
  file: File | null;
  posterFile: File | null;
  preview: string;
  posterPreview: string;
};

function draftFromRow(row: PbBrandingUiItem): Draft {
  const fb = BRANDING_UI_FALLBACKS[row.key];
  const media = brandingUiMediaUrl(row) || fb?.mediaFallback || "";
  const poster =
    brandingUiPosterUrl(row) ||
    (row.key === "elite_concierge_modal" ? CONCIERGE_POSTER_FALLBACK : "");
  return {
    title: row.title || fb?.title || "",
    subtitle: row.subtitle || fb?.subtitle || "",
    description: row.description || fb?.description || "",
    ctaPrimary: row.cta_primary || fb?.ctaPrimary || "",
    ctaSecondary: row.cta_secondary || fb?.ctaSecondary || "",
    inclusionTitle: row.inclusion_title || fb?.inclusionTitle || "",
    inclusionBody: row.inclusion_body || fb?.inclusionBody || "",
    creditTitle: row.credit_title || fb?.creditTitle || "",
    creditBody: row.credit_body || fb?.creditBody || "",
    file: null,
    posterFile: null,
    preview: media,
    posterPreview: poster,
  };
}

export function BrandingUiCardsAdmin({
  getClient,
}: {
  getClient: () => PbClient;
}) {
  const [rows, setRows] = useState<PbBrandingUiItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const list = await pb
        .collection("branding_ui_items")
        .getFullList<PbBrandingUiItem>({ sort: "sort_order,key" });
      // Prefer elite_concierge_modal over legacy concierge_preview in the UI
      const hasElite = list.some((r) => r.key === "elite_concierge_modal");
      const visible = hasElite
        ? list.filter((r) => r.key !== "concierge_preview")
        : list;
      setRows(visible);
      const next: Record<string, Draft> = {};
      for (const row of visible) {
        next[row.id] = draftFromRow(row);
      }
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

  const saveRow = async (row: PbBrandingUiItem) => {
    const draft = drafts[row.id];
    if (!draft) return;
    setSavingKey(row.key);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const fd = new FormData();
      fd.append("title", draft.title);
      fd.append("subtitle", draft.subtitle);
      fd.append("description", draft.description);
      fd.append("cta_primary", draft.ctaPrimary);
      fd.append("cta_secondary", draft.ctaSecondary);
      fd.append("inclusion_title", draft.inclusionTitle);
      fd.append("inclusion_body", draft.inclusionBody);
      fd.append("credit_title", draft.creditTitle);
      fd.append("credit_body", draft.creditBody);
      if (draft.file) fd.append("media", draft.file);
      if (draft.posterFile) fd.append("poster", draft.posterFile);

      const saved = (await pb
        .collection("branding_ui_items")
        .update(row.id, fd)) as unknown as PbBrandingUiItem;

      setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      setDrafts((prev) => ({
        ...prev,
        [saved.id]: draftFromRow(saved),
      }));
      useSiteBrandingStore.setState({ loaded: false, itemsByKey: {} });
      setMsg(`Saved “${saved.key}”.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : formatPbError(e));
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-[#8A8278]">Loading UI branding cards…</p>
    );
  }

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABEL[cat] || cat,
    items: rows.filter((r) => r.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5 sm:p-6">
      <h2 className="font-display text-2xl text-[#0B1F3A]">
        Quiz &amp; UI Cards
      </h2>
      <p className="mt-1 text-sm text-[#8A8278]">
        Edit Value Proposition messaging, Discover Activity Matcher banner,
        Budget Planner hero, Elite Concierge modal, Travel Pace cards, and Style
        Quiz options. Empty fields fall back to built-in copy and media.
      </p>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {msg ? <p className="mt-3 text-sm text-emerald-700">{msg}</p> : null}

      {byCategory.length === 0 ? (
        <p className="mt-4 rounded-xl border border-accent-200 bg-accent-50 p-3 text-sm text-accent-900">
          No <code>branding_ui_items</code> records yet. Restart PocketBase so
          migrations can seed defaults.
        </p>
      ) : null}

      <div className="mt-6 space-y-8">
        {byCategory.map((group) => (
          <section key={group.cat}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B85304]">
              {group.label}
            </h3>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {group.items.map((row) => {
                const draft = drafts[row.id];
                if (!draft) return null;
                const fb = BRANDING_UI_FALLBACKS[row.key];
                const isMatcher = row.key === "activity_matcher_banner";
                const isBudgetPlanner = row.key === "budget_planner";
                const isValueProp = row.key === "value_proposition";
                const isConcierge = row.key === "elite_concierge_modal";
                const previewIsVideo =
                  (draft.file && isVideoFilename(draft.file.name)) ||
                  isVideoFilename(draft.preview);
                const wide =
                  isMatcher || isBudgetPlanner || isConcierge || isValueProp;

                return (
                  <div
                    key={row.id}
                    className={`rounded-2xl border border-[#E8E2D9] bg-[#FBF8F2] p-4 ${
                      wide ? "lg:col-span-2" : ""
                    }`}
                  >
                    <p className="font-mono text-[11px] text-[#8A8278]">
                      {row.key}
                    </p>

                    <div
                      className={`mt-3 grid gap-3 ${
                        isConcierge ? "sm:grid-cols-2" : ""
                      }`}
                    >
                      <div className="overflow-hidden rounded-xl border border-[#D9D2C7] bg-white">
                        {draft.preview ? (
                          previewIsVideo ? (
                            <video
                              src={draft.preview}
                              poster={draft.posterPreview || undefined}
                              className="aspect-video w-full object-cover"
                              muted
                              playsInline
                              controls
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={draft.preview}
                              alt=""
                              className="aspect-[21/9] w-full object-cover"
                            />
                          )
                        ) : (
                          <div className="flex aspect-video items-center justify-center text-sm text-[#8A8278]">
                            Fallback media
                            {fb?.mediaFallback ? ` (${fb.mediaFallback})` : ""}
                          </div>
                        )}
                      </div>
                      {isConcierge ? (
                        <div className="overflow-hidden rounded-xl border border-[#D9D2C7] bg-white">
                          {draft.posterPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={draft.posterPreview}
                              alt=""
                              className="aspect-video w-full object-cover"
                            />
                          ) : (
                            <div className="flex aspect-video items-center justify-center text-sm text-[#8A8278]">
                              Poster fallback ({CONCIERGE_POSTER_FALLBACK})
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                      {isConcierge
                        ? "Preview video (.mp4 / .m4v / .webm)"
                        : isMatcher || isBudgetPlanner
                          ? isBudgetPlanner
                            ? "Hero banner image (budget_planner_hero_image)"
                            : "Background image / poster"
                          : "Media (image or video)"}
                      <input
                        type="file"
                        accept={
                          isConcierge
                            ? "video/mp4,video/webm,video/quicktime,.m4v"
                            : isMatcher || isBudgetPlanner
                              ? "image/*"
                              : "image/*,video/mp4,video/webm,video/quicktime,.m4v"
                        }
                        className="mt-1 block w-full text-sm"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          updateDraft(row.id, {
                            file: f,
                            preview: f
                              ? URL.createObjectURL(f)
                              : draft.preview,
                          });
                        }}
                      />
                    </label>

                    {isConcierge ? (
                      <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                        Hero poster image
                        <input
                          type="file"
                          accept="image/*"
                          className="mt-1 block w-full text-sm"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            updateDraft(row.id, {
                              posterFile: f,
                              posterPreview: f
                                ? URL.createObjectURL(f)
                                : draft.posterPreview,
                            });
                          }}
                        />
                      </label>
                    ) : null}

                    <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                      {isValueProp
                        ? "Section header"
                        : isBudgetPlanner
                          ? "Headline title"
                          : isMatcher
                            ? "Section eyebrow label"
                            : isConcierge
                              ? "Section header"
                              : "Card title"}
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(e) =>
                          updateDraft(row.id, { title: e.target.value })
                        }
                        placeholder={fb?.title}
                        className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                      />
                    </label>

                    <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                      {isValueProp
                        ? "Core hook"
                        : isBudgetPlanner
                          ? "Header eyebrow label"
                          : isMatcher
                            ? "Banner headline"
                            : isConcierge
                              ? "Deposit subtitle"
                              : "Card subtitle"}
                      <input
                        type="text"
                        value={draft.subtitle}
                        onChange={(e) =>
                          updateDraft(row.id, { subtitle: e.target.value })
                        }
                        placeholder={fb?.subtitle}
                        className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                      />
                    </label>

                    {isValueProp ? (
                      <>
                        <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                          Value bullets (one per line)
                          <textarea
                            rows={5}
                            value={draft.description}
                            onChange={(e) =>
                              updateDraft(row.id, {
                                description: e.target.value,
                              })
                            }
                            placeholder={fb?.description}
                            className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                          />
                        </label>
                        <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                          Why Book an Elite Specialist? (title)
                          <input
                            type="text"
                            value={draft.inclusionTitle}
                            onChange={(e) =>
                              updateDraft(row.id, {
                                inclusionTitle: e.target.value,
                              })
                            }
                            placeholder={fb?.inclusionTitle}
                            className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                          />
                        </label>
                        <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                          Why Book body
                          <textarea
                            rows={3}
                            value={draft.inclusionBody}
                            onChange={(e) =>
                              updateDraft(row.id, {
                                inclusionBody: e.target.value,
                              })
                            }
                            placeholder={fb?.inclusionBody}
                            className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                          />
                        </label>
                        <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                          Self-guided comparison line
                          <input
                            type="text"
                            value={draft.creditTitle}
                            onChange={(e) =>
                              updateDraft(row.id, {
                                creditTitle: e.target.value,
                              })
                            }
                            placeholder={fb?.creditTitle}
                            className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                          />
                        </label>
                        <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                          Elite guided comparison line
                          <textarea
                            rows={2}
                            value={draft.creditBody}
                            onChange={(e) =>
                              updateDraft(row.id, {
                                creditBody: e.target.value,
                              })
                            }
                            placeholder={fb?.creditBody}
                            className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                          />
                        </label>
                      </>
                    ) : null}

                    {isBudgetPlanner ? (
                      <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                        Subtitle copy
                        <textarea
                          rows={3}
                          value={draft.description}
                          onChange={(e) =>
                            updateDraft(row.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder={fb?.description}
                          className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                        />
                      </label>
                    ) : null}

                    {isMatcher || isBudgetPlanner ? (
                      <>
                        <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                          Primary CTA button text
                          <input
                            type="text"
                            value={draft.ctaPrimary}
                            onChange={(e) =>
                              updateDraft(row.id, {
                                ctaPrimary: e.target.value,
                              })
                            }
                            placeholder={fb?.ctaPrimary}
                            className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                          />
                        </label>
                        <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                          Secondary CTA button text
                          <input
                            type="text"
                            value={draft.ctaSecondary}
                            onChange={(e) =>
                              updateDraft(row.id, {
                                ctaSecondary: e.target.value,
                              })
                            }
                            placeholder={fb?.ctaSecondary}
                            className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                          />
                        </label>
                      </>
                    ) : null}

                    {isConcierge ? (
                      <>
                        <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                          &quot;What&apos;s included&quot; box title
                          <input
                            type="text"
                            value={draft.inclusionTitle}
                            onChange={(e) =>
                              updateDraft(row.id, {
                                inclusionTitle: e.target.value,
                              })
                            }
                            placeholder={fb?.inclusionTitle}
                            className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                          />
                        </label>
                        <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                          &quot;What&apos;s included&quot; body
                          <textarea
                            rows={8}
                            value={draft.inclusionBody}
                            onChange={(e) =>
                              updateDraft(row.id, {
                                inclusionBody: e.target.value,
                              })
                            }
                            placeholder={fb?.inclusionBody}
                            className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                          />
                          <span className="mt-1 block text-[11px] normal-case tracking-normal text-[#A39A8E]">
                            Use blank lines between paragraphs. Start lines with
                            • for checklist bullets.
                          </span>
                        </label>
                        <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                          &quot;100% Credit Offer&quot; box title
                          <input
                            type="text"
                            value={draft.creditTitle}
                            onChange={(e) =>
                              updateDraft(row.id, {
                                creditTitle: e.target.value,
                              })
                            }
                            placeholder={fb?.creditTitle}
                            className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                          />
                        </label>
                        <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                          &quot;100% Credit Offer&quot; body
                          <textarea
                            rows={5}
                            value={draft.creditBody}
                            onChange={(e) =>
                              updateDraft(row.id, {
                                creditBody: e.target.value,
                              })
                            }
                            placeholder={fb?.creditBody}
                            className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                          />
                        </label>
                      </>
                    ) : null}

                    {!isMatcher && !isConcierge ? (
                      <label className="mt-3 block text-xs uppercase tracking-wider text-[#8A8278]">
                        Modal description
                        <textarea
                          rows={5}
                          value={draft.description}
                          onChange={(e) =>
                            updateDraft(row.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder={fb?.description}
                          className="mt-1 w-full rounded-xl border border-[#D9D2C7] px-3 py-2.5 text-sm text-[#0B1F3A]"
                        />
                      </label>
                    ) : null}

                    <button
                      type="button"
                      disabled={savingKey === row.key}
                      onClick={() => void saveRow(row)}
                      className="mt-4 rounded-full bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#143052] disabled:opacity-50"
                    >
                      {savingKey === row.key ? "Saving…" : "Save card"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
