"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Car,
  Check,
  ExternalLink,
  Monitor,
  RefreshCw,
  Smartphone,
  UserCircle,
  UserRoundSearch,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { BoxGradingGlow } from "@/components/branding/BoxGradingGlow";
import { AliasDisguiseBanner } from "@/components/ops/AliasDisguiseBanner";
import {
  loadStaffByRole,
  type StaffOption,
} from "@/components/staff/opsHubClient";
import {
  buildPreviewHref,
  clearAliasSession,
  readAliasSession,
  writeAliasSession,
  type AliasRoleType,
  type AliasSession,
} from "@/lib/aliasMode";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import { canAccessOpsBoard } from "@/lib/staffRoles";
import { useTeamAuth } from "@/store/useTeamAuth";

type ViewportMode = "desktop" | "mobile";

type RolePreview = {
  id: string;
  title: string;
  badge: string;
  description: string;
  href: string;
  permissions: string[];
  icon: LucideIcon;
  accent: string;
  authNote: string;
  /** When set, show user picker for this alias role type. */
  aliasRole?: AliasRoleType;
};

type AgencyOption = {
  id: string;
  name: string;
  code?: string;
  contact_email?: string;
};

const ROLE_PREVIEWS: RolePreview[] = [
  {
    id: "guide",
    title: "Tour Guide Portal",
    badge: "Guide",
    description:
      "Contractor guide jobs, open board, payouts, and rate cards — ContractorPortalShell chrome (no Super User bar).",
    href: "/guide/portal",
    permissions: [
      "View assigned guide jobs",
      "Claim / accept open board tours",
      "Submit completion reports",
      "Edit guide rate card",
      "View own payouts",
    ],
    icon: UserCircle,
    accent: "text-emerald-400",
    authNote:
      "Owner/Ops sessions share same-origin auth, so the iframe usually loads the guide UI. Pure guide accounts see login at /guide/login when unauthenticated.",
    aliasRole: "guide",
  },
  {
    id: "driver",
    title: "Driver / Chauffeur Portal",
    badge: "Driver",
    description:
      "Assigned pickups and chauffeur dispatch — ContractorPortalShell, separate from Ops Driver Coordinator master desk.",
    href: "/driver/portal",
    permissions: [
      "View assigned driver jobs",
      "Claim open dispatch rows",
      "Edit driver rate sheet",
      "View own payouts",
    ],
    icon: Car,
    accent: "text-sky-400",
    authNote:
      "Same-origin Owner/Ops auth can open the portal in-frame. Unauthenticated visitors land on the driver login gate.",
    aliasRole: "driver",
  },
  {
    id: "accounting",
    title: "Accountant Desk",
    badge: "Accounting",
    description:
      "Financial settlements desk for accountants (and Owner oversight). Path matches homePathForRole(accounting).",
    href: "/accounting/dashboard",
    permissions: [
      "Settlements & money surfaces",
      "Owner oversight of accounting",
      "Not the full Ops Super User suite",
    ],
    icon: Wallet,
    accent: "text-[#F6A724]",
    authNote:
      "Gated to Owner / Accounting. Ops-only sessions may see an access redirect or login. Page may still be landing from parallel work — preview URL is wired either way.",
  },
  {
    id: "agency",
    title: "B2B Travel Agency Portal",
    badge: "Agency",
    description:
      "Partner inquire & orders flow at /agency (not the Ops Agency Intelligence desk at /ops/agencies).",
    href: "/agency",
    permissions: [
      "Submit agency inquire / orders",
      "View own agency order history",
      "Map + profile shortcuts",
      "Owner/Ops can inspect for QA",
    ],
    icon: Building2,
    accent: "text-violet-300",
    authNote:
      "Owner/Ops pass canAccessAgency and typically see the portal UI in-frame. Agency-role users need their own credentials.",
    aliasRole: "agency",
  },
];

function staffLabel(s: StaffOption): string {
  const name = String(s.name || "").trim();
  const email = String(s.email || "").trim();
  if (name && email) return `${name} · ${email}`;
  return name || email || s.id;
}

function agencyLabel(a: AgencyOption): string {
  const name = String(a.name || "").trim() || "Agency";
  const code = String(a.code || "").trim();
  const email = String(a.contact_email || "").trim();
  if (code && email) return `${name} (${code}) · ${email}`;
  if (code) return `${name} (${code})`;
  if (email) return `${name} · ${email}`;
  return name;
}

export function RolePreviewSandbox() {
  const getClient = useTeamAuth((s) => s.getClient);
  const role = useTeamAuth((s) => s.role);
  const isAuthenticated = useTeamAuth((s) => s.isAuthenticated);

  const [selectedId, setSelectedId] = useState(ROLE_PREVIEWS[0].id);
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [frameKey, setFrameKey] = useState(0);
  const [alias, setAlias] = useState<AliasSession | null>(null);
  const [guides, setGuides] = useState<StaffOption[]>([]);
  const [drivers, setDrivers] = useState<StaffOption[]>([]);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);

  const canAlias = isAuthenticated && canAccessOpsBoard(role);

  const selected = useMemo(
    () => ROLE_PREVIEWS.find((r) => r.id === selectedId) ?? ROLE_PREVIEWS[0],
    [selectedId]
  );

  const previewHref = useMemo(() => {
    const matching =
      alias && selected.aliasRole && alias.roleType === selected.aliasRole
        ? alias
        : null;
    return buildPreviewHref(selected.href, matching);
  }, [alias, selected]);

  useEffect(() => {
    setAlias(readAliasSession());
  }, []);

  const loadPickers = useCallback(async () => {
    if (!canAlias) {
      setGuides([]);
      setDrivers([]);
      setAgencies([]);
      return;
    }
    setPickerLoading(true);
    setPickerError(null);
    try {
      const pb = getClient();
      const [g, d, a] = await Promise.all([
        loadStaffByRole(pb, "guide"),
        loadStaffByRole(pb, "driver"),
        pb
          .collection("agencies")
          .getFullList<AgencyOption>({
            sort: "name",
            requestKey: null,
          })
          .catch(() => [] as AgencyOption[]),
      ]);
      setGuides(g);
      setDrivers(d);
      setAgencies(a);
    } catch (e) {
      setPickerError(formatPbError(e));
    } finally {
      setPickerLoading(false);
    }
  }, [canAlias, getClient]);

  useEffect(() => {
    void loadPickers();
  }, [loadPickers]);

  const applyAlias = (next: AliasSession | null) => {
    if (!next) {
      clearAliasSession();
      setAlias(null);
    } else {
      writeAliasSession(next);
      setAlias(next);
    }
    setFrameKey((k) => k + 1);
  };

  const onPickUser = (roleType: AliasRoleType, id: string) => {
    if (!id) {
      if (alias?.roleType === roleType) applyAlias(null);
      return;
    }
    if (roleType === "agency") {
      const a = agencies.find((x) => x.id === id);
      if (!a) return;
      applyAlias({
        userId: a.id,
        userEmail: String(a.contact_email || "").trim(),
        roleType: "agency",
        displayName: String(a.name || "").trim() || undefined,
      });
      return;
    }
    const list = roleType === "guide" ? guides : drivers;
    const s = list.find((x) => x.id === id);
    if (!s) return;
    applyAlias({
      userId: s.id,
      userEmail: String(s.email || "").trim(),
      roleType,
      displayName: String(s.name || "").trim() || undefined,
    });
  };

  const pickerValue =
    alias && selected.aliasRole && alias.roleType === selected.aliasRole
      ? alias.userId
      : "";

  const frameWidthClass =
    viewport === "mobile" ? "w-[390px] max-w-full" : "w-full";

  return (
    <div className="space-y-6 p-4 text-white sm:p-6">
      {alias ? (
        <AliasDisguiseBanner
          alias={alias}
          onExit={() => applyAlias(null)}
        />
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#075473]">
            Super User
          </p>
          <h1 className="font-mono text-lg font-bold">
            Role portal preview &amp; UI sandbox
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-zinc-400">
            Inspect live role portals in a same-origin iframe. Alias / Disguise
            mode filters portal data to a picked guide, driver, or agency —
            auth stays yours (Owner/Ops preview only).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in full tab
          </a>
          <button
            type="button"
            onClick={() => setFrameKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload iframe
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLE_PREVIEWS.map((roleCard) => {
          const Icon = roleCard.icon;
          const active = roleCard.id === selected.id;
          return (
            <button
              key={roleCard.id}
              type="button"
              onClick={() => {
                setSelectedId(roleCard.id);
                setFrameKey((k) => k + 1);
              }}
              className={[
                "relative overflow-hidden rounded-xl border p-4 text-left transition",
                active
                  ? "border-[#075473]/60 bg-[#0A1017] ring-1 ring-[#075473]/40"
                  : "border-white/10 bg-[#0D1117]/70 hover:border-white/20",
              ].join(" ")}
            >
              <BoxGradingGlow />
              <div className="relative z-10 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Icon className={`h-5 w-5 ${roleCard.accent}`} strokeWidth={2} />
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                    {roleCard.badge}
                  </span>
                </div>
                <div>
                  <h2 className="font-mono text-sm font-bold text-white">
                    {roleCard.title}
                  </h2>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                    {roleCard.description}
                  </p>
                </div>
                <ul className="space-y-1 border-t border-white/10 pt-2">
                  {roleCard.permissions.map((perm) => (
                    <li
                      key={perm}
                      className="flex items-start gap-1.5 text-[10px] text-zinc-400"
                    >
                      <Check
                        className="mt-0.5 h-3 w-3 shrink-0 text-[#075473]"
                        strokeWidth={2.5}
                      />
                      <span>{perm}</span>
                    </li>
                  ))}
                </ul>
                <p className="font-mono text-[10px] text-zinc-500">
                  {roleCard.href}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {canAlias && selected.aliasRole ? (
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0D1117]/70 p-4">
          <BoxGradingGlow />
          <div className="relative z-10 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <UserRoundSearch className="h-4 w-4 text-[#F6A724]" />
              <p className="font-mono text-xs font-bold text-white">
                Alias / Disguise —{" "}
                {selected.aliasRole === "guide"
                  ? "Guide"
                  : selected.aliasRole === "driver"
                    ? "Driver"
                    : "Agency"}
              </p>
              {pickerLoading ? (
                <span className="text-[10px] text-zinc-500">Loading roster…</span>
              ) : null}
            </div>
            <p className="text-[11px] text-zinc-400">
              Pick a live user to preview their assigned jobs / orders. Stored in
              sessionStorage and passed into the iframe URL. Does not change your
              login.
            </p>
            {pickerError ? (
              <p className="text-xs text-red-400">{pickerError}</p>
            ) : null}
            <label className="block max-w-xl text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {selected.aliasRole === "agency"
                ? "Agency"
                : selected.aliasRole === "guide"
                  ? "Guide (staff · role=guide)"
                  : "Driver (staff · role=driver)"}
              <select
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#0A1017] px-3 py-2 text-sm font-normal normal-case tracking-normal text-white"
                value={pickerValue}
                onChange={(e) =>
                  onPickUser(selected.aliasRole!, e.target.value)
                }
              >
                <option value="">— no disguise (Owner/Ops overview) —</option>
                {selected.aliasRole === "guide"
                  ? guides.map((g) => (
                      <option key={g.id} value={g.id}>
                        {staffLabel(g)}
                      </option>
                    ))
                  : null}
                {selected.aliasRole === "driver"
                  ? drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {staffLabel(d)}
                      </option>
                    ))
                  : null}
                {selected.aliasRole === "agency"
                  ? agencies.map((a) => (
                      <option key={a.id} value={a.id}>
                        {agencyLabel(a)}
                      </option>
                    ))
                  : null}
              </select>
            </label>
            {selected.aliasRole === "guide" && !pickerLoading && guides.length === 0 ? (
              <p className="text-[11px] text-zinc-500">
                No active guides in staff (role=guide).
              </p>
            ) : null}
            {selected.aliasRole === "driver" &&
            !pickerLoading &&
            drivers.length === 0 ? (
              <p className="text-[11px] text-zinc-500">
                No active drivers in staff (role=driver).
              </p>
            ) : null}
            {selected.aliasRole === "agency" &&
            !pickerLoading &&
            agencies.length === 0 ? (
              <p className="text-[11px] text-zinc-500">
                No rows in agencies collection.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs font-bold text-white">
            Live preview · {selected.title}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">{selected.authNote}</p>
        </div>
        <div className="inline-flex rounded-lg border border-white/10 bg-[#0A1017] p-0.5">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition",
              viewport === "desktop"
                ? "bg-[#075473] text-white"
                : "text-zinc-400 hover:text-white",
            ].join(" ")}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setViewport("mobile")}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition",
              viewport === "mobile"
                ? "bg-[#075473] text-white"
                : "text-zinc-400 hover:text-white",
            ].join(" ")}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </button>
        </div>
      </div>

      <div
        className={[
          "mx-auto overflow-hidden rounded-xl border border-white/10 bg-black/40",
          frameWidthClass,
          viewport === "mobile" ? "shadow-[0_0_0_8px_rgba(24,24,27,0.8)]" : "",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#0A1017] px-3 py-2">
          <span className="truncate font-mono text-[10px] text-zinc-500">
            {previewHref}
          </span>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
            {viewport === "mobile" ? "390×844" : "Fluid desktop"}
          </span>
        </div>
        <iframe
          key={`${selected.id}-${viewport}-${frameKey}-${previewHref}`}
          title={`${selected.title} preview`}
          src={previewHref}
          className={[
            "w-full border-0 bg-[#0B0F14]",
            viewport === "mobile" ? "h-[844px]" : "h-[min(78vh,900px)]",
          ].join(" ")}
          // Same-origin live UI: scripts + forms needed for portal shells.
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
        />
      </div>
    </div>
  );
}
