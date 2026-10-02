"use client";

import type PocketBase from "pocketbase";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { JapanKeyword } from "@/components/branding/JapanKeyword";
import { optimizeFileForUpload } from "@/lib/optimizeUploadClient";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  DEFAULT_HOMEPAGE_HERO_INTRO,
  DEFAULT_HOMEPAGE_HERO_TEXT_SLOTS,
  fetchSiteBranding,
  heroTextOrientationStyle,
  heroTextRoleClass,
  resolveHomepageHeroIntro,
  serializeHomepageHeroIntroConfig,
  type HomepageHeroCardId,
  type HomepageHeroCardConfig,
  type HomepageHeroIntroTextId,
  type HomepageHeroOverlayLayout,
  type HomepageHeroTextOrientation,
  type HomepageHeroTextRole,
  type HomepageHeroTextSlot,
  type PbSiteBranding,
} from "@/lib/pocketbase/client";

type PbClient = PocketBase;

type CardDraft = Omit<HomepageHeroCardConfig, "route" | "tripType"> & {
  photoFile: File | null;
};

type SelectedTarget =
  | { kind: "intro"; id: HomepageHeroIntroTextId }
  | { kind: "overlay"; id: HomepageHeroCardId };

const CARD_LABELS: Record<HomepageHeroCardId, string> = {
  single: "Single Day Tour",
  experience: "Services / Tickets (Builder E)",
  multiday: "Multi-Day Journey",
};

const CARD_ORDER: HomepageHeroCardId[] = [
  "single",
  "experience",
  "multiday",
];

const INTRO_ELEMENTS: Array<{ id: HomepageHeroIntroTextId; label: string }> = [
  { id: "scriptTitle", label: "1 · Highlight (DESIGN)" },
  { id: "mainTitle", label: "2 · H1 (dream trip)" },
  { id: "tagline", label: "3 · Supporting line" },
];

const PHOTO_FIELD: Record<HomepageHeroCardId, string> = {
  single: "hero_card_single_photo",
  experience: "hero_card_experience_photo",
  multiday: "hero_card_multiday_photo",
};

function draftsFromIntro(
  cards: HomepageHeroCardConfig[]
): Record<HomepageHeroCardId, CardDraft> {
  const next = {} as Record<HomepageHeroCardId, CardDraft>;
  for (const id of CARD_ORDER) {
    const c =
      cards.find((x) => x.id === id) ||
      DEFAULT_HOMEPAGE_HERO_INTRO.cards.find((x) => x.id === id)!;
    next[id] = {
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      japaneseText: c.japaneseText,
      japaneseTextPosition: c.japaneseTextPosition,
      overlay: { ...c.overlay },
      heroPhotoUrl: c.heroPhotoUrl,
      order: c.order,
      photoFile: null,
    };
  }
  return next;
}

function cloneTextLayouts(
  layouts: Record<HomepageHeroIntroTextId, HomepageHeroTextSlot>
) {
  return {
    mainTitle: { ...layouts.mainTitle },
    scriptTitle: { ...layouts.scriptTitle },
    tagline: { ...layouts.tagline },
  };
}

export function HomepageHeroCardsAdminStudio({
  getClient,
}: {
  getClient: () => PbClient;
}) {
  const [record, setRecord] = useState<PbSiteBranding | null>(null);
  const [mainTitle, setMainTitle] = useState(
    DEFAULT_HOMEPAGE_HERO_INTRO.mainTitle
  );
  const [scriptTitle, setScriptTitle] = useState(
    DEFAULT_HOMEPAGE_HERO_INTRO.scriptTitle
  );
  const [tagline, setTagline] = useState(DEFAULT_HOMEPAGE_HERO_INTRO.tagline);
  const [textLayouts, setTextLayouts] = useState(() =>
    cloneTextLayouts(DEFAULT_HOMEPAGE_HERO_INTRO.textLayouts)
  );
  const [drafts, setDrafts] = useState(() =>
    draftsFromIntro(DEFAULT_HOMEPAGE_HERO_INTRO.cards)
  );
  const [selected, setSelected] = useState<SelectedTarget>({
    kind: "intro",
    id: "scriptTitle",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    target: SelectedTarget;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);
  const autosaveTimer = useRef<number | null>(null);
  const skipNextAutosave = useRef(true);
  const textEditingRef = useRef(false);
  const saveGenRef = useRef(0);
  const snapshotRef = useRef({
    record,
    mainTitle,
    scriptTitle,
    tagline,
    textLayouts,
    drafts,
  });
  snapshotRef.current = {
    record,
    mainTitle,
    scriptTitle,
    tagline,
    textLayouts,
    drafts,
  };

  const applyRecord = useCallback((row: PbSiteBranding | null) => {
    const intro = resolveHomepageHeroIntro(row);
    setMainTitle(intro.mainTitle);
    setScriptTitle(intro.scriptTitle);
    setTagline(intro.tagline);
    setTextLayouts(cloneTextLayouts(intro.textLayouts));
    setDrafts(draftsFromIntro(intro.cards));
  }, []);

  /** After save: keep local copy; only refresh photo URLs from the server. */
  const mergePhotosFromRecord = useCallback((row: PbSiteBranding | null) => {
    if (!row) return;
    const intro = resolveHomepageHeroIntro(row);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of CARD_ORDER) {
        const serverUrl = intro.cards.find((c) => c.id === id)?.heroPhotoUrl;
        if (!serverUrl) continue;
        // Keep local blob preview while a new file is queued
        if (prev[id].photoFile) continue;
        next[id] = { ...prev[id], heroPhotoUrl: serverUrl, photoFile: null };
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await fetchSiteBranding();
        if (cancelled) return;
        setRecord(row);
        applyRecord(row);
        skipNextAutosave.current = true;
      } catch (e) {
        if (!cancelled) setError(formatPbError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyRecord]);

  const persist = useCallback(async () => {
    const snap = snapshotRef.current;
    const gen = ++saveGenRef.current;
    setSaving(true);
    setSaveStatus("saving");
    setError(null);
    setMsg(null);
    try {
      const pb = getClient();
      const cards = CARD_ORDER.map((id) => {
        const d = snap.drafts[id];
        return {
          id: d.id,
          title: d.title,
          subtitle: d.subtitle,
          japaneseText: d.japaneseText,
          japaneseTextPosition: d.japaneseTextPosition,
          overlay: d.overlay,
          order: d.order,
        };
      });
      const payload = serializeHomepageHeroIntroConfig({
        mainTitle: snap.mainTitle,
        scriptTitle: snap.scriptTitle,
        tagline: snap.tagline,
        textLayouts: snap.textLayouts,
        cards,
      });
      const fd = new FormData();
      fd.append("hero_intro_config", payload);
      for (const id of CARD_ORDER) {
        const file = snap.drafts[id].photoFile;
        if (file) fd.append(PHOTO_FIELD[id], file);
      }

      let saved: PbSiteBranding;
      if (snap.record?.id) {
        saved = (await pb
          .collection("site_branding")
          .update(snap.record.id, fd)) as unknown as PbSiteBranding;
      } else {
        saved = (await pb
          .collection("site_branding")
          .create(fd)) as unknown as PbSiteBranding;
      }

      // Stale response (newer save already started) — ignore UI overwrite
      if (gen !== saveGenRef.current) return;

      setRecord(saved);
      skipNextAutosave.current = true;
      // Never re-apply copy into inputs while typing — that was wiping edits.
      if (!textEditingRef.current) {
        mergePhotosFromRecord(saved);
      }
      setSaveStatus("saved");
      setMsg("Saved to PocketBase. Homepage updates on refresh / tab focus.");
    } catch (e) {
      if (gen !== saveGenRef.current) return;
      const err = formatPbError(e);
      setError(
        err.includes("hero_intro") || err.includes("Unknown field")
          ? `${err} — apply PocketBase migration 1790930000_homepage_hero_cards first.`
          : err
      );
      setSaveStatus("error");
    } finally {
      if (gen === saveGenRef.current) setSaving(false);
    }
  }, [getClient, mergePhotosFromRecord]);

  const scheduleSave = useCallback(() => {
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    // Don't autosave mid-keystroke — wait until blur / Save / drag-end
    if (textEditingRef.current) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void persist();
    }, 600);
  }, [persist]);

  // Autosave layout / card draft changes (not while typing titles)
  useEffect(() => {
    if (loading) return;
    scheduleSave();
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [
    loading,
    mainTitle,
    scriptTitle,
    tagline,
    textLayouts,
    drafts,
    scheduleSave,
  ]);

  const beginTextEdit = (id?: HomepageHeroIntroTextId) => {
    textEditingRef.current = true;
    if (id) setSelected({ kind: "intro", id });
  };

  const endTextEdit = () => {
    textEditingRef.current = false;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    void persist();
  };
  const updateIntroSlot = (
    id: HomepageHeroIntroTextId,
    patch: Partial<HomepageHeroTextSlot>
  ) => {
    setTextLayouts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const updateOverlay = (
    id: HomepageHeroCardId,
    patch: Partial<HomepageHeroOverlayLayout>
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], overlay: { ...prev[id].overlay, ...patch } },
    }));
  };

  const updateCard = <K extends keyof CardDraft>(
    id: HomepageHeroCardId,
    key: K,
    value: CardDraft[K]
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  };

  const handlePhoto = async (id: HomepageHeroCardId, file: File | null) => {
    if (!file) return;
    const { file: optimized } = await optimizeFileForUpload(file);
    const url = URL.createObjectURL(optimized);
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], photoFile: optimized, heroPhotoUrl: url },
    }));
  };

  const currentLeftTop = (): { left: number; top: number } => {
    if (selected.kind === "intro") {
      const s = textLayouts[selected.id];
      return { left: s.left, top: s.top };
    }
    const o = drafts[selected.id].overlay;
    return { left: o.left, top: o.top };
  };

  const onPointerDown = (target: SelectedTarget, e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(target);
    const pos =
      target.kind === "intro"
        ? textLayouts[target.id]
        : drafts[target.id].overlay;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      target,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: pos.left,
      originTop: pos.top,
    };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    const box = canvasRef.current;
    if (!drag || !box) return;
    const rect = box.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
    const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;
    const left = Math.min(
      90,
      Math.max(0, Math.round((drag.originLeft + dxPct) * 10) / 10)
    );
    const top = Math.min(
      90,
      Math.max(0, Math.round((drag.originTop + dyPct) * 10) / 10)
    );
    if (drag.target.kind === "intro") {
      updateIntroSlot(drag.target.id, { left, top });
    } else {
      updateOverlay(drag.target.id, { left, top });
    }
  };

  const onPointerUp = () => {
    if (dragRef.current) {
      dragRef.current = null;
      // Force save after drag so position always lands in PocketBase
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      void persist();
      return;
    }
    dragRef.current = null;
  };

  const selectedSlot =
    selected.kind === "intro" ? textLayouts[selected.id] : null;
  const selectedOverlay =
    selected.kind === "overlay" ? drafts[selected.id].overlay : null;
  const pos = currentLeftTop();

  if (loading) {
    return (
      <p className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">
        Loading Main Intro hero cards…
      </p>
    );
  }

  return (
    <div className="space-y-8 rounded-2xl border border-white/10 bg-[#0D1117] p-5 text-white sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h3 className="font-godiva text-lg text-[#F6A724]">
            Homepage Hero Cards &amp; Typography Control Studio
          </h3>
          <p className="mt-1 text-xs text-gray-400">
            Edit titles freely — they save on{" "}
            <span className="text-zinc-200">blur</span> or{" "}
            <span className="text-zinc-200">Save changes</span> (no more wipe
            while typing). Drag layouts still autosave. Homepage refreshes on
            tab focus.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void persist()}
          className="rounded-xl bg-[#075473] px-5 py-2.5 text-xs font-bold tracking-wider text-white uppercase shadow-lg transition hover:bg-[#075473]/80 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="rounded-2xl border border-zinc-800 bg-[#0D1117] p-4 sm:p-5">
          <p className="mb-3 text-[0.65rem] font-semibold tracking-[0.18em] text-[#075473] uppercase">
            Homepage preview · drag any text / layover
          </p>
          <div
            ref={canvasRef}
            className="tokio-ambient-bg relative min-h-[20rem] overflow-hidden rounded-xl border border-dashed border-zinc-700/80 sm:min-h-[22rem]"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {INTRO_ELEMENTS.map((el) => {
              const slot = textLayouts[el.id];
              const on = selected.kind === "intro" && selected.id === el.id;
              const copy =
                el.id === "mainTitle"
                  ? mainTitle
                  : el.id === "scriptTitle"
                    ? scriptTitle
                    : tagline;
              return (
                <div
                  key={el.id}
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) =>
                    onPointerDown({ kind: "intro", id: el.id }, e)
                  }
                  className={`absolute z-30 cursor-grab px-1.5 py-1 active:cursor-grabbing ${
                    on
                      ? "rounded-md ring-2 ring-[#075473] ring-offset-1 ring-offset-[#05080C]"
                      : "hover:ring-1 hover:ring-white/30"
                  }`}
                  style={{
                    left: `${slot.left}%`,
                    top: `${slot.top}%`,
                    maxWidth: `${slot.maxWidth}%`,
                    fontSize: `${Math.max(10, slot.fontSize * 0.12)}px`,
                    ...heroTextOrientationStyle(slot.orientation),
                  }}
                >
                  {el.id === "scriptTitle" ? (
                    <JapanKeyword
                      className={`text-[#E02B49] ${heroTextRoleClass(slot.role)}`}
                    >
                      {copy || "DESIGN"}
                    </JapanKeyword>
                  ) : (
                    <span
                      className={`text-white whitespace-pre-line ${heroTextRoleClass(slot.role)} ${
                        el.id === "tagline" ? "text-gray-300" : ""
                      }`}
                    >
                      {copy || el.label}
                    </span>
                  )}
                </div>
              );
            })}

            <div className="absolute inset-x-4 bottom-3 grid grid-cols-3 gap-2 sm:inset-x-6">
              {CARD_ORDER.map((id) => {
                const card = drafts[id];
                const on = selected.kind === "overlay" && selected.id === id;
                return (
                  <div
                    key={id}
                    className="relative aspect-[9/16] overflow-hidden rounded-lg border border-white/10 bg-zinc-900/80"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.heroPhotoUrl}
                      alt=""
                      className="h-full w-full object-cover opacity-80"
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      onPointerDown={(e) =>
                        onPointerDown({ kind: "overlay", id }, e)
                      }
                      className={`absolute z-20 cursor-grab active:cursor-grabbing ${
                        on
                          ? "ring-2 ring-[#F6A724] ring-offset-1 ring-offset-black"
                          : ""
                      }`}
                      style={{
                        left: `${card.overlay.left}%`,
                        top: `${card.overlay.top}%`,
                        fontSize: `${Math.max(8, card.overlay.fontSize * 0.09)}px`,
                        ...heroTextOrientationStyle(card.overlay.orientation),
                      }}
                    >
                      <span
                        className={`inline-block rounded border border-white/20 bg-black/25 px-1.5 py-0.5 tracking-widest text-white/90 uppercase backdrop-blur-[2px] ${heroTextRoleClass(
                          card.overlay.role
                        )}`}
                      >
                        {card.japaneseText || "JP"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              Elements
            </p>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {INTRO_ELEMENTS.map((el) => (
                <li key={el.id}>
                  <button
                    type="button"
                    onClick={() => setSelected({ kind: "intro", id: el.id })}
                    className={
                      selected.kind === "intro" && selected.id === el.id
                        ? "flex w-full rounded-lg bg-[#075473]/30 px-2 py-1.5 text-left text-xs font-semibold text-[#7dd3fc]"
                        : "flex w-full rounded-lg px-2 py-1.5 text-left text-xs text-zinc-400 hover:bg-zinc-800"
                    }
                  >
                    {el.label}
                  </button>
                </li>
              ))}
              <li className="pt-2 text-[0.6rem] font-semibold tracking-wider text-zinc-600 uppercase">
                Card layovers
              </li>
              {CARD_ORDER.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setSelected({ kind: "overlay", id })}
                    className={
                      selected.kind === "overlay" && selected.id === id
                        ? "flex w-full rounded-lg bg-[#F6A724]/20 px-2 py-1.5 text-left text-xs font-semibold text-[#F6A724]"
                        : "flex w-full rounded-lg px-2 py-1.5 text-left text-xs text-zinc-400 hover:bg-zinc-800"
                    }
                  >
                    Overlay · {CARD_LABELS[id]}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              Selected ·{" "}
              {selected.kind === "intro"
                ? INTRO_ELEMENTS.find((e) => e.id === selected.id)?.label
                : `Overlay · ${CARD_LABELS[selected.id]}`}
            </p>

            <label className="mt-3 block text-xs text-zinc-400">
              Left % ({pos.left})
              <input
                type="range"
                min={0}
                max={90}
                step={0.5}
                value={pos.left}
                onChange={(e) => {
                  const left = Number(e.target.value);
                  if (selected.kind === "intro")
                    updateIntroSlot(selected.id, { left });
                  else updateOverlay(selected.id, { left });
                }}
                className="mt-1 w-full accent-[#075473]"
              />
            </label>
            <label className="mt-2 block text-xs text-zinc-400">
              Top % ({pos.top})
              <input
                type="range"
                min={0}
                max={90}
                step={0.5}
                value={pos.top}
                onChange={(e) => {
                  const top = Number(e.target.value);
                  if (selected.kind === "intro")
                    updateIntroSlot(selected.id, { top });
                  else updateOverlay(selected.id, { top });
                }}
                className="mt-1 w-full accent-[#075473]"
              />
            </label>

            {selectedSlot ? (
              <>
                <label className="mt-2 block text-xs text-zinc-400">
                  Max width % ({selectedSlot.maxWidth})
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={1}
                    value={selectedSlot.maxWidth}
                    onChange={(e) =>
                      updateIntroSlot(selected.id as HomepageHeroIntroTextId, {
                        maxWidth: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full accent-[#075473]"
                  />
                </label>
                <label className="mt-2 block text-xs text-zinc-400">
                  Size % ({selectedSlot.fontSize})
                  <input
                    type="range"
                    min={20}
                    max={220}
                    step={1}
                    value={selectedSlot.fontSize}
                    onChange={(e) =>
                      updateIntroSlot(selected.id as HomepageHeroIntroTextId, {
                        fontSize: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full accent-[#075473]"
                  />
                </label>
                <label className="mt-2 block text-xs text-zinc-400">
                  Type role
                  <select
                    value={selectedSlot.role}
                    onChange={(e) =>
                      updateIntroSlot(selected.id as HomepageHeroIntroTextId, {
                        role: e.target.value as HomepageHeroTextRole,
                      })
                    }
                    className="mt-1 w-full rounded border border-white/10 bg-[#0A1017] px-2 py-1.5 text-white"
                  >
                    <option value="h1">H1</option>
                    <option value="h2">H2</option>
                    <option value="body">Body / text</option>
                  </select>
                </label>
                <label className="mt-2 block text-xs text-zinc-400">
                  Orientation
                  <select
                    value={selectedSlot.orientation}
                    onChange={(e) =>
                      updateIntroSlot(selected.id as HomepageHeroIntroTextId, {
                        orientation: e.target
                          .value as HomepageHeroTextOrientation,
                      })
                    }
                    className="mt-1 w-full rounded border border-white/10 bg-[#0A1017] px-2 py-1.5 text-white"
                  >
                    <option value="horizontal">Horizontal</option>
                    <option value="vertical">Vertical</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    updateIntroSlot(
                      selected.id as HomepageHeroIntroTextId,
                      DEFAULT_HOMEPAGE_HERO_TEXT_SLOTS[
                        selected.id as HomepageHeroIntroTextId
                      ]
                    )
                  }
                  className="mt-3 w-full rounded-lg border border-zinc-700 px-2 py-1.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase hover:border-zinc-500"
                >
                  Reset this text
                </button>
              </>
            ) : null}

            {selectedOverlay && selected.kind === "overlay" ? (
              <>
                <label className="mt-2 block text-xs text-zinc-400">
                  Size % ({selectedOverlay.fontSize})
                  <input
                    type="range"
                    min={20}
                    max={220}
                    step={1}
                    value={selectedOverlay.fontSize}
                    onChange={(e) =>
                      updateOverlay(selected.id, {
                        fontSize: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full accent-[#F6A724]"
                  />
                </label>
                <label className="mt-2 block text-xs text-zinc-400">
                  Type role
                  <select
                    value={selectedOverlay.role}
                    onChange={(e) =>
                      updateOverlay(selected.id, {
                        role: e.target.value as HomepageHeroTextRole,
                      })
                    }
                    className="mt-1 w-full rounded border border-white/10 bg-[#0A1017] px-2 py-1.5 text-white"
                  >
                    <option value="h1">H1</option>
                    <option value="h2">H2</option>
                    <option value="body">Body / text</option>
                  </select>
                </label>
                <label className="mt-2 block text-xs text-zinc-400">
                  Orientation
                  <select
                    value={selectedOverlay.orientation}
                    onChange={(e) =>
                      updateOverlay(selected.id, {
                        orientation: e.target
                          .value as HomepageHeroTextOrientation,
                      })
                    }
                    className="mt-1 w-full rounded border border-white/10 bg-[#0A1017] px-2 py-1.5 text-white"
                  >
                    <option value="horizontal">Horizontal</option>
                    <option value="vertical">Vertical</option>
                  </select>
                </label>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-white/5 bg-black/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold tracking-wider text-cyan-400 uppercase">
            Main Header Titles — exact order
          </h4>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              const nextScript = DEFAULT_HOMEPAGE_HERO_INTRO.scriptTitle;
              const nextMain = DEFAULT_HOMEPAGE_HERO_INTRO.mainTitle;
              const nextTag = DEFAULT_HOMEPAGE_HERO_INTRO.tagline;
              textEditingRef.current = false;
              setScriptTitle(nextScript);
              setMainTitle(nextMain);
              setTagline(nextTag);
              snapshotRef.current = {
                ...snapshotRef.current,
                scriptTitle: nextScript,
                mainTitle: nextMain,
                tagline: nextTag,
              };
              skipNextAutosave.current = true;
              void persist();
            }}
            className="rounded-lg border border-[#F6A724]/40 bg-[#F6A724]/10 px-3 py-1.5 text-[10px] font-bold tracking-wider text-[#F6A724] uppercase hover:bg-[#F6A724]/20 disabled:opacity-50"
          >
            Load this design copy
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-gray-400">
              1 · Highlight (H1 line 1)
            </label>
            <input
              type="text"
              value={scriptTitle}
              onChange={(e) => setScriptTitle(e.target.value)}
              onFocus={() => beginTextEdit("scriptTitle")}
              onBlur={endTextEdit}
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-gray-400">
              2 · H1 (line 2 — use Enter for second row)
            </label>
            <textarea
              value={mainTitle}
              rows={2}
              onChange={(e) => setMainTitle(e.target.value)}
              onFocus={() => beginTextEdit("mainTitle")}
              onBlur={endTextEdit}
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-white uppercase"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-gray-400">3 · Supporting line</label>
            <textarea
              value={tagline}
              rows={3}
              onChange={(e) => setTagline(e.target.value)}
              onFocus={() => beginTextEdit("tagline")}
              onBlur={endTextEdit}
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {CARD_ORDER.map((cardKey) => {
          const card = drafts[cardKey];
          return (
            <div
              key={cardKey}
              className="space-y-4 rounded-xl border border-white/5 bg-black/40 p-5 text-xs"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h4 className="font-bold text-amber-400 uppercase">
                  Card: {CARD_LABELS[cardKey]}
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Display Order:</span>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={card.order}
                    onChange={(e) =>
                      updateCard(cardKey, "order", Number(e.target.value) || 1)
                    }
                    className="w-12 rounded border border-white/10 bg-white/5 px-2 py-1 text-center text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="mb-1 block text-gray-400">
                    Card Cover Photo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      void handlePhoto(cardKey, e.target.files?.[0] ?? null)
                    }
                    className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-gray-300"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.heroPhotoUrl}
                    alt=""
                    className="mt-2 aspect-[3/4] w-full max-w-[9rem] rounded-lg border border-white/10 object-cover"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-gray-400">
                    Title &amp; subtitle (mobile: left 1/3 · desktop: below
                    card)
                  </label>
                  <input
                    type="text"
                    value={card.title}
                    onChange={(e) =>
                      updateCard(cardKey, "title", e.target.value)
                    }
                    onFocus={() => beginTextEdit()}
                    onBlur={endTextEdit}
                    className="mb-2 w-full rounded border border-white/10 bg-white/5 px-3 py-1.5 text-white"
                  />
                  <label className="mb-1 block text-gray-400">
                    Subtitle / Details
                  </label>
                  <input
                    type="text"
                    value={card.subtitle}
                    onChange={(e) =>
                      updateCard(cardKey, "subtitle", e.target.value)
                    }
                    onFocus={() => beginTextEdit()}
                    onBlur={endTextEdit}
                    className="w-full rounded border border-white/10 bg-white/5 px-3 py-1.5 text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-gray-400">
                    Text Inside Photo Box (layover)
                  </label>
                  <input
                    type="text"
                    value={card.japaneseText}
                    onChange={(e) =>
                      updateCard(cardKey, "japaneseText", e.target.value)
                    }
                    onFocus={() => {
                      beginTextEdit();
                      setSelected({ kind: "overlay", id: cardKey });
                    }}
                    onBlur={endTextEdit}
                    className="mb-2 w-full rounded border border-white/10 bg-white/5 px-3 py-1.5 text-white"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Position / size / H1·H2·body / orientation via Elements list
                    or preview drag. Click Save changes when done.
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void persist()}
        className="w-full rounded-xl bg-[#075473] py-3.5 text-xs font-bold tracking-wider text-white uppercase shadow-lg transition-colors hover:bg-[#075473]/80 disabled:opacity-50"
      >
        {saving
          ? "Saving…"
          : saveStatus === "saved"
            ? "Saved — Save again"
            : "Save changes to PocketBase"}
      </button>
    </div>
  );
}
