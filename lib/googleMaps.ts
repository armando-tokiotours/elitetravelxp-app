const SCRIPT_ID = "tokiotours-google-maps";

declare global {
  interface Window {
    google?: typeof google;
    __tokiotoursMapsReady?: Promise<void>;
  }
}

export function getGoogleMapsApiKey(): string {
  return String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
}

/** Load Maps JS API (Places + Map) once. Resolves immediately if already present. */
export function loadGoogleMapsScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps requires a browser"));
  }
  if (window.google?.maps?.places) {
    return Promise.resolve();
  }
  if (window.__tokiotoursMapsReady) return window.__tokiotoursMapsReady;

  const key = getGoogleMapsApiKey();
  if (!key) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set"));
  }

  window.__tokiotoursMapsReady = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps script failed to load"))
      );
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&libraries=places&v=weekly`;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(script);
  });

  return window.__tokiotoursMapsReady;
}

/** Dark-mode Google Map styles (roadmap). */
export const GOOGLE_MAPS_DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [{ color: "#4b6878" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry.stroke",
    stylers: [{ color: "#334e87" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#283d6a" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6f9ba5" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#304a7d" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#98a5be" }],
  },
  {
    featureType: "transit",
    elementType: "labels.text.fill",
    stylers: [{ color: "#98a5be" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0e1626" }],
  },
];

export type MeetingPlaceResult = {
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  name?: string;
};

/** Static Maps URL for widget preview (dark-ish via style params). */
export function meetingPointStaticMapUrl(
  lat: number,
  lng: number,
  size = "640x360"
): string {
  const key = getGoogleMapsApiKey();
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const styles = [
    "feature:all|element:geometry|color:0x1d2c4d",
    "feature:all|element:labels.text.fill|color:0x8ec3b9",
    "feature:road|element:geometry|color:0x304a7d",
    "feature:water|element:geometry|color:0x0e1626",
    "feature:poi|element:geometry|color:0x283d6a",
  ]
    .map((s) => `style=${encodeURIComponent(s)}`)
    .join("&");
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=${size}&scale=2&maptype=roadmap&markers=color:0xF6A724%7C${lat},${lng}&${styles}&key=${encodeURIComponent(key)}`;
}
