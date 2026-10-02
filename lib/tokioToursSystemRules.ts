/**
 * TokioTours Operations & Concierge system rules — grounded context for Gemini Assist.
 * Mirror these in Google Drive Shared Drive: "TokioTours - Operations & Concierge SOPs"
 */

export const TOKIO_TOURS_SYSTEM_RULES = `
# TokioTours System Operating Rules (Ops & Concierge)

## Pricing & Discounts
- Concierge commitment deposit: €60 (default). 100% credited toward the tour balance when paid.
- Agents may discount billable cart lines by up to **15%** without Ops Manager approval.
- Any billable reduction **greater than 15%** of the cart base total requires Operations Manager / Owner override (lock Save Cart; send approval request to OPS channel).
- Complimentary bonuses (€0 / 🎁 FREE BONUS) are gift grants and are excluded from the 15% discount math.
- Optional "final approved package" deal lock can be set by Ops; when below estimate, guest invoice shows "Deal unlocked".
- Tour payment statuses: UNPAID → FEE_PAID (€60) → PARTIALLY_PAID (30% progress) → FULLY_PAID.
- 30% progress milestone = deposit + 30% of (package base − fee). Vendor dispatch unlock guidance follows this milestone; guest-facing confirmations unlock after FULLY_PAID.

## Guide Workload & Dispatch
- Standard guided day budget is aligned to the selected tour hours (e.g. City Tour 6h catalog price already includes the guided tour — do not add a separate private guide hourly line).
- Ticket / place extras (TeamLab, admission activities) do **not** consume guide hours.
- Night-tour short blocks: **3-hour night tour** style services are treated as workload exemptions relative to a full daytime block — do not double-book as a full 9h day without Ops review.
- Match guides by language preference, family/party needs, and city focus when dispatching.

## Logistics & Transport
- Suica / PASMO: when guest chooses subway / IC transit, collect Suica need + value (€) and route ticket procurement via Ticketer (TIX) channel.
- Private chauffeur: Alphard / HiAce capacity must fit party size; driver coordination uses DRIV channel.
- Specialist Direct Chat: Concierge/Ops may toggle Ticketer or Driver direct guest chat ON/OFF; when ON, specialist messages appear in CUST with role badges in Ops view; guest sees branded TokioTours specialist titles.
- Ticket voucher PDFs and chat image attachments purge ~2 days after tour end.

## Comms
- Channels: CUST (guest), OPS (internal), GUID, DRIV, TIX.
- Draft guest replies that are polite, clear, and multi-lingual when the guest writes in another language; keep TokioTours Concierge voice.
- Never invent prices not present on the invoice; cite the 15% rule when agents ask about discretionary discounts.
`.trim();

export type GeminiAssistPromptType =
  | "DISCOUNT_RULE"
  | "DRAFT_REPLY"
  | "SUICA_EXPLAIN"
  | "WORKLOAD_RULE"
  | "GENERAL";

export function promptTypeInstruction(
  promptType: GeminiAssistPromptType,
  guestMessage: string,
  pnr: string
): string {
  const guest = String(guestMessage || "").trim() || "(no guest message yet)";
  switch (promptType) {
    case "DISCOUNT_RULE":
      return `PNR ${pnr}. Explain whether an agent can apply a discretionary discount without Ops Manager approval. Cite the 15% cart billable rule and what happens above 15%. Guest context (if any): ${guest}`;
    case "SUICA_EXPLAIN":
      return `PNR ${pnr}. Draft a clear guest-facing explanation of Suica/PASMO / IC card setup for Japan transit in TokioTours bookings. Guest message: ${guest}`;
    case "WORKLOAD_RULE":
      return `PNR ${pnr}. Summarize guide workload rules relevant to Ops (tour hours vs ticket extras, night 3h exemption). Guest/ops note: ${guest}`;
    case "DRAFT_REPLY":
      return `PNR ${pnr}. Draft a polite, professional TokioTours Concierge reply for the CUST channel answering this guest message. Keep it concise (2–5 short paragraphs max). Match the guest's language if clearly non-English. Guest message:\n${guest}`;
    default:
      return `PNR ${pnr}. Answer using TokioTours system rules. Context:\n${guest}`;
  }
}

/** Deterministic fallbacks when GEMINI_API_KEY is not configured. */
export function fallbackAssistReply(
  promptType: GeminiAssistPromptType,
  guestMessage: string,
  pnr: string
): string {
  switch (promptType) {
    case "DISCOUNT_RULE":
      return [
        `Discount rule for ${pnr || "this booking"}:`,
        `• Concierge agents may reduce billable cart lines by up to 15% without Ops Manager approval.`,
        `• Any deeper cut locks Save Cart and must be sent to the OPS channel for Owner/Ops override.`,
        `• 🎁 Complimentary bonuses (€0) are separate gifts and do not count toward the 15% math.`,
        `• The €60 Concierge deposit remains 100% credited to the guest balance when paid.`,
      ].join("\n");
    case "SUICA_EXPLAIN":
      return [
        `Thank you for your message${pnr ? ` regarding ${pnr}` : ""}.`,
        ``,
        `For Tokyo transit we usually set you up with a Suica or PASMO IC card. It works on metro, JR local lines, and many buses — tap in and out like a contactless wallet.`,
        ``,
        `We’ll handle the setup value on your invoice and our Ticketing Specialist will confirm once your card / QR setup is ready. If you already have a Suica or Welcome Suica, just tell us and we can skip the new card.`,
        ``,
        `Happy to adjust the top-up amount if you prefer a lighter or higher balance.`,
      ].join("\n");
    case "WORKLOAD_RULE":
      return [
        `Guide workload notes:`,
        `• Selected City Tour catalog hours already include the guided experience — do not add a separate private-guide hourly charge.`,
        `• Ticket extras (e.g. TeamLab) sit outside guide hours.`,
        `• Short night-tour blocks (~3h) are treated as workload exemptions vs a full daytime day — confirm with Ops before stacking on a heavy day.`,
      ].join("\n");
    case "DRAFT_REPLY": {
      const quoted = String(guestMessage || "").trim();
      return [
        `Hello! Thank you for writing to TokioTours Concierge${pnr ? ` about booking ${pnr}` : ""}.`,
        ``,
        quoted
          ? `We’ve reviewed your note and we’re happy to help with this.`
          : `How can we support your Japan plans today?`,
        ``,
        `Please let us know any timing preferences or constraints and we’ll confirm the next steps on your itinerary and invoice.`,
        ``,
        `Warm regards,\nTokioTours Concierge`,
      ].join("\n");
    }
    default:
      return `For ${pnr || "this PNR"}: agents have a 15% self-serve discount cap; Suica/IC is handled via Ticketer; guide hours follow the selected tour (ticket extras excluded). Ask DISCOUNT_RULE, SUICA_EXPLAIN, WORKLOAD_RULE, or DRAFT_REPLY for a focused answer.`;
  }
}
