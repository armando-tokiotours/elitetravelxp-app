"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  Pencil,
  Upload,
} from "lucide-react";
import { getPbBaseUrl } from "@/lib/pocketbase/client";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTeamAuth } from "@/store/useTeamAuth";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  catalogTabLabel,
  downloadCatalogExport,
  downloadCatalogTemplate,
  importCatalogCsv,
  type CatalogCsvTab,
} from "@/lib/catalogCsvHub";
import { uploadToVps } from "@/lib/vpsUploadClient";
import {
  CatalogSlotCell,
  CatalogSlotImg,
} from "@/components/catalog/CatalogSlotPhoto";
import {
  formatTransportType,
  TRANSPORT_TYPE_LABELS,
} from "@/lib/transportProducts";
import {
  groupToursByFamily,
  stripDurationFromTitle,
  type TourFamilyMember,
} from "@/lib/tourFamilies";
import { catalogMediaSlot, ensureCatalogPlaceholder } from "@/lib/catalogMedia";

type CatalogKind =
  | "city"
  | "tour"
  | "activity"
  | "cluster"
  | "vehicle"
  | "transport";

type ListRow = {
  id: string;
  title: string;
  subtitle?: string;
  detail?: string;
  kind: CatalogKind;
  coverUrl?: string | null;
  description?: string;
  /** Tour-family grouping (tours/activities only). */
  familyMasterId?: string;
  familyTitle?: string;
  isFamilyMaster?: boolean;
  familyVariantCount?: number;
};

const KIND_OPTIONS: { id: CatalogKind; label: string; blurb: string }[] = [
  { id: "city", label: "City", blurb: "Stay hub for multi-day trips" },
  {
    id: "tour",
    label: "Tour",
    blurb: "Full guided day — private guide included",
  },
  {
    id: "activity",
    label: "Experience / Ticket",
    blurb: "TeamLab, Disney, Sumo — ticketed third-party",
  },
  {
    id: "cluster",
    label: "Regional Cluster",
    blurb: "Neighborhood sector · €0 · spends 8h day budget",
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
  family_mode: "master",
  family_id: "",
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
  cover_url: "",
  media_url: "",
});

/**
 * Kid-friendly Source of Truth catalog wizard + CSV import/export hub.
 * Tours & Experiences both live in `tours` (category tour vs activity).
 */
export function SourceOfTruthWizard() {
  const getClient = useTeamAuth((s) => s.getClient);
  const [filter, setFilter] = useState<CatalogCsvTab>("all");
  const [rows, setRows] = useState<ListRow[]>([]);
  const [tourRecords, setTourRecords] = useState<TourFamilyMember[]>([]);
  const [wizardPreset, setWizardPreset] = useState<{
    kind: CatalogKind;
    familyMasterId: string;
  } | null>(null);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [exportCache, setExportCache] = useState<{
    cities: Record<string, unknown>[];
    tours: Record<string, unknown>[];
    vehicles: Record<string, unknown>[];
    transports: Record<string, unknown>[];
  }>({ cities: [], tours: [], vehicles: [], transports: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ListRow | null>(null);
  const [viewRow, setViewRow] = useState<ListRow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(
    new Set()
  );
  const toggleFamily = (masterId: string) =>
    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(masterId)) next.delete(masterId);
      else next.add(masterId);
      return next;
    });
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      let tourList: Record<string, unknown>[] = [];
      let vehicleList: Record<string, unknown>[] = [];
      let transportList: Record<string, unknown>[] = [];

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
        tourList = tours as Record<string, unknown>[];
        setTourRecords(
          (tours as Record<string, unknown>[]).map((t) => ({
            id: String(t.id),
            title: String(t.title || ""),
            city_id: String(t.city_id || ""),
            category: String(t.category || "tour"),
            duration_hours:
              t.duration_hours != null ? Number(t.duration_hours) : undefined,
            family_id: String(t.family_id || ""),
            is_family_master: Boolean(t.is_family_master),
          }))
        );
        // One family (master product) per city+title-without-hours;
        // durations are variant rows under it — list them grouped.
        const families = groupToursByFamily(
          tourList as unknown as TourFamilyMember[]
        );
        const familyByTourId = new Map<
          string,
          { masterId: string; title: string; count: number; isMaster: boolean }
        >();
        for (const fam of families) {
          for (const v of fam.variants) {
            familyByTourId.set(v.id, {
              masterId: fam.master.id,
              title: fam.title,
              count: fam.variants.length,
              isMaster: v.id === fam.master.id,
            });
          }
        }
        const orderedTours = [...tours].sort((a, b) => {
          const fa = familyByTourId.get(a.id);
          const fb = familyByTourId.get(b.id);
          const ta = fa?.title || String(a.title || "");
          const tb = fb?.title || String(b.title || "");
          if (ta !== tb) return ta.localeCompare(tb);
          return (
            (Number(a.duration_hours) || 999) -
            (Number(b.duration_hours) || 999)
          );
        });
        for (const t of orderedTours) {
          const raw = String(t.category || "tour").toLowerCase();
          const cat: CatalogKind =
            raw === "activity"
              ? "activity"
              : raw === "cluster"
                ? "cluster"
                : "tour";
          const fam = familyByTourId.get(t.id);
          out.push({
            id: t.id,
            title: String(t.title || t.id),
            subtitle:
              cat === "activity"
                ? "Experience"
                : cat === "cluster"
                  ? "Cluster"
                  : "Tour",
            detail:
              t.duration_hours != null
                ? `${t.duration_hours}h`
                : cat === "cluster"
                  ? "2.5h"
                  : undefined,
            kind: cat,
            description: String(t.description || ""),
            coverUrl: t.cover_photo
              ? `${getPbBaseUrl()}/api/files/tours/${t.id}/${t.cover_photo}`
              : null,
            familyMasterId: fam?.masterId,
            familyTitle: fam?.title,
            isFamilyMaster: fam?.isMaster,
            familyVariantCount: fam?.count,
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
        vehicleList = vehicles as Record<string, unknown>[];
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
        transportList = transports as Record<string, unknown>[];
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
      setExportCache({
        cities: cityList as Record<string, unknown>[],
        tours: tourList,
        vehicles: vehicleList,
        transports: transportList,
      });
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

  const visible = useMemo(() => {
    const byTab =
      filter === "all" ? rows : rows.filter((r) => r.kind === filter);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.subtitle || "").toLowerCase().includes(q) ||
        (r.detail || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
    );
  }, [filter, rows, searchQuery]);

  // Accordion: tour families render as ONE master row; duration
  // variants live inside it, shown only when the master is expanded
  // (searching auto-expands so matches are never hidden).
  const displayRows = useMemo(() => {
    const groups = new Map<string, ListRow[]>();
    for (const r of visible) {
      if (r.familyMasterId && (r.familyVariantCount || 0) > 1) {
        const list = groups.get(r.familyMasterId) || [];
        list.push(r);
        groups.set(r.familyMasterId, list);
      }
    }
    const searching = searchQuery.trim() !== "";
    const out: ListRow[] = [];
    for (const r of visible) {
      const mid = r.familyMasterId;
      const group = mid ? groups.get(mid) : undefined;
      if (mid && group && (r.familyVariantCount || 0) > 1) {
        const hasMaster = group.some((v) => v.isFamilyMaster);
        if (!hasMaster) {
          out.push(r);
          continue;
        }
        if (r.isFamilyMaster) {
          out.push(r);
          if (searching || expandedFamilies.has(mid)) {
            out.push(...group.filter((v) => !v.isFamilyMaster));
          }
        }
        continue;
      }
      out.push(r);
    }
    return out;
  }, [visible, expandedFamilies, searchQuery]);

  const handleCsvFile = async (file: File | null) => {
    if (!file) return;
    if (filter === "all") {
      setError("Pick Cities, Tours, Experiences, Vehicles, or Transport before uploading.");
      return;
    }
    setUploading(true);
    setError(null);
    setMsg(null);
    try {
      const text = await file.text();
      const result = await importCatalogCsv(getClient(), filter, text);
      const parts = [
        result.created ? `${result.created} created` : null,
        result.updated ? `${result.updated} updated` : null,
        result.skipped ? `${result.skipped} skipped` : null,
      ].filter(Boolean);
      setMsg(
        parts.length
          ? `CSV import · ${catalogTabLabel(filter)} · ${parts.join(" · ")}`
          : `CSV import finished for ${catalogTabLabel(filter)}`
      );
      if (result.errors.length) {
        setError(result.errors.slice(0, 3).join(" · "));
      }
      await reload();
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0B0F14] text-white">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0B0F14]/95 px-4 py-4 backdrop-blur">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#075473]">
            Source of Truth
          </p>
          <h1 className="font-display text-2xl">Catalog wizard</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Tabs for Cities, Tours, Experiences, Vehicles & Transport — download
            a template, fill in Sheets, upload CSV.
          </p>
        </div>
        <Link
          href="/team-access"
          className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold"
        >
          ← Team Access
        </Link>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                "all",
                "city",
                "tour",
                "activity",
                "cluster",
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
                    ? "bg-[#075473] text-white shadow-lg shadow-[#075473]/25"
                    : "border border-white/15 text-zinc-400 hover:text-white"
                }`}
              >
                {catalogTabLabel(k)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={filter === "all"}
              title={
                filter === "all"
                  ? "Pick a category tab for a matching template"
                  : `Download ${catalogTabLabel(filter)} CSV template`
              }
              onClick={() => {
                const ok = downloadCatalogTemplate(filter);
                if (!ok) {
                  setError("Pick a category tab to download its CSV template.");
                } else {
                  setMsg(`Template downloaded · ${catalogTabLabel(filter)}`);
                  setError(null);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Download template
            </button>
            <button
              type="button"
              onClick={() => {
                downloadCatalogExport(filter, exportCache);
                setMsg(`Exported ${catalogTabLabel(filter)} master CSV`);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-600/30"
            >
              <Download className="h-3.5 w-3.5" />
              Export {catalogTabLabel(filter)} CSV
            </button>
            <label
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#F6A724] px-3 py-1.5 text-xs font-bold uppercase text-black transition hover:bg-[#e0961f] ${
                uploading || filter === "all" ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "Uploading…" : "Upload CSV"}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={uploading || filter === "all"}
                onChange={(e) => {
                  void handleCsvFile(e.target.files?.[0] ?? null);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setEditTarget(null);
                setWizardPreset(null);
                setWizardOpen(true);
              }}
              className="rounded-full bg-[#075473] px-4 py-2 text-sm font-semibold text-white"
            >
              + Add
            </button>
          </div>
        </div>

        <div
          className={`mb-4 flex flex-col gap-3 rounded-xl border border-dashed px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
            dragOver
              ? "border-[#F6A724] bg-[#F6A724]/10"
              : "border-white/20 bg-white/5"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleCsvFile(file);
          }}
        >
          <div className="text-xs text-zinc-400">
            <strong className="block text-white">
              Simple 1-click update for {catalogTabLabel(filter)}
            </strong>
            {filter === "all" ? (
              <span>
                Export everything here, or switch to a category tab to download
                a template and upload CSV updates.
              </span>
            ) : (
              <span>
                Download the pre-formatted template, fill rows in Excel / Google
                Sheets, then drop the file here or click{" "}
                <strong className="text-[#F6A724]">Upload CSV</strong>. Tours &
                Experiences both save into the tours collection (
                {filter === "activity" ? "category=activity" : filter === "tour" ? "category=tour" : "by tab"}
                ).
              </span>
            )}
          </div>
          <input
            type="text"
            placeholder="Filter by title or details…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs text-white outline-none focus:border-[#075473] sm:w-64"
          />
        </div>

        {msg ? <p className="mb-3 text-sm text-[#1BA58A]">{msg}</p> : null}
        {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-zinc-500">Loading catalog…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
            No records in {catalogTabLabel(filter)}. Download a template, upload
            CSV, or click + Add.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-white/10 bg-black/40 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Photo</th>
                  <th className="px-3 py-2">Record</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Details</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-b border-white/5">
                    <td className="px-3 py-2.5">
                      {row.familyMasterId && !row.isFamilyMaster ? (
                        <CatalogSlotCell
                          recordId={row.id}
                          inheritRecordId={row.familyMasterId}
                          inheritOnly
                        />
                      ) : (
                        <CatalogSlotCell
                          recordId={row.id}
                          fallbackSrc={row.coverUrl || ""}
                          getToken={() => getClient().authStore.token}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-white">
                      {row.familyMasterId && !row.isFamilyMaster ? (
                        <span className="pl-4 text-zinc-300">
                          ↳ {row.detail || row.title}
                          <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                            duration of {row.familyTitle}
                          </span>
                        </span>
                      ) : (
                        <>
                          {row.isFamilyMaster &&
                          (row.familyVariantCount || 0) > 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                toggleFamily(row.familyMasterId || row.id)
                              }
                              className="mr-1 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[10px] font-bold text-[#7ec8e3] align-middle"
                              aria-label={
                                expandedFamilies.has(
                                  row.familyMasterId || row.id
                                )
                                  ? "Hide durations"
                                  : "Show durations"
                              }
                            >
                              {expandedFamilies.has(
                                row.familyMasterId || row.id
                              ) ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                              {row.familyVariantCount} durations
                            </button>
                          ) : null}
                          {row.familyTitle &&
                          (row.familyVariantCount || 0) > 1
                            ? row.familyTitle
                            : row.title}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-400">
                      {row.subtitle}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">
                      {row.detail || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        {row.subtitle === "Inactive" ? "Inactive" : "Active"}
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
                          setWizardPreset(null);
                          setWizardOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      {row.isFamilyMaster &&
                      (row.kind === "tour" || row.kind === "activity") ? (
                        <button
                          type="button"
                          className="ml-2 inline-flex items-center gap-1 text-[#1BA58A]"
                          onClick={() => {
                            setEditTarget(null);
                            setWizardPreset({
                              kind: row.kind as CatalogKind,
                              familyMasterId: row.id,
                            });
                            setWizardOpen(true);
                          }}
                        >
                          + Duration
                        </button>
                      ) : null}
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
        allTours={tourRecords}
        preset={wizardPreset}
        editTarget={editTarget}
        onClose={() => {
          setWizardOpen(false);
          setEditTarget(null);
          setWizardPreset(null);
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
  allTours,
  preset,
  editTarget,
  onClose,
  onSaved,
  getClient,
}: {
  open: boolean;
  cities: { id: string; name: string }[];
  allTours: TourFamilyMember[];
  preset: { kind: CatalogKind; familyMasterId: string } | null;
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
        setEditId(null);
        if (preset) {
          // "+ Duration" on a family master → new slim variant row,
          // story/route/vibes prefilled from the master.
          setKind(preset.kind);
          setStep(0);
          const next = emptyForm();
          next.family_mode = "variant";
          next.family_id = preset.familyMasterId;
          try {
            const pb = getClient();
            const m = await pb.collection("tours").getOne(preset.familyMasterId);
            next.city_id = String(m.city_id || "");
            next.audience = String(m.audience || "both");
            next.vibe_tags = Array.isArray(m.vibe_tags)
              ? m.vibe_tags.map(String)
              : [];
            next.crowd_tag = String(m.crowd_tag || "");
            next.pace_tag = String(m.pace_tag || "");
            next.title = stripDurationFromTitle(String(m.title || ""));
            next.description = String(m.description || "");
            next.route = String(m.route || "");
            next.languages = Array.isArray(m.languages)
              ? m.languages.map(String)
              : [];
          } catch (e) {
            if (!cancelled) setErr(formatPbError(e));
          }
          if (!cancelled) setForm(next);
          return;
        }
        setKind(null);
        setStep(0);
        setForm(emptyForm());
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
        } else if (
          editTarget.kind === "tour" ||
          editTarget.kind === "activity" ||
          editTarget.kind === "cluster"
        ) {
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
            r.duration_hours != null
              ? String(r.duration_hours)
              : editTarget.kind === "cluster"
                ? "2.5"
                : "";
          next.languages = Array.isArray(r.languages)
            ? r.languages.map(String)
            : [];
          next.cover_url = String(r.cover_url || "");
          next.media_url = String(r.media_url || "");
          next.family_id = String(r.family_id || "");
          next.family_mode =
            r.is_family_master || (r.family_id && r.family_id === r.id)
              ? "master"
              : r.family_id
                ? "variant"
                : "master";
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
  }, [open, editTarget, getClient, preset]);

  const steps = useMemo(() => {
    if (!kind) return ["What is it?"];
    if (kind === "city") {
      return ["Basics", "Photo", "Price & languages", "Preview"];
    }
    if (kind === "cluster") {
      return [
        "City & name",
        "Highlights",
        "Time budget",
        "Media",
        "Preview",
      ];
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

  /** Existing family masters in the chosen city + category. */
  const familyMasters = useMemo(() => {
    if (kind !== "tour" && kind !== "activity") return [];
    const wantCat = kind === "activity" ? "activity" : "tour";
    return groupToursByFamily(allTours)
      .filter(
        (f) =>
          String(f.master.city_id || "") === String(form.city_id || "") &&
          String(f.master.category || "tour").toLowerCase() === wantCat
      )
      .map((f) => f.master);
  }, [allTours, kind, form.city_id]);

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
    if (kind === "cluster") {
      if (step === 0)
        return Boolean(form.city_id && String(form.title || "").trim());
      return true;
    }
    if (kind === "tour" || kind === "activity") {
      if (step === 0)
        return (
          Boolean(form.city_id) &&
          (String(form.family_mode || "master") !== "variant" ||
            Boolean(String(form.family_id || "").trim()))
        );
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
      // CREATE-only auto-placeholder: filled in by the branch that
      // creates the record when no image was supplied. Never on update.
      let createdPlaceholder: { id: string; title: string } | null = null;
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
        if (!editId && !(form.cover_file instanceof File)) {
          createdPlaceholder = { id: String(row.id), title: label };
        }
      } else if (
        kind === "tour" ||
        kind === "activity" ||
        kind === "cluster"
      ) {
        const fd = new FormData();
        fd.append("city_id", String(form.city_id));
        fd.append(
          "category",
          kind === "activity"
            ? "activity"
            : kind === "cluster"
              ? "cluster"
              : "tour"
        );
        fd.append("audience", String(form.audience || "both"));
        fd.append("vibe_tags", JSON.stringify(form.vibe_tags || []));
        if (form.crowd_tag) fd.append("crowd_tag", String(form.crowd_tag));
        if (form.pace_tag) fd.append("pace_tag", String(form.pace_tag));
        // Tour family: master owns the product; a variant is a slim
        // duration row linked by family_id and titled "Product, Nh".
        const variantMasterId =
          String(form.family_mode || "master") === "variant"
            ? String(form.family_id || "").trim()
            : "";
        const rawTitle = String(form.title || "").trim();
        fd.append(
          "title",
          variantMasterId && form.duration_hours
            ? `${stripDurationFromTitle(rawTitle)}, ${form.duration_hours}h`
            : rawTitle
        );
        if (variantMasterId) {
          fd.append("family_id", variantMasterId);
          fd.append("is_family_master", "false");
        } else {
          fd.append("is_family_master", "true");
          if (editId) fd.append("family_id", String(form.family_id || editId));
        }
        fd.append("description", String(form.description || ""));
        fd.append("route", String(form.route || ""));
        fd.append("media_type", String(form.media_type || "Image"));
        // Clusters are free individually — guide is optional per day, not per place.
        const zeroPrice = kind === "cluster";
        const n = (v: unknown, fallback = 0) => {
          // Blank field → fallback. (Number("") is 0, so empty must be
          // checked first or blank tiers would silently store €0.)
          if (String(v ?? "").trim() === "") return fallback;
          const x = Number(String(v).replace(/[€,\s]/g, ""));
          return Number.isFinite(x) ? x : fallback;
        };
        // Only price_1_pax is required — it's the SELL price offered to
        // the customer. Blank 2/3/4/extra tiers auto-fill with it (extra
        // pax = same as 1 pax). base_price_eur is OUR COST: independent,
        // blank = 0, never copied from the sell price.
        const p1 = zeroPrice ? 0 : n(form.price_1_pax, 0);
        const p2 = zeroPrice ? 0 : n(form.price_2_pax, p1);
        const p3 = zeroPrice ? 0 : n(form.price_3_pax, p1);
        const p4 = zeroPrice ? 0 : n(form.price_4_pax, p1);
        const pExtra = zeroPrice ? 0 : n(form.price_extra_pax, p1);
        const baseEur = zeroPrice ? 0 : n(form.base_price_eur, 0);
        // Legacy required PB field `price` — must be set or create fails with
        // "price: Cannot be blank" even when tiered pax fields are filled.
        fd.append("price", String(p1));
        fd.append("price_per_person", String(p1));
        fd.append("price_1_pax", String(p1));
        fd.append("price_2_pax", String(p2));
        fd.append("price_3_pax", String(p3));
        fd.append("price_4_pax", String(p4));
        fd.append("price_extra_pax", String(pExtra));
        fd.append("base_price_eur", String(baseEur));
        if (zeroPrice) {
          fd.append("is_self_guided", "true");
          fd.append(
            "duration_hours",
            String(form.duration_hours || "2.5")
          );
        } else if (form.duration_hours) {
          fd.append("duration_hours", String(form.duration_hours));
        }
        fd.append("languages", JSON.stringify(form.languages || []));
        fd.append("is_active", "true");
        if (form.cover_url) fd.append("cover_url", String(form.cover_url));
        if (form.media_url) fd.append("media_url", String(form.media_url));
        // Cover photo goes to the catalog slot {recordId}_1 (outside
        // PocketBase) after save — never as a PB binary. Media file
        // (video/gallery) keeps the legacy pointer fields.
        if (!form.media_url && form.media_file instanceof File)
          fd.append("media_file", form.media_file);
        const row = editId
          ? await pb.collection("tours").update(editId, fd)
          : await pb.collection("tours").create(fd);
        if (!editId && !variantMasterId) {
          // New master points to itself so the family link is explicit.
          await pb
            .collection("tours")
            .update(row.id, { family_id: row.id, is_family_master: true })
            .catch(() => undefined);
        }
        if (form.cover_file instanceof File) {
          await uploadToVps(form.cover_file, "catalog", pb.authStore.token, {
            stableKey: catalogMediaSlot(String(row.id), 1),
          }).catch(() => undefined);
        }
        label = String(
          row.title ||
            (kind === "cluster"
              ? "Cluster"
              : kind === "activity"
                ? "Experience"
                : "Tour")
        );
        if (
          !editId &&
          // Variants never get their own placeholder slot — the family
          // master owns the one `{masterId}_1` photo for the whole family.
          !variantMasterId &&
          !(form.cover_file instanceof File) &&
          !(form.media_file instanceof File) &&
          !String(form.cover_url || "").trim() &&
          !String(form.media_url || "").trim()
        ) {
          createdPlaceholder = { id: String(row.id), title: label };
        }
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
        if (!editId && !(form.cover_file instanceof File)) {
          createdPlaceholder = { id: String(row.id), title: label };
        }
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
        if (!editId && !(form.cover_file instanceof File)) {
          createdPlaceholder = { id: String(row.id), title: label };
        }
      }
      // Born with a photo slot: create the auto-placeholder for a new
      // record that supplied no image. Best-effort — the record already
      // saved, so a failure here must never fail the save.
      if (createdPlaceholder) {
        await ensureCatalogPlaceholder(
          createdPlaceholder.id,
          createdPlaceholder.title,
          pb.authStore.token
        ).catch(() => false);
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
          : kind === "cluster"
            ? String(form.title || "New cluster")
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

                {kind === "cluster" && step === 0 ? (
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
                    <Field label="Cluster title *">
                      <input
                        className={INP}
                        placeholder="e.g. Asakusa Historical Sector"
                        value={String(form.title || "")}
                        onChange={(e) => set("title", e.target.value)}
                      />
                    </Field>
                    <p className="text-xs text-zinc-500">
                      Regional cluster · €0 item price · spends the 8h day
                      budget. Places inside stay free; guide is optional per
                      day.
                    </p>
                  </>
                ) : null}
                {kind === "cluster" && step === 1 ? (
                  <>
                    <Field label="Key highlights / description">
                      <textarea
                        className={INP}
                        rows={4}
                        placeholder="Neighborhood sights guests can pick inside this cluster…"
                        value={String(form.description || "")}
                        onChange={(e) => set("description", e.target.value)}
                      />
                    </Field>
                    <Field label="Suggested route (optional)">
                      <textarea
                        className={INP}
                        rows={3}
                        value={String(form.route || "")}
                        onChange={(e) => set("route", e.target.value)}
                      />
                    </Field>
                  </>
                ) : null}
                {kind === "cluster" && step === 2 ? (
                  <Field label="Time budget (hours)">
                    <input
                      className={INP}
                      type="number"
                      step="0.5"
                      min="0.5"
                      placeholder="2.5"
                      value={String(form.duration_hours || "2.5")}
                      onChange={(e) => set("duration_hours", e.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Typical cluster is 2–2.5h. Guests pick ~3 clusters for a
                      6–8h day.
                    </p>
                  </Field>
                ) : null}
                {kind === "cluster" && step === 3 ? (
                  <MediaPicker
                    label="Cover photo (VPS)"
                    accept="image/*"
                    file={form.cover_file instanceof File ? form.cover_file : null}
                    existingUrl={String(form.cover_url || "")}
                    folder="catalog"
                    getToken={() => getClient().authStore.token}
                    onChange={(f) => set("cover_file", f)}
                    onUrl={(url) => set("cover_url", url)}
                    recommend="Uploads to /uploads/catalog · ~1200×800 · under 180KB"
                  />
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
                      {kind === "activity"
                        ? "Experience / Ticket"
                        : "Full Tour (guide included)"}
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
                    <Field label="Product family — master = product, durations = variants">
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ["master", "New product (master)"],
                            ["variant", "New duration of existing"],
                          ] as const
                        ).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => set("family_mode", mode)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                              String(form.family_mode || "master") === mode
                                ? "border-[#075473] bg-[#075473]/25 text-[#7ec8e3]"
                                : "border-white/15 bg-black/40 text-zinc-400"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {String(form.family_mode || "master") === "variant" ? (
                        <select
                          className={`${INP} mt-2`}
                          value={String(form.family_id || "")}
                          onChange={(e) => {
                            const id = e.target.value;
                            set("family_id", id);
                            if (id && !editId) {
                              void (async () => {
                                try {
                                  const m = await getClient()
                                    .collection("tours")
                                    .getOne(id);
                                  setForm((f) => ({
                                    ...f,
                                    family_id: id,
                                    title:
                                      String(f.title || "").trim() ||
                                      stripDurationFromTitle(
                                        String(m.title || "")
                                      ),
                                    description:
                                      String(f.description || "") ||
                                      String(m.description || ""),
                                    route:
                                      String(f.route || "") ||
                                      String(m.route || ""),
                                  }));
                                } catch {
                                  /* master prefill is best-effort */
                                }
                              })();
                            }
                          }}
                        >
                          <option value="">Select the master product…</option>
                          {familyMasters.map((m) => (
                            <option key={m.id} value={m.id}>
                              {stripDurationFromTitle(String(m.title || m.id))}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="mt-1 text-[11px] text-zinc-500">
                          This record owns the title, story and photo
                          ({`{masterId}_1`}). Add durations later with
                          “+ Duration” on its list row.
                        </p>
                      )}
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
                      label="Cover photo (VPS)"
                      accept="image/*"
                      file={form.cover_file instanceof File ? form.cover_file : null}
                      existingUrl={String(form.cover_url || "")}
                      folder="catalog"
                      getToken={() => getClient().authStore.token}
                      onChange={(f) => set("cover_file", f)}
                      onUrl={(url) => set("cover_url", url)}
                      recommend="Uploads to /uploads/catalog · ~1200×800 · under 180KB"
                    />
                    <MediaPicker
                      label="Media file (VPS image / video)"
                      accept="image/*,video/*"
                      file={form.media_file instanceof File ? form.media_file : null}
                      existingUrl={String(form.media_url || "")}
                      folder="catalog"
                      getToken={() => getClient().authStore.token}
                      onChange={(f) => set("media_file", f)}
                      onUrl={(url) => set("media_url", url)}
                      recommend="Uploads to /uploads/catalog · under 40MB"
                    />
                    {!editId ? (
                      <p className="text-[11px] text-zinc-500">
                        No photo? A placeholder named {"{recordId}_1"} will
                        be created automatically when you save.
                      </p>
                    ) : null}
                  </>
                ) : null}
                {(kind === "tour" || kind === "activity") && step === 4 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ["price_1_pax", "Price 1 pax (€) — sell price *"],
                        ["price_2_pax", "Price 2 pax (€)"],
                        ["price_3_pax", "Price 3 pax (€)"],
                        ["price_4_pax", "Price 4 pax (€)"],
                        ["price_extra_pax", "Price extra pax (€)"],
                        ["base_price_eur", "Base (€) — our cost"],
                      ] as const
                    ).map(([k, label]) => (
                      <Field key={k} label={label}>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          className={INP}
                          value={String(form[k] || "")}
                          onChange={(e) => {
                            setErr(null);
                            set(k, e.target.value);
                          }}
                        />
                      </Field>
                    ))}
                    <p className="col-span-2 text-[11px] text-zinc-500">
                      Only <strong className="text-zinc-300">Price 1 pax</strong>{" "}
                      (what we offer the customer) is needed. Leave 2 / 3 / 4 /
                      extra empty and they auto-save as the 1-pax price.{" "}
                      <strong className="text-zinc-300">Base (€)</strong> is how
                      much it costs us — separate, optional. Saved also as
                      legacy <code className="text-zinc-400">price</code>{" "}
                      (required by PocketBase).
                    </p>
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
                  (kind === "cluster" && step === 4) ||
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
                              : kind === "cluster"
                                ? `${form.duration_hours || "2.5"}h cluster · €0 · day time budget`
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
  folder,
  getToken,
  onUrl,
  existingUrl,
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (f: File | null) => void;
  recommend: string;
  folder?: "catalog" | "comms" | "profiles" | "general";
  getToken?: () => string;
  onUrl?: (url: string) => void;
  existingUrl?: string;
}) {
  const [dims, setDims] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [storedUrl, setStoredUrl] = useState(existingUrl || "");

  useEffect(() => {
    setStoredUrl(existingUrl || "");
  }, [existingUrl]);

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

  const handlePick = async (f: File | null) => {
    onChange(f);
    setUploadErr(null);
    if (!f || !folder || !getToken || !onUrl) return;
    setUploading(true);
    try {
      const token = getToken();
      const saved = await uploadToVps(f, folder, token);
      setStoredUrl(saved.url);
      onUrl(saved.url);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "VPS upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Field label={label}>
      <input
        type="file"
        accept={accept}
        disabled={uploading}
        onChange={(e) => {
          void handlePick(e.target.files?.[0] || null);
        }}
      />
      {uploading ? (
        <p className="mt-1 text-[11px] text-[#F6A724]">Uploading to VPS…</p>
      ) : null}
      {uploadErr ? (
        <p className="mt-1 text-[11px] text-red-400">{uploadErr}</p>
      ) : null}
      {storedUrl ? (
        <p className="mt-1 break-all font-mono text-[10px] text-emerald-400">
          VPS: {storedUrl}
        </p>
      ) : null}
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
      ) : storedUrl && /\.(jpe?g|png|webp|gif)$/i.test(storedUrl) ? (
        <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={storedUrl}
            alt=""
            className="max-h-40 w-full rounded-lg object-cover"
          />
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
          <CatalogSlotImg
            recordId={row.id}
            fallbackSrc={row.coverUrl || ""}
            className="absolute inset-0 h-full w-full object-cover"
            emptyClassName="absolute inset-0 h-full w-full bg-gradient-to-br from-[#1a2840] to-[#0A1017]"
          />
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

