import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import localFont from "next/font/local";
import { DynamicTypography } from "@/components/layout/DynamicTypography";
import { BrandDocumentMeta } from "@/components/branding/BrandDocumentMeta";
import { BrandCharacterPreloader } from "@/components/branding/BrandCharacterPreloader";
import { BRAND_DESCRIPTION, BRAND_TITLE, BRAND_URL } from "@/lib/brand";
import "./globals.css";

const LazySeasonalParticlesHost = dynamic(
  () =>
    import("@/components/branding/LazySeasonalParticlesHost").then((m) => ({
      default: m.LazySeasonalParticlesHost,
    })),
  { ssr: false }
);

const AppLinkInterceptor = dynamic(
  () =>
    import("@/components/navigation/AppLinkInterceptor").then((m) => ({
      default: m.AppLinkInterceptor,
    })),
  { ssr: false }
);

/**
 * TOKIOTOURS type stack — self-hosted via next/font (no CSS @font-face chains).
 * Preload only LCP-critical faces (body + brand display); defer the rest.
 * Beauty uses display:optional so it never blocks First Paint / LCP.
 */
const godiva = localFont({
  src: "../public/fonts/Godiva-Regular.ttf",
  variable: "--font-godiva-face",
  display: "swap",
  weight: "400",
  style: "normal",
  preload: true,
});

const hanson = localFont({
  src: "../public/fonts/Hanson-Bold.otf",
  variable: "--font-hanson-face",
  display: "optional",
  weight: "700",
  style: "normal",
  preload: false,
});

const futura = localFont({
  src: "../public/fonts/Futura-Medium.ttf",
  variable: "--font-futura-face",
  display: "swap",
  weight: "500",
  style: "normal",
  preload: true,
});

const geosans = localFont({
  src: "../public/fonts/GeosansLight-Regular.ttf",
  variable: "--font-geosans-face",
  display: "optional",
  weight: "300",
  style: "normal",
  preload: false,
});

const beauty = localFont({
  src: "../public/fonts/BeautyDemo.otf",
  variable: "--font-beauty-face",
  display: "optional",
  weight: "400",
  style: "normal",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: BRAND_TITLE,
    template: `%s · Tokiotours`,
  },
  description: BRAND_DESCRIPTION,
  metadataBase: new URL(BRAND_URL),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/favicon.png", type: "image/png" },
    ],
    apple: [{ url: "/brand/favicon.png", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: BRAND_TITLE,
    description: BRAND_DESCRIPTION,
    url: BRAND_URL,
    siteName: "Tokiotours",
    type: "website",
  },
};

/** Allow pinch-zoom for accessibility (WCAG). Photo zoom still uses PinchZoomPhoto. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${godiva.variable} ${hanson.variable} ${futura.variable} ${geosans.variable} ${beauty.variable} h-full antialiased`}
      style={{ backgroundColor: "#05080C" }}
    >
      <body className="tokio-ambient-bg flex min-h-full flex-col font-futura text-tokio-ice">
        <BrandCharacterPreloader />
        <DynamicTypography />
        <BrandDocumentMeta />
        <LazySeasonalParticlesHost />
        <AppLinkInterceptor />
        <main id="app-main" className="flex min-h-0 flex-1 flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
