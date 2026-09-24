import type { Metadata } from "next";
import localFont from "next/font/local";
import { DynamicTypography } from "@/components/layout/DynamicTypography";
import { SeasonalParticlesHost } from "@/components/branding/SeasonalParticles";
import { BRAND_DESCRIPTION, BRAND_TITLE, BRAND_URL } from "@/lib/brand";
import "./globals.css";

/**
 * TOKIOTOURS type stack — self-hosted faces from public/fonts
 * (Godiva, Hanson, Futura Medium, Geosans Light, BeautyDemo).
 */
const godiva = localFont({
  src: "../public/fonts/Godiva-Regular.ttf",
  variable: "--font-godiva-face",
  display: "swap",
  weight: "400",
  style: "normal",
});

const hanson = localFont({
  src: "../public/fonts/Hanson-Bold.otf",
  variable: "--font-hanson-face",
  display: "swap",
  weight: "700",
  style: "normal",
});

const futura = localFont({
  src: "../public/fonts/Futura-Medium.ttf",
  variable: "--font-futura-face",
  display: "swap",
  weight: "500",
  style: "normal",
});

const geosans = localFont({
  src: "../public/fonts/GeosansLight-Regular.ttf",
  variable: "--font-geosans-face",
  display: "swap",
  weight: "300",
  style: "normal",
});

const beauty = localFont({
  src: "../public/fonts/BeautyDemo.otf",
  variable: "--font-beauty-face",
  display: "swap",
  weight: "400",
  style: "normal",
});

export const metadata: Metadata = {
  title: {
    default: BRAND_TITLE,
    template: `%s · TOKIOTOURS`,
  },
  description: BRAND_DESCRIPTION,
  metadataBase: new URL(BRAND_URL),
  openGraph: {
    title: BRAND_TITLE,
    description: BRAND_DESCRIPTION,
    url: BRAND_URL,
    siteName: "TOKIOTOURS",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${godiva.variable} ${hanson.variable} ${futura.variable} ${geosans.variable} ${beauty.variable} h-full antialiased`}
      style={{ backgroundColor: "#05080C" }}
    >
      <body className="tokio-ambient-bg flex min-h-full flex-col font-futura text-tokio-ice">
        <DynamicTypography />
        <SeasonalParticlesHost />
        {children}
      </body>
    </html>
  );
}
