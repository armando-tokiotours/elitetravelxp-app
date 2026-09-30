"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { geoapifyDarkMatterTileUrl } from "@/lib/geoapify";
import "leaflet/dist/leaflet.css";

const PIN_HTML = `<div style="width:18px;height:18px;border-radius:9999px;background:#F6A724;border:2px solid #fff;box-shadow:0 0 12px rgba(246,167,36,0.7)"></div>`;

/**
 * Interactive Leaflet map using Geoapify Dark-Matter tiles.
 */
export function GeoapifyMeetingMap({
  lat,
  lng,
  className = "h-56 w-full rounded-2xl border border-white/10",
}: {
  lat: number;
  lng: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer(geoapifyDarkMatterTileUrl(), {
      attribution:
        'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a>',
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const icon = L.divIcon({
      className: "",
      html: PIN_HTML,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    mapRef.current = map;

    // Leaflet needs a layout pass inside animated modals
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; move updates below
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true });
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const icon = L.divIcon({
        className: "",
        html: PIN_HTML,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    }
    requestAnimationFrame(() => map.invalidateSize());
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className={`${className} z-0 overflow-hidden bg-[#0A1017]`}
      aria-label="Meeting point map"
    />
  );
}
