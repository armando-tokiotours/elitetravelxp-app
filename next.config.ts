import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdfkit", "nodemailer", "resend", "sharp"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "travelexperiencesgroup.com",
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
};

export default nextConfig;
