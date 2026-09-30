"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Eye, Pencil } from "lucide-react";
import { getPbBaseUrl } from "@/lib/pocketbase/client";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTeamAuth } from "@/store/useTeamAuth";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  formatTransportType,
  TRANSPORT_TYPE_LABELS,
} from "@/lib/transportProducts";

type CatalogKind = "city" | "tour" | "activity" | "vehicle" | "transport";

type ListRow = {
  id: string;
  title: string;
  subtitle?: string;
  detail?: string;
  kind: CatalogKind;
  coverUrl?: string | null;
  description?: string;
};

const KIND_OPTIONS: { id: CatalogKind; label: string; blurb: string }[] = [
  { id: "city", label: "City", blurb: "Stay hub for multi-day trips" },
  { id: "tour", label: "Tour", blurb: "Guided multi-stop day" },
  {
    id: "activity",
    label: "Experience",
    blurb: "Ticket / VIP / single experience",
  },
  { id: "vehicle", label: "Vehicle", blurb: "Fleet car for private days" },
  {
    id: "transport",
    label: "Transport ticket",
    blurb: "Suica, bullet train, ferry, bike, ride",
  },
];

const VIBES = ["culture", "foodie", "modern", "nature", "multi_vibe"] as const;
const LANGS = [
  "English",
  "Japanese",
  "French",
  "German",
  "Spanish",
  "Italian",
  "Dutch",
  "Portuguese",
  "Chinese",
  "Korean",
] as const;

type FormState = Record<string, string | boolean | string[] | File | null>;

const emptyForm = (): FormState => ({
  name: "",
  title: "",
  description: "",
  route: "",
  city_id: "",
  audience: "both",
  vibe_tags: [] as string[],
  crowd_tag: "",
  pace_tag: "",
  media_type: "Image",
  price_1_pax: "",
  price_2_pax: "",
  price_3_pax: "",
  price_4_pax: "",
  price_extra_pax: "",
  base_price_eur: "",
  price_per_person: "",
  duration_hours: "",
  total_hours_note: "",
  explainer_url: "",
  languages: [] as string[],
  available_languages: [] as string[],
  base_price_modifier: "1",
  base_price: "",
  max_passengers: "7",
  transport_type: "suica",
  is_active: true,
  cover_file: null,
  media_file: null,
  video_file: null,
});

/**
 * Quiz-style Source of Truth catalog wizard.
 * Table like Team Access → + Add opens stepped kid-friendly flow → PB save.
 */
export function SourceOfTruthWizard() {
  const getClient = useTeamAuth((s) => s.getClient);
  const [filter, setFilter] = useState<"all" | CatalogKind>("all");
  const [rows, setRows] = useState<ListRow[]>([]);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ListRow | null>(null);
  const [viewRow, setViewRow] = useState<ListRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pb = getClient();
      const cityList = await pb.collection("cities").getFullList({
        sort: "sort_order,name",
        requestKey: null,
      });
      setCities(
        cityList.map((c) => ({ id: c.id, name: String(c.name || c.id) }))
      );

      const out: ListRow[] = [];
      for (const c of cityList) {
        out.push({
          id: c.id,
          title: String(c.name || c.id),
          subtitle: c.is_active === false ? "Inactive" : "Active",
          detail: c.base_price != null ? `€${c.base_price} base` : undefined,
          kind: "city",
          description: String(c.description || ""),
          coverUrl: c.cover_photo
            ? `${getPbBaseUrl()}/api/files/cities/${c.id}/${c.cover_photo}`
            : null,
        });
      }
      try {
        const tours = await pb.collection("tours").getFullList({
          sort: "title",
          requestKey: null,
        });
        for (const t of tours) {
          const cat =
            String(t.category || "tour").toLowerCase() === "activity"
              ? "activity"
              : "tour";
          out.push({
            id: t.id,
            title: String(t.title || t.id),
            subtitle: cat === "activity" ? "Experience" : "Tour",
            detail:
              t.duration_hours != null ? `${t.duration_hours}h` : undefined,
            kind: cat,
            description: String(t.description || ""),
            coverUrl: t.cover_photo
              ? `${getPbBaseUrl()}/api/files/tours/${t.id}/${t.cover_photo}`
              : null,
          });
        }
      } catch {
        /* tours optional */
      }
      try {
        const vehicles = await pb.collection("vehicles").getFullList({
          sort: "max_passengers",
          requestKey: null,
        });
        for (const v of vehicles) {
          out.push({
            id: v.id,
            title: String(v.name || v.type || v.id),
            subtitle: "Vehicle",
            detail:
              v.max_passengers != null
                ? `${v.max_passengers} pax`
                : undefined,
            kind: "vehicle",
            coverUrl: v.vehicle_image
              ? `${getPbBaseUrl()}/api/files/vehicles/${v.id}/${v.vehicle_image}`
              : null,
          });
        }
      } catch {
        /* */
      }
      try {
        const transports = await pb
          .collection("transport_products")
          .getFullList({ sort: "sort_order,name", requestKey: null });
        for (const t of transports) {
          out.push({
            id: t.id,
            title: String(t.name || t.id),
            subtitle: formatTransportType(String(t.transport_type || "")),
            detail:
              t.price_per_person != null
                ? `€${t.price_per_person}/pp`
                : undefined,
            kind: "transport",
            description: String(t.description || ""),
            coverUrl: t.cover_photo
              ? `${getPbBaseUrl()}/api/files/transport_products/${t.id}/${t.cover_photo}`
              : null,
          });
        }
      } catch {
        /* migration may not have run yet */
      }
      setRows(out);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.kind === filter)),
    [filter, rows]
  );

  return (
    <div className="min-h-[100dvh] bg-[#0B0F14] text-white">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0B0F14]/95 px-4 py-4 backdrop-blur">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#075473]">
            Source of Truth
          </p>
          <h1 className="font-display text-2xl">Catalog wizard</h1>
        </div>
        <Link
          href="/team-access"
          className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold"
        >
          ← Team Access
        </Link>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                "all",
                "city",
                "tour",
                "activity",
                "vehicle",
                "transport",
              ] as const
            ).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${
                  filter === k
                    ? "bg-[#075473] text-white"
                    : "border border-white/15 text-zinc-400"
                }`}
              >
                {k === "all" ? "All" : k === "activity" ? "Experiences" : k}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setEditTarget(null);
              setWizardOpen(true);
            }}
            className="rounded-full bg-[#075473] px-4 py-2 text-sm font-semibold text-white"
          >
            + Add
          </button>
        </div>

        {msg ? <p className="mb-3 text-sm text-[#1BA58A]">{msg}</p> : null}
        {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-zinc-500">Loading catalog…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
            No records yet. Click + Add.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-white/10 bg-black/40 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Record</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Details</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-b border-white/5">
                    <td className="px-3 py-2.5 font-medium text-white">
                      {row.title}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-400">
                      {row.subtitle}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">
                      {row.detail || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        Active
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <button
                        type="button"
                        className="mr-2 inline-flex items-center gap-1 text-[#7ec8e3]"
                        onClick={() => setViewRow(row)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[#F6A724]"
                        onClick={() => {
                          setEditTarget(row);
                          setWizardOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CatalogAddWizard
        open={wizardOpen}
        cities={cities}
        editTarget={editTarget}
        onClose={() => {
          setWizardOpen(false);
          setEditTarget(null);
        }}
        onSaved={async (label) => {
          setWizardOpen(false);
          setEditTarget(null);
          setMsg(`Saved · ${label}`);
          await reload();
        }}
        getClient={getClient}
      />

      {viewRow ? (
        <CatalogViewModal row={viewRow} onClose={() => setViewRow(null)} />
      ) : null}
    </div>
  );
}

function CatalogAddWizard({
  open,
  cities,
  editTarget,
  onClose,
  onSaved,
  getClient,
}: {
  open: boolean;
  cities: { id: string; name: string }[];
  editTarget: ListRow | null;
  onClose: () => void;
  onSaved: (label: string) => Promise<void>;
  getClient: () => ReturnType<
    ReturnType<typeof useTeamAuth.getState>["getClient"]
  >;
}) {
  const [kind, setKind] = useState<CatalogKind | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    document.body.style.overflow = "hidden";
    let cancelled = false;
    void (async () => {
      if (!editTarget) {
        setKind(null);
        setStep(0);
        setForm(emptyForm());
        setEditId(null);
        return;
      }
      setKind(editTarget.kind);
      setStep(0);
      setEditId(editTarget.id);
      const pb = getClient();
      const next = emptyForm();
      try {
        if (editTarget.kind === "city") {
          const r = await pb.collection("cities").getOne(editTarget.id);
          next.name = String(r.name || "");
          next.description = String(r.description || "");
          next.base_price = r.base_price != null ? String(r.base_price) : "";
          next.base_price_modifier = String(r.base_price_modifier || "1");
          next.available_languages = Array.isArray(r.available_languages)
            ? r.available_languages.map(String)
            : [];
          next.is_active = r.is_active !== false;
        } else if (editTarget.kind === "tour" || editTarget.kind === "activity") {
          const r = await pb.collection("tours").getOne(editTarget.id);
          next.city_id = String(r.city_id || "");
          next.audience = String(r.audience || "both");
          next.vibe_tags = Array.isArray(r.vibe_tags)
            ? r.vibe_tags.map(String)
            : [];
          next.crowd_tag = String(r.crowd_tag || "");
          next.pace_tag = String(r.pace_tag || "");
          next.title = String(r.title || "");
          next.description = String(r.description || "");
          next.route = String(r.route || "");
          next.price_1_pax = r.price_1_pax != null ? String(r.price_1_pax) : "";
          next.price_2_pax = r.price_2_pax != null ? String(r.price_2_pax) : "";
          next.price_3_pax = r.price_3_pax != null ? String(r.price_3_pax) : "";
          next.price_4_pax = r.price_4_pax != null ? String(r.price_4_pax) : "";
          next.price_extra_pax =
            r.price_extra_pax != null ? String(r.price_extra_pax) : "";
          next.base_price_eur =
            r.base_price_eur != null ? String(r.base_price_eur) : "";
          next.duration_hours =
            r.duration_hours != null ? String(r.duration_hours) : "";
          next.languages = Array.isArray(r.languages)
            ? r.languages.map(String)
            : [];
        } else if (editTarget.kind === "vehicle") {
          const r = await pb.collection("vehicles").getOne(editTarget.id);
          next.name = String(r.name || "");
          next.max_passengers =
            r.max_passengers != null ? String(r.max_passengers) : "7";
        } else {
          const r = await pb
            .collection("transport_products")
            .getOne(editTarget.id);
          next.name = String(r.name || "");
          next.transport_type = String(r.transport_type || "suica");
          next.city_id = String(r.city_id || "");
          next.description = String(r.description || "");
          next.duration_hours =
            r.duration_hours != null ? String(r.duration_hours) : "";
          next.total_hours_note = String(r.total_hours_note || "");
          next.price_per_person =
            r.price_per_person != null ? String(r.price_per_person) : "";
          next.explainer_url = String(r.explainer_url || "");
        }
      } catch (e) {
        if (!cancelled) setErr(formatPbError(e));
      }
      if (!cancelled) setForm(next);
    })();
    return () => {
      cancelled = true;
      document.body.style.overflow = "";
    };
  }, [open, editTarget, getClient]);

  const steps = useMemo(() => {
    if (!kind) return ["What is it?"];
    if (kind === "city") {
      return ["Basics", "Photo", "Price & languages", "Preview"];
    }
    if (kind === "tour" || kind === "activity") {
      return [
        "City & audience",
        "Vibes",
        "Story & route",
        "Media",
        "Price",
        "Languages & duration",
        "Preview",
      ];
    }
    if (kind === "vehicle") {
      return ["Basics", "Photo", "Preview"];
    }
    return [
      "Type & name",
      "Description & hours",
      "Price & explainer",
      "Media",
      "Preview",
    ];
  }, [kind]);

  const set = (key: string, value: FormState[string]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleMulti = (key: string, value: string) => {
    const cur = Array.isArray(form[key]) ? (form[key] as string[]) : [];
    set(
      key,
      cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value]
    );
  };

  const canNext = () => {
    if (!kind) return false;
    if (kind === "city") {
      if (step === 0) return Boolean(String(form.name || "").trim());
      return true;
    }
    if (kind === "tour" || kind === "activity") {
      if (step === 0) return Boolean(form.city_id);
      if (step === 2) return Boolean(String(form.title || "").trim());
      return true;
    }
    if (kind === "vehicle") {
      if (step === 0) return Boolean(String(form.name || "").trim());
      return true;
    }
    if (step === 0)
      return Boolean(String(form.name || "").trim() && form.transport_type);
    if (step === 2) return Boolean(form.price_per_person);
    return true;
  };

  const save = async () => {
    if (!kind) return;
    setSaving(true);
    setErr(null);
    try {
      const pb = getClient();
      let label = "";
      if (kind === "city") {
        const fd = new FormData();
        fd.append("name", String(form.name || "").trim());
        fd.append("description", String(form.description || ""));
        fd.append(
          "base_price_modifier",
          String(form.base_price_modifier || "1")
        );
        if (form.base_price) fd.append("base_price", String(form.base_price));
        fd.append(
          "available_languages",
          JSON.stringify(form.available_languages || [])
        );
        fd.append("is_active", form.is_active ? "true" : "false");
        if (form.cover_file instanceof File) {
          fd.append("cover_photo", form.cover_file);
        }
        const row = editId
          ? await pb.collection("cities").update(editId, fd)
          : await pb.collection("cities").create(fd);
        label = String(row.name || "City");
      } else if (kind === "tour" || kind === "activity") {
        const fd = new FormData();
        fd.append("city_id", String(form.city_id));
        fd.append("category", kind === "activity" ? "activity" : "tour");
        fd.append("audience", String(form.audience || "both"));
        fd.append("vibe_tags", JSON.stringify(form.vibe_tags || []));
        if (form.crowd_tag) fd.append("crowd_tag", String(form.crowd_tag));
        if (form.pace_tag) fd.append("pace_tag", String(form.pace_tag));
        fd.append("title", String(form.title || "").trim());
        fd.append("description", String(form.description || ""));
        fd.append("route", String(form.route || ""));
        fd.append("media_type", String(form.media_type || "Image"));
        fd.append("price_1_pax", String(form.price_1_pax || "0"));
        fd.append("price_2_pax", String(form.price_2_pax || "0"));
        fd.append("price_3_pax", String(form.price_3_pax || "0"));
        fd.append("price_4_pax", String(form.price_4_pax || "0"));
        fd.append("price_extra_pax", String(form.price_extra_pax || "0"));
        if (form.base_price_eur)
          fd.append("base_price_eur", String(form.base_price_eur));
        if (form.duration_hours)
          fd.append("duration_hours", String(form.duration_hours));
        fd.append("languages", JSON.stringify(form.languages || []));
        fd.append("is_active", "true");
        if (form.cover_file instanceof File)
          fd.append("cover_photo", form.cover_file);
        if (form.media_file instanceof File)
          fd.append("media_file", form.media_file);
        const row = editId
          ? await pb.collection("tours").update(editId, fd)
          : await pb.collection("tours").create(fd);
        label = String(row.title || "Tour");
      } else if (kind === "vehicle") {
        const fd = new FormData();
        fd.append("name", String(form.name || "").trim());
        fd.append("max_passengers", String(form.max_passengers || "7"));
        fd.append("is_active", "true");
        if (form.cover_file instanceof File)
          fd.append("vehicle_image", form.cover_file);
        const row = editId
          ? await pb.collection("vehicles").update(editId, fd)
          : await pb.collection("vehicles").create(fd);
        label = String(row.name || "Vehicle");
      } else {
        const fd = new FormData();
        fd.append("name", String(form.name || "").trim());
        fd.append("transport_type", String(form.transport_type || "other"));
        fd.append("description", String(form.description || ""));
        fd.append("price_per_person", String(form.price_per_person || "0"));
        if (form.duration_hours)
          fd.append("duration_hours", String(form.duration_hours));
        if (form.total_hours_note)
          fd.append("total_hours_note", String(form.total_hours_note));
        if (form.explainer_url)
          fd.append("explainer_url", String(form.explainer_url));
        if (form.city_id) fd.append("city_id", String(form.city_id));
        fd.append("is_active", "true");
        if (form.cover_file instanceof File)
          fd.append("cover_photo", form.cover_file);
        if (form.video_file instanceof File)
          fd.append("explainer_video", form.video_file);
        const row = editId
          ? await pb.collection("transport_products").update(editId, fd)
          : await pb.collection("transport_products").create(fd);
        label = String(row.name || "Transport");
      }
      await onSaved(label);
    } catch (e) {
      setErr(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  const previewTitle =
    kind === "city"
      ? String(form.name || "New city")
      : kind === "vehicle"
        ? String(form.name || "New vehicle")
        : kind === "transport"
          ? String(form.name || "Transport ticket")
          : String(form.title || "New experience");

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex flex-col bg-[#05080C]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
            <button
              type="button"
              onClick={() => {
                if (!kind || step === 0) onClose();
                else if (step === 0) setKind(null);
                else setStep((s) => s - 1);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#075473]">
                {kind
                  ? KIND_OPTIONS.find((k) => k.id === kind)?.label
                  : "New registry"}{" "}
                · Step {kind ? step + 1 : 0}/{kind ? steps.length : "?"}
              </p>
              <h2 className="truncate font-godiva text-xl uppercase text-white">
                {kind ? steps[step] : "What are we creating?"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs"
            >
              Close
            </button>
          </div>

          <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 py-6">
            {!kind ? (
              <div className="grid gap-3">
                {KIND_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setKind(opt.id);
                      setStep(0);
                      if (opt.id === "activity") {
                        setForm((f) => ({ ...f }));
                      }
                    }}
                    className="rounded-2xl border border-white/10 bg-[#0D1117] px-4 py-4 text-left hover:border-[#075473]"
                  >
                    <p className="font-godiva text-lg uppercase text-white">
                      {opt.label}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">{opt.blurb}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {kind === "city" && step === 0 ? (
                  <>
                    <Field label="Name *">
                      <input
                        className={INP}
                        value={String(form.name || "")}
                        onChange={(e) => set("name", e.target.value)}
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        className={INP}
                        rows={4}
                        value={String(form.description || "")}
                        onChange={(e) => set("description", e.target.value)}
                      />
                    </Field>
                  </>
                ) : null}
                {kind === "city" && step === 1 ? (
                  <MediaPicker
                    label="Cover photo"
                    accept="image/*"
                    file={form.cover_file instanceof File ? form.cover_file : null}
                    onChange={(f) => set("cover_file", f)}
                    recommend="Cover ~1200×800 · under 180KB"
                  />
                ) : null}
                {kind === "city" && step === 2 ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Base price modifier *">
                        <input
                          className={INP}
                          value={String(form.base_price_modifier || "1")}
                          onChange={(e) =>
                            set("base_price_modifier", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Base price (€)">
                        <input
                          className={INP}
                          value={String(form.base_price || "")}
                          onChange={(e) => set("base_price", e.target.value)}
                        />
                      </Field>
                    </div>
                    <Field label="Languages">
                      <PillRow
                        options={[...LANGS]}
                        selected={(form.available_languages as string[]) || []}
                        onToggle={(v) => toggleMulti("available_languages", v)}
                      />
                    </Field>
                  </>
                ) : null}

                {(kind === "tour" || kind === "activity") && step === 0 ? (
                  <>
                    <Field label="City *">
                      <select
                        className={INP}
                        value={String(form.city_id || "")}
                        onChange={(e) => set("city_id", e.target.value)}
                      >
                        <option value="">Select city</option>
                        {cities.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p className="text-xs text-zinc-500">
                      Category locked:{" "}
                      {kind === "activity" ? "Experience" : "Tour"}
                    </p>
                    <Field label="Audience">
                      <select
                        className={INP}
                        value={String(form.audience || "both")}
                        onChange={(e) => set("audience", e.target.value)}
                      >
                        <option value="both">Both</option>
                        <option value="agency">Travel agencies only</option>
                        <option value="individual">Individuals only</option>
                      </select>
                    </Field>
                  </>
                ) : null}
                {(kind === "tour" || kind === "activity") && step === 1 ? (
                  <>
                    <Field label="Vibe tags">
                      <PillRow
                        options={[...VIBES]}
                        selected={(form.vibe_tags as string[]) || []}
                        onToggle={(v) => toggleMulti("vibe_tags", v)}
                      />
                    </Field>
                    <Field label="Crowd / highlight">
                      <select
                        className={INP}
                        value={String(form.crowd_tag || "")}
                        onChange={(e) => set("crowd_tag", e.target.value)}
                      >
                        <option value="">Select…</option>
                        <option value="hidden_gem">Hidden gem</option>
                        <option value="classic_highlight">
                          Classic highlight
                        </option>
                        <option value="balanced_mix">Balanced mix</option>
                      </select>
                    </Field>
                    <Field label="Pace">
                      <select
                        className={INP}
                        value={String(form.pace_tag || "")}
                        onChange={(e) => set("pace_tag", e.target.value)}
                      >
                        <option value="">Select…</option>
                        <option value="relaxed">Relaxed</option>
                        <option value="standard">Standard</option>
                        <option value="active">Active</option>
                      </select>
                    </Field>
                  </>
                ) : null}
                {(kind === "tour" || kind === "activity") && step === 2 ? (
                  <>
                    <Field label="Title *">
                      <input
                        className={INP}
                        value={String(form.title || "")}
                        onChange={(e) => set("title", e.target.value)}
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        className={INP}
                        rows={4}
                        value={String(form.description || "")}
                        onChange={(e) => set("description", e.target.value)}
                      />
                    </Field>
                    <Field label="Route">
                      <textarea
                        className={INP}
                        rows={3}
                        value={String(form.route || "")}
                        onChange={(e) => set("route", e.target.value)}
                      />
                    </Field>
                  </>
                ) : null}
                {(kind === "tour" || kind === "activity") && step === 3 ? (
                  <>
                    <MediaPicker
                      label="Cover photo"
                      accept="image/*"
                      file={form.cover_file instanceof File ? form.cover_file : null}
                      onChange={(f) => set("cover_file", f)}
                      recommend="Cover ~1200×800 · under 180KB"
                    />
                    <MediaPicker
                      label="Media file (image / video)"
                      accept="image/*,video/*"
                      file={form.media_file instanceof File ? form.media_file : null}
                      onChange={(f) => set("media_file", f)}
                      recommend="Optional · under 5MB for video"
                    />
                  </>
                ) : null}
                {(kind === "tour" || kind === "activity") && step === 4 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        "price_1_pax",
                        "price_2_pax",
                        "price_3_pax",
                        "price_4_pax",
                        "price_extra_pax",
                        "base_price_eur",
                      ] as const
                    ).map((k) => (
                      <Field key={k} label={k.replace(/_/g, " ")}>
                        <input
                          className={INP}
                          value={String(form[k] || "")}
                          onChange={(e) => set(k, e.target.value)}
                        />
                      </Field>
                    ))}
                  </div>
                ) : null}
                {(kind === "tour" || kind === "activity") && step === 5 ? (
                  <>
                    <Field label="Duration (hours)">
                      <input
                        className={INP}
                        value={String(form.duration_hours || "")}
                        onChange={(e) => set("duration_hours", e.target.value)}
                      />
                    </Field>
                    <Field label="Languages">
                      <PillRow
                        options={[...LANGS]}
                        selected={(form.languages as string[]) || []}
                        onToggle={(v) => toggleMulti("languages", v)}
                      />
                    </Field>
                  </>
                ) : null}

                {kind === "vehicle" && step === 0 ? (
                  <>
                    <Field label="Vehicle name *">
                      <input
                        className={INP}
                        value={String(form.name || "")}
                        onChange={(e) => set("name", e.target.value)}
                      />
                    </Field>
                    <Field label="Max passengers">
                      <input
                        className={INP}
                        value={String(form.max_passengers || "7")}
                        onChange={(e) => set("max_passengers", e.target.value)}
                      />
                    </Field>
                  </>
                ) : null}
                {kind === "vehicle" && step === 1 ? (
                  <MediaPicker
                    label="Vehicle image"
                    accept="image/*"
                    file={form.cover_file instanceof File ? form.cover_file : null}
                    onChange={(f) => set("cover_file", f)}
                    recommend="Vehicle ~1200×800 · under 180KB"
                  />
                ) : null}

                {kind === "transport" && step === 0 ? (
                  <>
                    <Field label="Type *">
                      <select
                        className={INP}
                        value={String(form.transport_type || "suica")}
                        onChange={(e) => set("transport_type", e.target.value)}
                      >
                        {Object.entries(TRANSPORT_TYPE_LABELS).map(
                          ([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </Field>
                    <Field label="Name *">
                      <input
                        className={INP}
                        value={String(form.name || "")}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="e.g. Suica day pass"
                      />
                    </Field>
                    <Field label="City (optional)">
                      <select
                        className={INP}
                        value={String(form.city_id || "")}
                        onChange={(e) => set("city_id", e.target.value)}
                      >
                        <option value="">Any / nationwide</option>
                        {cities.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                ) : null}
                {kind === "transport" && step === 1 ? (
                  <>
                    <Field label="Description">
                      <textarea
                        className={INP}
                        rows={4}
                        value={String(form.description || "")}
                        onChange={(e) => set("description", e.target.value)}
                      />
                    </Field>
                    <Field label="Duration / total hours">
                      <input
                        className={INP}
                        value={String(form.duration_hours || "")}
                        onChange={(e) => set("duration_hours", e.target.value)}
                      />
                    </Field>
                    <Field label="Hours note (make it clear)">
                      <input
                        className={INP}
                        value={String(form.total_hours_note || "")}
                        onChange={(e) =>
                          set("total_hours_note", e.target.value)
                        }
                        placeholder="e.g. Valid 24h from first tap"
                      />
                    </Field>
                  </>
                ) : null}
                {kind === "transport" && step === 2 ? (
                  <>
                    <Field label="Price per person (€) *">
                      <input
                        className={INP}
                        value={String(form.price_per_person || "")}
                        onChange={(e) =>
                          set("price_per_person", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Explainer link (URL)">
                      <input
                        className={INP}
                        value={String(form.explainer_url || "")}
                        onChange={(e) => set("explainer_url", e.target.value)}
                      />
                    </Field>
                    <Field label="Explainer video">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) =>
                          set("video_file", e.target.files?.[0] || null)
                        }
                      />
                    </Field>
                  </>
                ) : null}
                {kind === "transport" && step === 3 ? (
                  <MediaPicker
                    label="Cover photo"
                    accept="image/*"
                    file={form.cover_file instanceof File ? form.cover_file : null}
                    onChange={(f) => set("cover_file", f)}
                    recommend="Cover ~1200×800 · under 180KB"
                  />
                ) : null}

                {/* Preview — Discover-style card */}
                {((kind === "city" && step === 3) ||
                  ((kind === "tour" || kind === "activity") && step === 6) ||
                  (kind === "vehicle" && step === 2) ||
                  (kind === "transport" && step === 4)) && (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]">
                    <div className="relative aspect-[4/5] bg-gradient-to-br from-[#1a2840] to-[#0A1017]">
                      {form.cover_file instanceof File ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={URL.createObjectURL(form.cover_file)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-end p-4">
                          <p className="font-godiva text-2xl uppercase text-white">
                            {previewTitle}
                          </p>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                        <p className="font-godiva text-lg uppercase text-white">
                          {previewTitle}
                        </p>
                        <p className="mt-1 text-xs text-zinc-300">
                          {kind === "transport"
                            ? `${formatTransportType(String(form.transport_type))} · €${form.price_per_person || "—"}/pp`
                            : kind === "city"
                              ? "City hub"
                              : `${form.duration_hours || "—"}h · Discover card preview`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {err ? <p className="text-sm text-red-400">{err}</p> : null}
              </div>
            )}
          </div>

          {kind ? (
            <div className="border-t border-white/10 px-4 py-4">
              <div className="mx-auto flex max-w-lg gap-2">
                {step < steps.length - 1 ? (
                  <button
                    type="button"
                    disabled={!canNext()}
                    onClick={() => setStep((s) => s + 1)}
                    className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving || !canNext()}
                    onClick={() => void save()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1BA58A] py-3 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" />
                    {saving
                      ? "Saving…"
                      : editId
                        ? "Update registry"
                        : "Save to registry"}
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

const INP =
  "w-full rounded-xl border border-white/15 bg-[#121212] px-3 py-2.5 text-sm text-white";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function PillRow({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              on
                ? "border-[#075473] bg-[#075473] text-white"
                : "border-white/15 text-zinc-400"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaPicker({
  label,
  accept,
  file,
  onChange,
  recommend,
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (f: File | null) => void;
  recommend: string;
}) {
  const [dims, setDims] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setDims(null);
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    const img = new Image();
    img.onload = () => {
      setDims(`${img.naturalWidth}×${img.naturalHeight}px`);
    };
    img.onerror = () => setDims(null);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <Field label={label}>
      <input
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      {file ? (
        <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="max-h-40 w-full rounded-lg object-cover"
            />
          ) : (
            <p className="text-xs text-zinc-400">{file.name}</p>
          )}
          <p className="text-xs text-zinc-300">
            {formatBytes(file.size)}
            {dims ? ` · ${dims}` : ""}
          </p>
          <p className="text-[11px] text-zinc-500">{recommend}</p>
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-zinc-500">{recommend}</p>
      )}
    </Field>
  );
}

function CatalogViewModal({
  row,
  onClose,
}: {
  row: ListRow;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-4 sm:items-center">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]">
        <div className="relative aspect-[4/5] bg-gradient-to-br from-[#1a2840] to-[#0A1017]">
          {row.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.coverUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
            <p className="font-godiva text-lg uppercase text-white">{row.title}</p>
            <p className="mt-1 text-xs text-zinc-300">
              {row.subtitle}
              {row.detail ? ` · ${row.detail}` : ""}
            </p>
            {row.description ? (
              <p className="mt-2 line-clamp-3 text-xs text-zinc-400">
                {row.description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="p-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-white/20 py-2.5 text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

