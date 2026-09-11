import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const body = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Elite Travel Experiences Group",
    template: "%s · Elite Travel Experiences Group",
  },
  description:
    "Bespoke luxury Japan itineraries — design your journey with our live Trip Builder.",
  metadataBase: new URL("https://travelexperiencesgroup.com"),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F5F0E8] text-[#0B1F3A]">
        {children}
      </body>
    </html>
  );
}
