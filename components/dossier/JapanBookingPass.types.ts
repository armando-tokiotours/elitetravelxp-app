import type { ReactNode } from "react";

export type BookingPassTripType = "single" | "multi";

export type BookingPassStatus =
  | "IN_PROGRESS"
  | "CONFIRMED"
  | "REVIEW"
  | "DRAFT";

export interface BookingPassProps {
  pnrCode: string;
  passengerName: string;
  guestCountText: string;
  travelStyle: string;
  tripType: BookingPassTripType;

  originCode?: string;
  originLabel?: string;
  destinationCode?: string;
  destinationLabel?: string;
  durationText?: string;
  datesText: string;

  status?: BookingPassStatus;
  qrValue?: string;
  paceLabel?: string | null;
  experienceLabel?: string | null;
  actions?: ReactNode;
  onDownloadWalletPass?: () => void;
  showSectionOutline?: boolean;
}
