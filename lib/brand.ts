/** Canonical Tokiotours brand strings — use instead of hardcoding.
 * Browser tab title/description can be overridden in Team → Site Branding
 * (`document_title` / `document_description` on site_branding).
 */
export const BRAND_NAME = "Tokiotours";

export const BRAND_DOMAIN = "tokiotours-app.com";

export const BRAND_URL = `https://${BRAND_DOMAIN}`;

export const BRAND_TITLE = "Tokiotours — Japan Journey Architect";

export const BRAND_DESCRIPTION =
  "Custom 1-Day Highlights & Grand Bespoke Japan Vacation Builder";

export const BRAND_DIFFERENCE_TITLE = "The TOKIOTOURS Difference";

export const BRAND_EMAIL_FROM = "no_reply@tokiotours.com";

export const BRAND_MAIL_FROM = `Tokiotours Concierge <${BRAND_EMAIL_FROM}>`;

export const BRAND_CONSULTANT = "TOKIOTOURS consultant";

/** Official circular mascot emblem — full-res for print / email (~350KB). */
export const BRAND_LOGO_JPG = "/images/tokiotours-logo.jpg";
export const BRAND_LOGO_PNG = "/images/tokiotours-logo.png";
export const BRAND_LOGO = BRAND_LOGO_PNG;

/** Tiny circular mark for headers / UI (~20KB) — same art as favicon. */
export const BRAND_LOGO_ICON = "/brand/tokiotours-logo-icon.png";

export const LOCAL_FONTS = {
  h1: "Godiva-Regular",
  h2: "Hanson-Bold",
  body: "Futura-Medium",
  caption: "GeosansLight-Regular",
  beauty: "BeautyDemo",
} as const;
