"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchBuilderConfig,
  fetchExperiencesAndPlaces,
  mapEapToTour,
  pbFileUrl,
  tourMediaFile,
  tourPhoto,
  type PbTour,
} from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaStandards";
import {
  calculateDayEndTime,
  calculateTimeSlots,
} from "@/lib/singleDayTimeSlots";
import {
  guidePreferenceLabel,
} from "@/lib/singleDayPricing";
import {
  formatSingleDayDisplayDate,
  useSingleDayBuilderStore,
} from "@/store/useSingleDayBuilderStore";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { JapanBookingPass } from "@/components/dossier/JapanBookingPass";
import {
  YourTravelBriefWidget,
  type TravelBriefAnswers,
} from "@/components/dossier/PreBuilderSummaryWidget";
import { syncSingleDayBookingLead } from "@/lib/syncBookingLead";
import { CoordinationTeamSection } from "@/components/dossier/CoordinationTeamSection";
import { DossierTermsFooterSection } from "@/components/dossier/DossierTermsFooterSection";
import {
  TicketStubCard,
  DayServiceIdleRow,
  DayServiceTicketRow,
} from "@/components/dossier/DayStaffCards";
import { useTicketVoucher } from "@/components/dossier/TicketVoucherDownloadBanner";
import { useOpsBookingSnapshot } from "@/lib/useOpsStaffNames";
import { useConciergeAgentName } from "@/lib/useConciergeAgentName";
import { useAgentServices } from "@/lib/useAgentServices";
import {
  dayServicesFromAgentCart,
  isTicketServiceReady,
} from "@/lib/agentServices";
import {
  isDayServicesTicketRow,
  itineraryStopBadgeLabel,
} from "@/lib/experiencesPlaces";
import { normalizeTourDateIso } from "@/lib/guideJobs";
import {
  buildDossierQrUrl,
  buildSingleDayHighlights,
  experienceTierLabel,
  formatGuestCountText,
  mapBookingStatusToPass,
  resolvePnr,
} from "@/lib/dossier/bookingPassHelpers";
import { BUILDER_ROUTES } from "@/lib/builderRoutes";
import {
  enrichTimelineStops,
  SingleDayTimelineInfographic,
} from "@/components/builder-single/SingleDayTimelineInfographic";

const TRANSIT_BUFFER_MIN = 15;

/**
 * Dedicated Single-Day Travel Dossier — hour-by-hour schedule, city hub,
 * pace & guide. Never renders multi-city airport routes or hotel nights.
 */
export function SingleDayItineraryView({
  depositPaidEur = 0,
  hasPaidFull = false,
}: {
  depositPaidEur?: number;
  hasPaidFull?: boolean;
} = {}) {
  const tourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const adults = useSingleDayBuilderStore((s) => s.adults);
  const children = useSingleDayBuilderStore((s) => s.children);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const startTime = useSingleDayBuilderStore((s) => s.startTime);
  const cityFocus = useSingleDayBuilderStore((s) => s.cityFocus);
  const guidePreference = useSingleDayBuilderStore((s) => s.guidePreference);
  const meetingPoint = useSingleDayBuilderStore((s) => s.meetingPoint);
  const meetingPointName = useSingleDayBuilderStore((s) => s.meetingPointName);
  const travelPace = useSingleDayBuilderStore((s) => s.travelPace);
  const setTravelPace = useSingleDayBuilderStore((s) => s.setTravelPace);
  const preferredTourLanguage = useSingleDayBuilderStore(
    (s) => s.preferredTourLanguage
  );
  const setPreferredTourLanguage = useSingleDayBuilderStore(
    (s) => s.setPreferredTourLanguage
  );
  const singleGuestReqs = useSingleDayBuilderStore(
    (s) => s.guestSpecialRequirements
  );
  const setSingleGuestReqs = useSingleDayBuilderStore(
    (s) => s.setGuestSpecialRequirements
  );
  const preEliteTravelStyle = useBuilderStore((s) => s.preEliteTravelStyle);
  const preEliteInterests = useBuilderStore((s) => s.preEliteInterests);
  const preEliteMotivation = useBuilderStore((s) => s.preEliteMotivation);
  const preElitePainPoints = useBuilderStore((s) => s.preElitePainPoints);
  const selectedExperiences = useSingleDayBuilderStore(
    (s) => s.selectedExperiences
  );

  const tempBookingRef = useBuilderStore((s) => s.tempBookingRef);
  const confirmedBookingRef = useBuilderStore((s) => s.confirmedBookingRef);
  const bookingStatus = useBuilderStore((s) => s.bookingStatus);
  const experienceService = useBuilderStore((s) => s.experienceService);
  const isEliteConcierge = useBuilderStore((s) => s.isEliteConcierge);
  const clientName = useItineraryStore((s) => s.clientName);
  const clientEmail = useItineraryStore((s) => s.clientEmail);
  const preName = usePreBuilderStore(
    (s) => s.fullName || s.lastPayload?.fullName || ""
  );
  const preEmail = usePreBuilderStore(
    (s) => s.email || s.lastPayload?.email || ""
  );
  const passengerName = (clientName || preName || "").trim();
  const passengerEmail = (clientEmail || preEmail || "").trim().toLowerCase();

  const [catalog, setCatalog] = useState<PbTour[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchBuilderConfig();
        if (cancelled) return;
        const eap = await fetchExperiencesAndPlaces().catch(() => []);
        const extras = eap
          .filter((r) => r.is_active !== false)
          .map((r) => mapEapToTour(r, cfg.cities));
        const tours = cfg.tours ?? [];
        const ids = new Set(tours.map((t) => t.id));
        if (!cancelled) {
          setCatalog([...tours, ...extras.filter((p) => !ids.has(p.id))]);
        }
      } catch {
        if (!cancelled) setCatalog([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogById = useMemo(() => {
    const map = new Map<string, PbTour>();
    for (const t of catalog) map.set(t.id, t);
    return map;
  }, [catalog]);

  const thumbFor = (tourId: string): string => {
    const item = catalogById.get(tourId);
    if (!item) return "";
    const file = tourMediaFile(item) || tourPhoto(item);
    if (!file || !item.collectionId) return file || "";
    return (
      pbFileUrl(item.collectionId, item.id, file, {
        thumb: PB_THUMBS.card,
        format: "webp",
      }) || file
    );
  };

  const timedStops = useMemo(
    () =>
      calculateTimeSlots(startTime || "09:00", selectedExperiences, {
        bufferMinutes: TRANSIT_BUFFER_MIN,
      }),
    [startTime, selectedExperiences]
  );

  const enrichedStops = useMemo(
    () => enrichTimelineStops(timedStops, catalogById, thumbFor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timedStops, catalogById]
  );

  const dropOffTime = useMemo(() => {
    if (timedStops.length > 0) {
      return calculateDayEndTime(startTime || "09:00", selectedExperiences, {
        bufferMinutes: TRANSIT_BUFFER_MIN,
      });
    }
    return calculateDayEndTime(startTime || "09:00", [
      { duration_hours: tourHours },
    ]);
  }, [timedStops.length, startTime, selectedExperiences, tourHours]);

  const guideLabel = guidePreferenceLabel(guidePreference);
  const dateLabel = formatSingleDayDisplayDate(tourDate) || "Date TBD";
  const cityLabel = cityFocus.trim() || "City TBD";
  const hoursLabel = `${tourHours} HOUR${tourHours === 1 ? "" : "S"}`;
  const pnrCode = resolvePnr({
    tempBookingRef,
    confirmedBookingRef,
    bookingStatus,
  });
  const conciergeAgentName = useConciergeAgentName(pnrCode);
  const ops = useOpsBookingSnapshot(pnrCode);
  const agentServices = useAgentServices(pnrCode);
  const dayCart = useMemo(
    () => dayServicesFromAgentCart(agentServices),
    [agentServices]
  );
  const ticketVoucher = useTicketVoucher(pnrCode);
  const tourDateIso = normalizeTourDateIso(tourDate);
  const dayGuide =
    ops.dayGuides.find(
      (g) => g.tourDate === tourDateIso && g.name
    ) || ops.dayGuides.find((g) => g.name);
  const guideName = dayGuide?.name || ops.guideName;
  const driverName = ops.driverName;
  const guideConfirmLabel = dayGuide?.name
    ? `Guide Confirmed: ${dayGuide.name}`
    : ops.guideLabel;
  const guidePhotoUrl = dayGuide?.photoUrl || ops.guidePhotoUrl;
  const guideEmail = dayGuide?.email || ops.guideEmail;
  const guidePhone = dayGuide?.phone || ops.guidePhone;
  const guideWhatsapp = dayGuide?.whatsappDigits || ops.guideWhatsapp;
  const guideUnlockMessage =
    dayGuide?.unlockMessage || ops.guideUnlockMessage;
  const driverPhotoUrl = ops.driverPhotoUrl;
  const driverEmail = ops.driverEmail;
  const driverPhone = ops.driverPhone;
  const driverUnlockMessage = ops.driverUnlockMessage;
  const ticketsPurchaseAllowed = ops.ticketsPurchaseAllowed;
  const ticketGuestLabel = ops.ticketGuestLabel;
  const agentDisplay =
    ops.assignedAgent || conciergeAgentName || null;
  const passStatus =
    ops.passStatus ||
    mapBookingStatusToPass(bookingStatus, {
      depositPaidEur,
      hasPaidFull,
    });
  const passDate = dateLabel === "Date TBD" ? "" : dateLabel.toUpperCase();
  const pickup = startTime || "09:00";
  // HIGHLIGHTS & AREA = booked tour / activity titles (guided first, then
  // extras), never city + movement. Agent-cart TOUR/TICKET lines only fill
  // gaps (e.g. Ops-added services not in the builder selection).
  const highlights = buildSingleDayHighlights({
    cityFocus: cityLabel,
    experiences: selectedExperiences.map((e) => {
      const tour = catalogById.get(e.tourId);
      return {
        title: tour?.title || e.title,
        is_extra: e.is_extra,
        category: e.category || tour?.category,
        entry_type: e.entry_type || tour?.entry_type,
        access_type: e.access_type || tour?.access_type,
      };
    }),
    // Pass cart category through so TRANSPORT/transit lines (Suica, subway,
    // chauffeur…) are filtered by buildSingleDayHighlights — ticketItems
    // alone is not safe: IC/subway lines classify as tickets there.
    fallbackTitles: [
      ...dayCart.guideItems.map((i) => ({
        title: i.title,
        category: i.category,
      })),
      ...dayCart.ticketItems.map((i) => ({
        title: i.title,
        category: i.category,
      })),
    ],
  });

  /** Optimistic brief save → existing BAL upsert (Ops reads the same selections). */
  const handleSaveQuizAnswers = async (
    next: TravelBriefAnswers
  ): Promise<boolean> => {
    const prev: TravelBriefAnswers = {
      travelStyle: preEliteTravelStyle,
      travelPace,
      tourLanguage: preferredTourLanguage,
      guestSpecialRequirements: singleGuestReqs,
      interests: preEliteInterests,
      motivation: preEliteMotivation,
      painPoints: preElitePainPoints,
    };
    // Dual-store mirror (same pattern as applySingleDayBookingPatch /
    // SingleDayGuestsEditorModal): pre-Elite fields live only on
    // useBuilderStore, while the Pass reads pace/language/guest-reqs from
    // useSingleDayBuilderStore and other Builder S surfaces read them
    // from useBuilderStore — write BOTH so every subscriber re-renders
    // instantly and a later revert restores both.
    const applyBrief = (a: TravelBriefAnswers) => {
      useBuilderStore.setState({
        preEliteTravelStyle: a.travelStyle,
        preEliteInterests: [...a.interests],
        preEliteMotivation: a.motivation,
        preElitePainPoints: [...a.painPoints],
      });
      const builder = useBuilderStore.getState();
      builder.setTravelPace(a.travelPace);
      builder.setPreferredTourLanguage(a.tourLanguage || "EN");
      // Setter (not setState) so guestSpecialRequirementsAcked +
      // legacy specialNeeds stay in sync on the builder store.
      builder.setGuestSpecialRequirements(a.guestSpecialRequirements);
      setTravelPace(a.travelPace);
      setPreferredTourLanguage(a.tourLanguage || "EN");
      setSingleGuestReqs(a.guestSpecialRequirements);
    };
    applyBrief(next);
    // No contact/PNR yet — stores are persisted locally and the next
    // syncSingleDayBookingLead (Save / checkout) carries these selections.
    if (!passengerEmail || !pnrCode || pnrCode === "······") return true;
    const ok = await syncSingleDayBookingLead({
      bookingRef: pnrCode,
      email: passengerEmail,
      state: useSingleDayBuilderStore.getState(),
      preEliteTravelStyle: next.travelStyle,
      preEliteInterests: [...next.interests],
      preEliteMotivation: next.motivation,
      preElitePainPoints: [...next.painPoints],
    });
    if (!ok) applyBrief(prev);
    return ok;
  };

  const needsGuide =
    guidePreference === "private_guide" ||
    guidePreference === "local_host" ||
    selectedExperiences.length > 0 ||
    Boolean(dayCart.guideTitle);
  /**
   * Day Services → Tickets: live builder selections only (is_extra / activity /
   * ticket access). Agent cart supplies voucher readiness when titles match —
   * never fall back to stale Ops rows or mock seed places (e.g. Senso-ji).
   */
  const ticketStops = useMemo(() => {
    const agentByTitle = new Map(
      dayCart.ticketItems.map((i) => [
        String(i.title || "").trim().toLowerCase(),
        i,
      ])
    );
    return timedStops
      .map((stop) => {
        const tour = catalogById.get(stop.tourId);
        const category = stop.category || tour?.category;
        const entry_type = stop.entry_type || tour?.entry_type;
        const access_type = stop.access_type || tour?.access_type;
        if (
          !isDayServicesTicketRow({
            is_extra: stop.is_extra,
            access_type,
            category,
            entry_type,
            title: stop.title || tour?.title,
            description: tour?.description,
          })
        ) {
          return null;
        }
        const title = tour?.title || stop.title;
        const agent = agentByTitle.get(String(title || "").trim().toLowerCase());
        return {
          key: stop.tourId,
          title,
          timeLabel: stop.timeSlot || stop.startTime,
          accessType: String(access_type || "").trim() || undefined,
          kindBadge: itineraryStopBadgeLabel({
            category,
            entry_type,
            is_extra: stop.is_extra,
          }),
          thumbUrl: thumbFor(stop.tourId) || undefined,
          stopNumber: stop.stopNumber,
          durationHours: Number(stop.duration_hours) || 0,
          agentItem: agent || null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- thumbFor is stable per catalog
  }, [timedStops, catalogById, dayCart.ticketItems]);

  const hasTicketRows = ticketStops.length > 0;

  return (
    <div
      id="single-day-dossier-view"
      className="w-full space-y-6 overflow-visible px-0 text-slate-900 print:bg-white print:text-black"
    >
      {/* Dark itinerary / pass shell — solid so fixed city cover only shows in gaps */}
      <div className="mx-4 mb-8 sm:mx-5">
        <div className="rounded-3xl bg-[#23262c] p-6">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#F6A724] print:text-gray-900">
            1-Day Express Pass · Itinerary
          </p>

          <div className="mt-6">
            <JapanBookingPass
              pnrCode={pnrCode}
              guestName={passengerName || "GUEST"}
              guestEmail={passengerEmail || undefined}
              partyText={formatGuestCountText(adults, children)}
              travelStyle={guideLabel || "DAY TOUR"}
              tripType="single"
              experienceType={experienceTierLabel(
                experienceService,
                isEliteConcierge
              )}
              startTime={pickup}
              endTime={dropOffTime || "15:00"}
              singleDayHighlights={highlights}
              durationText={hoursLabel}
              startDateText={passDate}
              endDateText={passDate}
              status={passStatus}
              depositPaidEur={depositPaidEur}
              hasPaidFull={hasPaidFull}
              qrValue={buildDossierQrUrl(pnrCode, BUILDER_ROUTES.dayPassItinerary)}
              conciergeAgentName={agentDisplay}
              editHref="/builder-single"
            />
          </div>
        </div>
      </div>

      {/* Coordination → Day Services → Guest Vision Brief; mb opens parallax after */}
      <div className="mb-8 flex w-full flex-col gap-2">
        <CoordinationTeamSection
          pnr={pnrCode}
          agentName={agentDisplay}
          guestEmail={passengerEmail || undefined}
          guestName={passengerName || undefined}
          tripPath="/builder-single/itinerary"
          guide={{
            name: guideName,
            photoUrl: guidePhotoUrl,
            email: guideEmail,
            phone: guidePhone,
            whatsappDigits: guideWhatsapp,
            unlockMessage: guideUnlockMessage,
            emptyLabel: guideConfirmLabel,
            serviceTitle: needsGuide ? dayCart.guideTitle : null,
            serviceHint: "Pending assignment",
          }}
          driver={
            driverName
              ? {
                  name: driverName,
                  photoUrl: driverPhotoUrl,
                  email: driverEmail,
                  phone: driverPhone,
                  unlockMessage: driverUnlockMessage,
                }
              : null
          }
        />

        {/* Day Services in the dark gap between Coordination and Guest Vision Brief */}
        <div className="mb-4 rounded-2xl border-0 bg-transparent px-4 pb-1 pt-0 sm:px-5 print:break-inside-avoid print:rounded-none print:border-none print:bg-transparent">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-dotted border-slate-300 pb-2">
            <p className="text-[9px] font-bold tracking-wider text-slate-900 uppercase print:text-gray-600">
              Day services
            </p>
            <span className="font-mono text-[10px] font-bold tracking-wider text-slate-900 uppercase print:text-gray-600">
              Day 1
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Tickets only — guide & driver live in Coordination Team above */}
            <div className="ml-6 space-y-1.5 sm:ml-10">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 print:text-gray-600">
                Tickets
              </p>
              {hasTicketRows ? (
                !ticketsPurchaseAllowed &&
                !ticketStops.some((t) => t.agentItem) ? (
                  <DayServiceIdleRow
                    surface="light"
                    label="Tickets"
                    message={
                      ticketGuestLabel || "Waiting for payment confirmation"
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    {ticketStops.map((t) => {
                      const item = t.agentItem;
                      if (item) {
                        const itemUrl = String(item.voucherUrl || "").trim();
                        const ready = isTicketServiceReady(item, {
                          opsTicketStatus: ops.ticketStatus,
                          hasVoucher: Boolean(itemUrl || ticketVoucher?.url),
                        });
                        return (
                          <DayServiceTicketRow
                            key={t.key}
                            surface="light"
                            title={t.title}
                            ready={ready}
                            downloadUrl={ready && itemUrl ? itemUrl : null}
                            downloadFilename={
                              ready && itemUrl
                                ? item.voucherFilename ||
                                  ticketVoucher?.filename ||
                                  null
                                : null
                            }
                            guestEmail={passengerEmail || undefined}
                          />
                        );
                      }
                      if (!ticketsPurchaseAllowed) return null;
                      return (
                        <TicketStubCard
                          key={t.key}
                          title={t.title}
                          subtitle={`Entry · ${t.timeLabel}`}
                          accessType={t.accessType}
                          kindBadge={t.kindBadge}
                          thumbUrl={t.thumbUrl}
                          stopNumber={t.stopNumber}
                          durationHours={t.durationHours}
                        />
                      );
                    })}
                  </div>
                )
              ) : (
                <DayServiceIdleRow
                  surface="light"
                  label="Tickets"
                  message="No entry tickets needed for this day"
                />
              )}
            </div>
          </div>
        </div>

        <YourTravelBriefWidget
          answers={{
            travelStyle: preEliteTravelStyle,
            travelPace,
            tourLanguage: preferredTourLanguage,
            guestSpecialRequirements: singleGuestReqs,
            interests: preEliteInterests,
            motivation: preEliteMotivation,
            painPoints: preElitePainPoints,
          }}
          onSave={handleSaveQuizAnswers}
          guestName={passengerName}
          pnrCode={pnrCode}
          tripTypeLabel="1-Day Express Pass"
          timingLabel={`${dateLabel} · ${hoursLabel}`}
          groupLabel={formatGuestCountText(adults, children)}
        />
      </div>

      <SingleDayTimelineInfographic
        stops={enrichedStops}
        startTime={startTime || "09:00"}
        endTime={dropOffTime}
        totalHours={tourHours}
        cityLabel={cityLabel}
        meetingPointName={meetingPointName || null}
        meetingPointAddress={meetingPoint || null}
        variant="screen"
        editHref="/builder-single"
      />

      <DossierTermsFooterSection />
    </div>
  );
}


