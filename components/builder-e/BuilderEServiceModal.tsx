"use client";

import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import {
  useBuilderEStore,
  type BuilderECategory,
} from "@/store/useBuilderEStore";
import { BuilderECategoryForms } from "@/components/builder-e/BuilderEForms";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import { DesktopSafeViewport } from "@/components/layout/DesktopSafeViewport";

type ServiceKey = Exclude<BuilderECategory, null>;

const COPY: Record<
  ServiceKey,
  {
    title: string;
    how: string;
    cancel: string;
    requirements: string;
    presets?: string[];
  }
> = {
  DRIVER: {
    title: "Chauffeur & Transfers",
    how: "Share pickup, drop-off, party size and luggage. We size Alphard vs HiAce and assign a licensed chauffeur.",
    cancel: "Free changes up to 48h before service. Within 48h, fees may apply depending on vehicle hold.",
    requirements: "Flight number (airport jobs), hotel name/address, passenger + luggage counts.",
  },
  EXPERIENCE: {
    title: "Attractions & Tours",
    how: "Pick the activity, date and time slot. Passport names are required for ticket issuance.",
    cancel: "Attraction tickets follow supplier rules — many are non-refundable once issued.",
    requirements: "Passport full names, ages, preferred time slot. Guide language if guided.",
    presets: [
      "teamLab Planets",
      "Tokyo DisneySea",
      "Shibuya Sky",
      "Private guide half-day",
    ],
  },
  TRANSIT: {
    title: "Transit & Passes",
    how: "Choose Suica, JR Pass or Shinkansen seats. We fulfill hotel delivery, airport counter or digital QR.",
    cancel: "IC cards unused can often be returned; reserved Shinkansen seats follow JR change rules.",
    requirements: "Pass type, route (for rail), travel date, and delivery preference.",
    presets: [
      "Suica physical",
      "Digital Suica help",
      "Shinkansen reserved",
      "JR Pass",
    ],
  },
};

function Accordion({
  title,
  body,
  open,
  onToggle,
}: {
  title: string;
  body: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-bold tracking-wider text-zinc-200 uppercase"
      >
        {title}
        <ChevronDown
          className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <p className="border-t border-white/5 px-3 py-2.5 text-xs leading-relaxed text-zinc-400">
          {body}
        </p>
      ) : null}
    </div>
  );
}

export function BuilderEServiceModal({
  open,
  category,
  onClose,
}: {
  open: boolean;
  category: ServiceKey | null;
  onClose: () => void;
}) {
  const setCategory = useBuilderEStore((s) => s.setCategory);
  const ensureBookingRef = useBuilderEStore((s) => s.ensureBookingRef);
  const addCartItem = useBuilderEStore((s) => s.addCartItem);
  const patchExperience = useBuilderEStore((s) => s.patchExperience);
  const patchTransit = useBuilderEStore((s) => s.patchTransit);
  const driver = useBuilderEStore((s) => s.driver);
  const experience = useBuilderEStore((s) => s.experience);
  const transit = useBuilderEStore((s) => s.transit);
  const [openAcc, setOpenAcc] = useState<string>("how");

  if (!open || !category) return null;
  const copy = COPY[category];

  const addCurrent = () => {
    ensureBookingRef();
    setCategory(category);
    let label = copy.title;
    let summary = "";
    let payload: Record<string, unknown> = {};

    if (category === "DRIVER") {
      label = "Private transfer";
      summary = [driver.pickupLocation, driver.dropoffLocation, driver.pickupTime]
        .filter(Boolean)
        .join(" → ") || "Transfer details pending";
      payload = { ...driver };
    } else if (category === "EXPERIENCE") {
      label = experience.activityTitle.trim() || "Attraction / tour";
      summary = [experience.targetDate, experience.timeSlot]
        .filter(Boolean)
        .join(" · ") || "Date TBD";
      payload = { ...experience };
    } else {
      label =
        transit.passType.replace(/_/g, " ").trim() || "Transit / pass";
      summary =
        transit.routeFrom || transit.routeTo
          ? `${transit.routeFrom || "—"} → ${transit.routeTo || "—"}`
          : transit.delivery.replace(/_/g, " ") || "Fulfillment TBD";
      payload = { ...transit };
    }

    addCartItem({ category, label, summary, payload });
    showSystemMessage({
      text: `Added to booking · ${label}`,
      tone: "info",
    });
  };

  const addPreset = (preset: string) => {
    ensureBookingRef();
    setCategory(category);
    if (category === "EXPERIENCE") {
      patchExperience({ activityTitle: preset });
      addCartItem({
        category,
        label: preset,
        summary: "Quick add · details editable",
        payload: { activityTitle: preset },
      });
    } else if (category === "TRANSIT") {
      const map: Record<string, typeof transit.passType> = {
        "Suica physical": "suica_physical",
        "Digital Suica help": "suica_digital",
        "Shinkansen reserved": "shinkansen",
        "JR Pass": "jr_pass",
      };
      const passType = map[preset] || "";
      patchTransit({ passType });
      addCartItem({
        category,
        label: preset,
        summary: "Quick add · details editable",
        payload: { passType },
      });
    }
    showSystemMessage({ text: `Added · ${preset}`, tone: "info" });
  };

  return (
    <DesktopSafeViewport
      onClose={onClose}
      maxWidth="max-w-lg"
      zIndexClass="z-[180]"
      backdropClassName="bg-black/80 backdrop-blur-md"
      frameClassName="overflow-y-auto"
    >
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-[#F6A724] uppercase">
              VIP Access
            </p>
            <h2 className="font-godiva mt-1 text-xl tracking-wide text-white uppercase">
              {copy.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 p-2 text-zinc-400 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 space-y-2">
          <Accordion
            title="How it works"
            body={copy.how}
            open={openAcc === "how"}
            onToggle={() => setOpenAcc(openAcc === "how" ? "" : "how")}
          />
          <Accordion
            title="Cancellation Policy"
            body={copy.cancel}
            open={openAcc === "cancel"}
            onToggle={() => setOpenAcc(openAcc === "cancel" ? "" : "cancel")}
          />
          <Accordion
            title="Requirements"
            body={copy.requirements}
            open={openAcc === "req"}
            onToggle={() => setOpenAcc(openAcc === "req" ? "" : "req")}
          />
        </div>

        {copy.presets?.length ? (
          <div className="mb-4">
            <p className="mb-2 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Explore &amp; quick-add
            </p>
            <div className="flex flex-wrap gap-2">
              {copy.presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => addPreset(p)}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:border-[#F6A724]/50 hover:text-[#F6A724]"
                >
                  + {p}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mb-4">
          <p className="mb-2 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            Logistics
          </p>
          <BuilderECategoryForms />
        </div>

        <button
          type="button"
          onClick={addCurrent}
          className="w-full rounded-xl bg-[#075473] px-4 py-3 text-xs font-bold tracking-wider text-white uppercase transition hover:bg-[#054F70]"
        >
          Add to booking
        </button>
      </div>
    </DesktopSafeViewport>
  );
}
