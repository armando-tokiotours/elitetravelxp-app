/**
 * Email template facade — used by mail dispatch + Admin live preview.
 * HTML lives in `lib/emailTemplateHtml.ts` (Node-safe string builder).
 */

export {
  renderProposalEmailHtml,
  formatEmailDisplayDate,
  type ProposalEmailParams,
  type ProposalTripMeta,
} from "@/lib/emailTemplateHtml";
