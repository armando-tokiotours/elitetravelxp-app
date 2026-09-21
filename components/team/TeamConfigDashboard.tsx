"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Mail,
  PlugZap,
  Save,
  Settings2,
} from "lucide-react";
import {
  EMAIL_CONFIG_DEFAULTS,
  previewProposalHtml,
  type StoredEmailConfig,
} from "@/config/emailDefaults";

type TabId = "smtp" | "routing" | "template";

const TABS: { id: TabId; label: string }[] = [
  { id: "smtp", label: "Hostinger SMTP" },
  { id: "routing", label: "Team Routing" },
  { id: "template", label: "Email Template" },
];

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#D9BB96]/80">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">{hint}</p> : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-[#2C2C2E] bg-[#121212] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#B85304]";

/**
 * Visual Team Email Configuration panel — SMTP, BCC routing, live HTML template.
 */
export function TeamConfigDashboard({
  compact = false,
  onSaved,
}: {
  compact?: boolean;
  onSaved?: () => void;
}) {
  const [tab, setTab] = useState<TabId>("smtp");
  const [config, setConfig] = useState<StoredEmailConfig>(
    structuredClone(EMAIL_CONFIG_DEFAULTS)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/save-config");
        const data = await res.json();
        if (!cancelled && data?.config) {
          setConfig(data.config as StoredEmailConfig);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load saved settings — showing defaults.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const previewHtml = useMemo(
    () => previewProposalHtml(config.template),
    [config.template]
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Save failed");
      }
      if (data.config) setConfig(data.config as StoredEmailConfig);
      setToast("✓ Team email settings updated successfully!");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtp: config.smtp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "SMTP test failed");
      }
      setToast(data.message || "✓ SMTP connection verified");
    } catch (err) {
      setError(err instanceof Error ? err.message : "SMTP test failed");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin text-[#B85304]" />
        Loading team email settings…
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#B85304]">
            <Settings2 className="h-3.5 w-3.5" />
            Team Email Settings
          </p>
          <h2 className="mt-1 font-display text-2xl text-white sm:text-3xl">
            Visual configuration
          </h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Edit Hostinger SMTP, team BCC alerts, and proposal email copy. Saves
            to <code className="text-[#D9BB96]">config/emailConfig.json</code>{" "}
            and feeds <code className="text-[#D9BB96]">/api/send-itinerary</code>.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="inline-flex items-center gap-2 rounded-full bg-[#B85304] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#a04903] disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save settings
        </button>
      </div>

      {toast ? (
        <p className="inline-flex w-full items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {toast}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-[#2C2C2E] pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              tab === t.id
                ? "bg-[#D9BB96] text-[#121212]"
                : "bg-[#1C1C1E] text-zinc-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "smtp" ? (
        <div className="rounded-2xl border border-[#2C2C2E] bg-[#1C1C1E] p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SMTP Host">
              <input
                className={inputClass}
                value={config.smtp.host}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    smtp: { ...c.smtp, host: e.target.value },
                  }))
                }
                placeholder="smtp.hostinger.com"
              />
            </Field>
            <Field label="SMTP Port">
              <input
                type="number"
                className={inputClass}
                value={config.smtp.port}
                onChange={(e) => {
                  const port = Number(e.target.value) || 465;
                  setConfig((c) => ({
                    ...c,
                    smtp: {
                      ...c.smtp,
                      port,
                      secure: port === 465,
                    },
                  }));
                }}
              />
            </Field>
            <Field label="SMTP User">
              <input
                className={inputClass}
                value={config.smtp.user}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    smtp: { ...c.smtp, user: e.target.value },
                  }))
                }
                autoComplete="off"
              />
            </Field>
            <Field label="SMTP Password">
              <div className="flex gap-2">
                <input
                  type={showPass ? "text" : "password"}
                  className={inputClass}
                  value={config.smtp.pass}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      smtp: { ...c.smtp, pass: e.target.value },
                    }))
                  }
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="shrink-0 rounded-xl border border-[#2C2C2E] px-3 text-xs text-zinc-400 hover:text-white"
                >
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
            </Field>
          </div>
          <button
            type="button"
            disabled={testing}
            onClick={() => void handleTestSmtp()}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#D9BB96]/40 bg-[#121212] px-4 py-2.5 text-sm font-semibold text-[#D9BB96] transition hover:border-[#D9BB96] disabled:opacity-60"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlugZap className="h-4 w-4" />
            )}
            Test Connection
          </button>
        </div>
      ) : null}

      {tab === "routing" ? (
        <div className="rounded-2xl border border-[#2C2C2E] bg-[#1C1C1E] p-5 sm:p-6">
          <div className="grid gap-4">
            <Field label="Sender Display Name">
              <input
                className={inputClass}
                value={config.routing.fromName}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    routing: { ...c.routing, fromName: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="From Address">
              <input
                type="email"
                className={inputClass}
                value={config.routing.fromAddress}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    routing: { ...c.routing, fromAddress: e.target.value },
                  }))
                }
              />
            </Field>
            <Field
              label="Team Alert Email (BCC Target)"
              hint="All customer itinerary submissions will send an instant notification copy to this address."
            >
              <input
                type="email"
                className={inputClass}
                value={config.routing.bccRecipient}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    routing: { ...c.routing, bccRecipient: e.target.value },
                  }))
                }
              />
            </Field>
          </div>
          <p className="mt-4 inline-flex items-start gap-2 rounded-xl border border-[#2C2C2E] bg-[#121212] px-3 py-2.5 text-xs text-zinc-400">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B85304]" />
            Guest receives the proposal; BCC goes to{" "}
            <span className="text-[#D9BB96]">
              {config.routing.bccRecipient || "armando@tokiotours.nl"}
            </span>
            .
          </p>
        </div>
      ) : null}

      {tab === "template" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-[#2C2C2E] bg-[#1C1C1E] p-5 sm:p-6">
            <Field
              label="Subject Line"
              hint="Use {{bookingRef}} or {{fullName}} placeholders."
            >
              <input
                className={inputClass}
                value={config.template.subjectLine}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    template: { ...c.template, subjectLine: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Header Title">
              <input
                className={inputClass}
                value={config.template.headerTitle}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    template: { ...c.template, headerTitle: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Welcome Message Body">
              <textarea
                rows={5}
                className={`${inputClass} resize-y`}
                value={config.template.welcomeBody}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    template: { ...c.template, welcomeBody: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="CTA Button Text">
              <input
                className={inputClass}
                value={config.template.ctaButtonText}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    template: { ...c.template, ctaButtonText: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="CTA URL">
              <input
                className={inputClass}
                value={config.template.ctaUrl}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    template: { ...c.template, ctaUrl: e.target.value },
                  }))
                }
              />
            </Field>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#1C1C1E]">
            <div className="border-b border-[#2C2C2E] px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#D9BB96]">
              Live preview
            </div>
            <iframe
              title="Email template preview"
              srcDoc={previewHtml}
              className="h-[520px] w-full bg-[#121212]"
              sandbox=""
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
