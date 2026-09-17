/**
 * Luxury hotel room allocation with per-type guest capacity.
 * Twin / Superior = 2 pax · Standard = 1 or 2 (selectable).
 */

export type RoomRequirements = {
  roomsNeeded: number;
  remainder: number;
  roomCapacity: number;
  breakdownText: string;
};

export type HotelRoomCounts = {
  standard: number;
  twin: number;
  superior: number;
};

/** Guests sleeping in each Standard room (1 or 2). */
export type StandardOccupancy = 1 | 2;

export type HotelAllocationStatus = {
  totalRooms: number;
  accommodatedGuests: number;
  remainingGuests: number;
  guests: number;
  covered: boolean;
  canAdd: boolean;
  label: string;
  tone: "ok" | "warn" | "empty";
};

export function emptyHotelRooms(): HotelRoomCounts {
  return { standard: 0, twin: 0, superior: 0 };
}

export function totalHotelRooms(rooms: HotelRoomCounts | null | undefined): number {
  if (!rooms) return 0;
  return (
    Math.max(0, Number(rooms.standard) || 0) +
    Math.max(0, Number(rooms.twin) || 0) +
    Math.max(0, Number(rooms.superior) || 0)
  );
}

export function accommodatedHotelGuests(
  rooms: HotelRoomCounts | null | undefined,
  standardOccupancy: StandardOccupancy = 2
): number {
  if (!rooms) return 0;
  const occ = standardOccupancy === 1 ? 1 : 2;
  return (
    Math.max(0, Number(rooms.twin) || 0) * 2 +
    Math.max(0, Number(rooms.superior) || 0) * 2 +
    Math.max(0, Number(rooms.standard) || 0) * occ
  );
}

/** Suggested mix: as many Twins as possible, remainder on Standard @ 2. */
export function suggestedHotelRooms(
  totalGuests: number,
  _roomCapacity = 2
): HotelRoomCounts {
  const g = Math.max(0, Math.floor(totalGuests));
  if (g <= 0) return emptyHotelRooms();
  const twins = Math.floor(g / 2);
  const rem = g % 2;
  return {
    twin: twins,
    standard: rem > 0 ? 1 : 0,
    superior: 0,
  };
}

export function getHotelAllocationStatus(
  rooms: HotelRoomCounts | null | undefined,
  totalGuests: number,
  standardOccupancy: StandardOccupancy = 2
): HotelAllocationStatus {
  const guests = Math.max(0, Math.floor(totalGuests));
  const totalRooms = totalHotelRooms(rooms);
  const accommodatedGuests = accommodatedHotelGuests(rooms, standardOccupancy);
  const remainingGuests = guests - accommodatedGuests;
  const canAdd = guests > 0 && remainingGuests > 0;
  const covered = guests > 0 && remainingGuests <= 0 && totalRooms > 0;

  let tone: HotelAllocationStatus["tone"] = "empty";
  let label = "Select rooms for your party";

  if (guests <= 0) {
    label = "Set guest count in Step 1";
  } else if (totalRooms === 0) {
    tone = "empty";
    label = `${guests} of ${guests} guests unassigned`;
  } else if (remainingGuests > 0) {
    tone = "warn";
    label = `${remainingGuests} of ${guests} guests unassigned`;
  } else {
    tone = "ok";
    label = `All ${guests} guests accommodated`;
  }

  return {
    totalRooms,
    accommodatedGuests,
    remainingGuests,
    guests,
    covered,
    canAdd,
    label,
    tone,
  };
}

/**
 * +/- room count. Adding is blocked when remainingGuests <= 0.
 */
export function adjustHotelRoomCount(
  rooms: HotelRoomCounts,
  key: keyof HotelRoomCounts,
  delta: number,
  totalGuests: number,
  standardOccupancy: StandardOccupancy = 2
): HotelRoomCounts | null {
  const next = {
    standard: Math.max(0, Number(rooms.standard) || 0),
    twin: Math.max(0, Number(rooms.twin) || 0),
    superior: Math.max(0, Number(rooms.superior) || 0),
  };
  const proposed = next[key] + delta;
  if (proposed < 0) return null;
  next[key] = proposed;

  if (delta > 0) {
    const status = getHotelAllocationStatus(rooms, totalGuests, standardOccupancy);
    if (!status.canAdd) return null;
  }

  return next;
}

export function formatHotelRoomsSummary(
  rooms: HotelRoomCounts | null | undefined,
  standardOccupancy?: StandardOccupancy
): string {
  if (!rooms) return "";
  const bits: string[] = [];
  if (rooms.standard > 0) {
    const occ =
      standardOccupancy === 1 ? " · 1pax" : standardOccupancy === 2 ? " · 2pax" : "";
    bits.push(`${rooms.standard}× Standard${occ}`);
  }
  if (rooms.twin > 0) bits.push(`${rooms.twin}× Twin`);
  if (rooms.superior > 0) bits.push(`${rooms.superior}× Superior`);
  return bits.join(" · ");
}

export function calculateRoomRequirements(
  totalGuests: number,
  roomCapacity: number = 2
): RoomRequirements | null {
  if (totalGuests <= 0) return null;

  const capacity = Math.max(1, Math.floor(roomCapacity) || 2);
  const roomsNeeded = Math.ceil(totalGuests / capacity);
  const remainder = totalGuests % capacity;

  let breakdownText = `${roomsNeeded} x Room${roomsNeeded > 1 ? "s" : ""}`;

  if (roomsNeeded === 1) {
    breakdownText += ` (${totalGuests} guest${totalGuests > 1 ? "s" : ""})`;
  } else if (remainder === 0) {
    breakdownText += ` (${capacity} guests each)`;
  } else {
    const fullRooms = roomsNeeded - 1;
    breakdownText += ` (${fullRooms}×${capacity} + 1×${remainder})`;
  }

  return { roomsNeeded, remainder, roomCapacity: capacity, breakdownText };
}
