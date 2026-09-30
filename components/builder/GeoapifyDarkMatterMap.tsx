"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geoapifyDarkMatterTileUrl } from "@/lib/geoapify";

const DEFAULT_CENTER: [number, number] = [35.681236, 139.767125];

/**
 * Leaflet + Geoapify Dark-Matter tiles.
 * Only loaded via `next/dynamic(..., { ssr: false })` so Leaflet never runs on the server.
 */
export function GeoapifyDarkMatterMap({
  lat,
  lng,
  className = "h-56 w-full rounded-2xl",
}: {
  lat: number | null;
  lng: number | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer(geoapifyDarkMatterTileUrl(), {
      attribution:
        'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a>',
      maxZoom: 20,
    }).addTo(map);

    const icon = L.divIcon({
      className: "",
      html: `<div style="width:18px;height:18px;border-radius:9999px;background:#F6A724;border:2px solid #fff;box-shadow:0 0 12px rgba(246,167,36,0.7)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    markerRef.current = L.marker(DEFAULT_CENTER, { icon }).addTo(map);
    markerRef.current.setOpacity(0);
    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    if (
      lat == null ||
      lng == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      marker.setOpacity(0);
      return;
    }
    const pos: [number, number] = [lat, lng];
    map.setView(pos, 15, { animate: true });
    marker.setLatLng(pos);
    marker.setOpacity(1);
    requestAnimationFrame(() => map.invalidateSize());
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className={`isolate overflow-hidden bg-[#0D1117] [&_.leaflet-control-zoom]:!m-3 [&_.leaflet-bottom]:!z-[5] [&_.leaflet-top]:!z-[5] ${className}`}
      aria-label="Meeting point map"
    />
  );
}
