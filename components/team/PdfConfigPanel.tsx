"use client";

import { FileText, Smartphone } from "lucide-react";
import type { EmailTemplateConfig } from "@/config/emailDefaults";

const SAMPLE_PNR = "JPN-DEMO01";
/** Matches lib/pdf/mobilePdfEngine.ts — emailed itinerary PDFs. */
const PHONE_WIDTH_PX = 430;

/**
 * Team Visual Configuration → PDF tab.
 * Documents phone-viewport attach format (not A4) for Dossier + Invoice.
 */
export function PdfConfigPanel({
  template,
  onChange,
}: {
  template: EmailTemplateConfig;
  onChange: (patch: Partial<EmailTemplateConfig>) => void;
}) {
  const briefName = (
    template.pdfFileNamePattern || "TOKIOTOURS-brief-{{bookingRef}}.pdf"
  ).replace(/\{\{\s*bookingRef\s*\}\}/gi, SAMPLE_PNR);

  const dossierName = `Japan_Travel_Dossier_${SAMPLE_PNR}.pdf`;
  const invoiceName = `Japan_Invoice_${SAMPLE_PNR}.pdf`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-2xl border border-[#075473]/40 bg-[#075473]/10 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#075473]/30 text-[#7dd3fc]">
            <Smartphone className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">
              Phone view PDF — not A4
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Send / Print attachments are built as a{" "}
              <strong className="text-[#7dd3fc]">
                ~{PHONE_WIDTH_PX}px-wide mobile page
              </strong>{" "}
              (iPhone-friendly scroll, dark theme). This is{" "}
              <strong className="text-white">not</strong> print A4 paper size.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
                <dt className="text-zinc-500">Width</dt>
                <dd className="font-semibold text-white">{PHONE_WIDTH_PX}px</dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
                <dt className="text-zinc-500">Height</dt>
                <dd className="font-semibold text-white">Scroll / continuous</dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
                <dt className="text-zinc-500">Theme</dt>
                <dd className="font-semibold text-white">Dark UI</dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
                <dt className="text-zinc-500">Engine</dt>
                <dd className="font-semibold text-white">Chromium mobile</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#2C2C2E] bg-[#1C1C1E] p-5">
        <h3 className="text-sm font-semibold text-white">
          Itinerary email attachments
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          When the guest Send / Prints from Builder, these PDFs can attach
          (phone view). Preview as they appear in the inbox.
        </p>

        <div className="mt-4 space-y-2">
          <AttachRow
            title="Travel Dossier"
            filename={dossierName}
            hint={`Phone PDF · ${PHONE_WIDTH_PX}px · dark dossier layout`}
          />
          <AttachRow
            title="Invoice"
            filename={invoiceName}
            hint={`Phone PDF · ${PHONE_WIDTH_PX}px · quotation / invoice`}
          />
        </div>

        {/* Mini phone frame mock */}
        <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-center sm:gap-6">
          <PhoneFrame label="Dossier" accent="#F6A724" />
          <PhoneFrame label="Invoice" accent="#1BA58A" />
        </div>
      </div>

      <div className="rounded-2xl border border-[#2C2C2E] bg-[#1C1C1E] p-5">
        <h3 className="text-sm font-semibold text-white">
          Pre-Elite brief PDF
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Optional file from Save &amp; Email on /pre-build (boarding-pass
          flow).
        </p>

        <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={template.attachPdf !== false}
            onChange={(e) => onChange({ attachPdf: e.target.checked })}
            className="rounded border-zinc-600"
          />
          Attach brief PDF with Save &amp; Email
        </label>

        <label className="mt-3 block">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#075473]/80">
            Brief filename pattern
          </span>
          <input
            value={template.pdfFileNamePattern || ""}
            onChange={(e) => onChange({ pdfFileNamePattern: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-[#2C2C2E] bg-[#121212] px-3 py-2.5 text-sm text-white outline-none focus:border-[#075473]"
            placeholder="TOKIOTOURS-brief-{{bookingRef}}.pdf"
          />
        </label>

        {template.attachPdf !== false ? (
          <div className="mt-3">
            <AttachRow
              title="Pre-Elite brief"
              filename={briefName}
              hint="Guest inbox attachment (brief / pass summary)"
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">Brief PDF attach is off.</p>
        )}
      </div>
    </div>
  );
}

function AttachRow({
  title,
  filename,
  hint,
}: {
  title: string;
  filename: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-zinc-700 bg-[#121212] px-3 py-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#075473]/25 text-[#7dd3fc]">
        <FileText className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {title}
        </p>
        <p className="truncate text-sm font-medium text-white">{filename}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
      </div>
    </div>
  );
}

function PhoneFrame({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative overflow-hidden rounded-[1.35rem] border-2 border-zinc-600 bg-[#0A1017] shadow-xl"
        style={{ width: 140, height: 280 }}
      >
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-1.5">
          <span className="h-1 w-10 rounded-full bg-zinc-700" />
        </div>
        <div className="flex h-full flex-col px-2.5 pt-5 pb-2">
          <p
            className="text-[8px] font-bold uppercase tracking-wider"
            style={{ color: accent }}
          >
            Tokiotours
          </p>
          <p className="mt-1 text-[10px] font-semibold text-white">{label}</p>
          <div className="mt-2 flex-1 space-y-1.5">
            <div className="h-8 rounded-md bg-white/5" />
            <div className="h-12 rounded-md bg-white/5" />
            <div className="h-8 rounded-md bg-white/5" />
            <div className="h-16 rounded-md bg-white/5" />
          </div>
          <p className="mt-1 text-center text-[7px] text-zinc-600">
            {PHONE_WIDTH_PX}px · phone PDF
          </p>
        </div>
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label} frame
      </p>
    </div>
  );
}
