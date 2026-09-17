import { handleSendItinerary } from "@/lib/sendItinerary";

/** @deprecated Prefer POST /api/send-itinerary */
export async function POST(request: Request) {
  return handleSendItinerary(request);
}
