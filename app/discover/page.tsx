import type { Metadata } from "next";
import { DiscoverFeed } from "@/components/discover/DiscoverFeed";

export const metadata: Metadata = {
  title: "Discover Experiences",
};

export default function DiscoverPage() {
  return <DiscoverFeed />;
}
