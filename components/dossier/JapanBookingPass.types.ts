import type { ReactNode } from "react";

export type BookingPassTripType = "single" | "multi";

export type BookingPassStatus =
  | "IN_PROGRESS"
  | "CONFIRMED"
  | "REVIEW"
  | "DRAFT";

export interface RouteBreakdownItem {
  city: string;
  nights: number;
}

export interface BookingPassProps {
  pnrCode: string;
  guestName: string;
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
  qrValue?: string;
  actions?: ReactNode;
  onDownloadWalletPass?: () => void;
  onRefreshPass?: () => void;
  showSectionOutline?: boolean;
}
