import type { Metadata } from "next";
import localFont from "next/font/local";
import { DynamicTypography } from "@/components/layout/DynamicTypography";
import "./globals.css";

/**
 * Keep the font set lean — next/font re-encodes every listed file on first
 * compile. Accent weights live in /public/fonts for later use, but aren't
 * loaded until needed.
 */
const momoTrust = localFont({
  src: "../public/fonts/MomoTrustDisplay-Regular.ttf",
  variable: "--font-momo",
  display: "swap",
  weight: "400",
  style: "normal",
});

const poppins = localFont({
  src: [
    {
      path: "../public/fonts/Poppins-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Poppins-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/Poppins-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/Poppins-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Elite Travel Experiences",
    template: "%s · Elite Travel Experiences",
  },
  description:
    "Bespoke luxury Japan itineraries — design your journey with our live Trip Builder.",
  metadataBase: new URL("https://travelexperiencesgroup.com"),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${momoTrust.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#F5F0E8] font-sans text-[#0B1F3A]">
        <DynamicTypography />
        {children}
      </body>
    </html>
  );
}
