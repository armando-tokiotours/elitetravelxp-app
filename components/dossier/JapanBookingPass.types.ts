import type { ReactNode } from "react";

export type BookingPassTripType = "single" | "multi";

export type BookingPassStatus =
  | "DRAFT"
  | "PENDING_DEPOSIT"
  | "PROCESSING"
  | "DEPOSIT_PAID"
  | "PENDING_BALANCE"
  | "FULLY_PAID"
  | "CANCELLED"
  /** Legacy aliases still accepted from older payloads */
  | "IN_PROGRESS"
  | "INCOMING"
  | "QUOTED"
  | "CONFIRMED"
  | "IN_OPS"
  | "DONE"
  | "REVIEW";

export interface RouteBreakdownItem {
  city: string;
  nights: number;
}

export interface BookingPassProps {
  pnrCode: string;
  guestName: string;
  /** Shown under guest name when present (Send / Print identity). */
  guestEmail?: string;
  partyText: string;
  travelStyle: string;
  tripType: BookingPassTripType;
  experienceType?: string;

  /** Multi-day airport / hub codes */
  originCode?: string;
  originLabel?: string;
  destinationCode?: string;
  destinationLabel?: string;

  /** Single-day pickup / drop-off times (HH:MM) */
  startTime?: string;
  endTime?: string;
  /** Single-day area / activity focus line */
  singleDayHighlights?: string;

  durationText?: string;
  startDateText: string;
  endDateText: string;
  routeBreakdown?: RouteBreakdownItem[];

  status?: BookingPassStatus;
  /** Concierge / design deposit already credited (€). */
  depositPaidEur?: number;
  /** True when guest has settled the full package balance. */
  hasPaidFull?: boolean;
  /** Concierge agent name for direct bookings (shown near PNR). */
  conciergeAgentName?: string | null;
  qrValue?: string;
  /** When set, shows a compact edit icon linking to the builder. */
  editHref?: string;
  actions?: ReactNode;
  onDownloadWalletPass?: () => void;
  onRefreshPass?: () => void;
  showSectionOutline?: boolean;
}
