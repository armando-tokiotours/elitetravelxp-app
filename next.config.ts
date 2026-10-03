import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  // Allow opening the local app via 127.0.0.1 as well as localhost
  // (Next 16 blocks cross-origin /_next assets otherwise → stuck "Loading…").
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  serverExternalPackages: [
    "pdfkit",
    "nodemailer",
    "resend",
    "sharp",
    "puppeteer-core",
    "qrcode",
  ],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 600],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tokiotours-app.com",
        pathname: "/api/files/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8090",
        pathname: "/api/files/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8090",
        pathname: "/api/files/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      {
        source: "/api/files/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/builder-single",
        destination: "/builder/day-pass",
        permanent: false,
      },
      {
        source: "/builder-single/itinerary",
        destination: "/builder/day-pass/itinerary",
        permanent: false,
      },
      {
        source: "/builder-single/itinerary/:path*",
        destination: "/builder/day-pass/itinerary/:path*",
        permanent: false,
      },
      {
        source: "/builder-e",
        destination: "/builder/vip-access",
        permanent: false,
      },
      {
        source: "/builder-e/dossier",
        destination: "/builder/vip-access/dossier",
        permanent: false,
      },
      {
        source: "/builder/itinerary",
        destination: "/builder/japan-journey/itinerary",
        permanent: false,
      },
      {
        source: "/builder/itinerary/:path*",
        destination: "/builder/japan-journey/itinerary/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
