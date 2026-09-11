import type { Metadata } from "next";
import { BuilderApp } from "@/components/builder/BuilderApp";

export const metadata: Metadata = {
  title: "Build Your Japan Journey",
  description:
    "Mobile-first trip builder for Elite Travel Experiences Group — powered by live PocketBase configuration.",
};

export default function BuilderPage() {
  return <BuilderApp />;
}
