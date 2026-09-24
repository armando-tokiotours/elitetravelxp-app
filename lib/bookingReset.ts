/**
 * @deprecated Prefer `@/lib/useBookingSync` — kept as a thin re-export.
 */
export {
  captureBookingIdentity as captureBookingResetSnapshot,
  emailNewBookingAccessLink as emailSavedProposalAccessLink,
  clearPersistedBookingStorage,
  resetInMemoryBookingStores,
  mintFreshBookingRef,
  performFullBookingReset,
  useBookingSync,
  type BookingIdentitySnapshot as BookingResetSnapshot,
  type FullBookingResetResult,
} from "@/lib/useBookingSync";

import {
  clearPersistedBookingStorage,
  resetInMemoryBookingStores,
  mintFreshBookingRef,
} from "@/lib/useBookingSync";

/** @deprecated Use mintFreshBookingRef / performFullBookingReset */
export function purgeAllBookingState(): string {
  clearPersistedBookingStorage();
  resetInMemoryBookingStores();
  return mintFreshBookingRef();
}
