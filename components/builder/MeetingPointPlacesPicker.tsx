"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import {
  geoapifyAutocomplete,
  geoapifySearch,
  type GeoapifyPlace,
} from "@/lib/geoapify";

/** Leaflet must never load during SSR (`window is not defined`). */
const GeoapifyDarkMatterMap = dynamic(
  () =>
    import("@/components/builder/GeoapifyDarkMatterMap").then((m) => ({
      default: m.GeoapifyDarkMatterMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#0D1117] text-xs text-white/35">
        Loading map…
      </div>
    ),
  }
);

const TOKYO_FALLBACK = { lat: 35.681236, lng: 139.767125 };

function makeCustomPlace(
  text: string,
  fallbackLat?: number | null,
  fallbackLng?: number | null
): GeoapifyPlace {
  const name = text.trim();
  const lat =
    fallbackLat != null && Number.isFinite(fallbackLat)
      ? fallbackLat
      : TOKYO_FALLBACK.lat;
  const lng =
    fallbackLng != null && Number.isFinite(fallbackLng)
      ? fallbackLng
      : TOKYO_FALLBACK.lng;
  return {
    name,
    address: name,
    city: "",
    lat,
    lng,
    placeId: `custom:${name.toLowerCase().replace(/\s+/g, "-").slice(0, 64)}`,
  };
}

/**
 * Geoapify JP autocomplete + dark-matter map for Builder S meeting point.
 * If search finds nothing, guests can still save the typed text as a custom point.
 */
export function MeetingPointPlacesPicker({
  initialName,
  initialAddress,
  lat,
  lng,
  fallbackLat,
  fallbackLng,
  onResolved,
}: {
  initialName?: string;
  initialAddress?: string;
  lat: number | null;
  lng: number | null;
  /** City center used when saving a custom (ungoodcoded) meeting point */
  fallbackLat?: number | null;
  fallbackLng?: number | null;
  onResolved: (place: GeoapifyPlace | null) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState(initialName || initialAddress || "");
  const [suggestions, setSuggestions] = useState<GeoapifyPlace[]>([]);
  const [openList, setOpenList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [selected, setSelected] = useState<GeoapifyPlace | null>(
    lat != null && lng != null
      ? {
          name: initialName || initialAddress || "",
          address: initialAddress || initialName || "",
          city: "",
          lat,
          lng,
          placeId: "",
        }
      : null
  );
  const skipNextFetch = useRef(false);

  useEffect(() => {
    setQuery(initialName || initialAddress || "");
  }, [initialName, initialAddress]);

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const text = query.trim();
    if (text.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void geoapifyAutocomplete(text, ctrl.signal)
        .then((rows) => {
          setSuggestions(rows);
          setOpenList(true);
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return;
          setSuggestions([]);
          setError(err instanceof Error ? err.message : "Search failed");
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, 280);

    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  const pick = (place: GeoapifyPlace) => {
    skipNextFetch.current = true;
    setSelected(place);
    setQuery(place.name);
    setSuggestions([]);
    setOpenList(false);
    setError("");
    setHint("");
    onResolved(place);
  };

  const saveCustomTyped = (text: string) => {
    const place = makeCustomPlace(
      text,
      selected?.lat ?? lat ?? fallbackLat,
      selected?.lng ?? lng ?? fallbackLng
    );
    skipNextFetch.current = true;
    setSelected(place);
    setQuery(place.name);
    setSuggestions([]);
    setOpenList(false);
    setError("");
    setHint(
      "Saved as custom meeting point — guide will use this text (pin is approximate)."
    );
    onResolved(place);
  };

  const resolveTypedAddress = async () => {
    const text = query.trim();
    if (!text) {
      setSelected(null);
      setHint("");
      onResolved(null);
      return;
    }
    if (
      selected &&
      (selected.name === text || selected.address === text)
    ) {
      onResolved(selected);
      return;
    }
    setLoading(true);
    setError("");
    setHint("");
    try {
      const place = await geoapifySearch(text);
      if (place) {
        skipNextFetch.current = true;
        setSelected(place);
        setQuery(place.name);
        setOpenList(false);
        onResolved(place);
        return;
      }
      // No Geoapify match (or no API key) — still allow typed save
      saveCustomTyped(text);
    } catch (err) {
      // Network / key errors: still allow typed custom save
      saveCustomTyped(text);
      setError(
        err instanceof Error
          ? `${err.message} — saved typed text instead.`
          : "Search failed — saved typed text instead."
      );
    } finally {
      setLoading(false);
    }
  };

  const mapLat = selected?.lat ?? lat ?? fallbackLat ?? null;
  const mapLng = selected?.lng ?? lng ?? fallbackLng ?? null;
  const showUseTyped =
    query.trim().length >= 2 &&
    !loading &&
    suggestions.length === 0 &&
    !(
      selected &&
      (selected.name === query.trim() || selected.address === query.trim())
    );

  return (
    <div className="relative w-full">
      <div className="relative z-20 mb-6 w-full">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white">
          Search hotel / station / landmark
        </p>
        <input
          type="text"
          value={query}
          role="combobox"
          aria-expanded={openList && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpenList(true);
            setHint("");
          }}
          onFocus={() => {
            if (suggestions.length) setOpenList(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setOpenList(false), 160);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void resolveTypedAddress();
            }
          }}
          placeholder="e.g. Park Hyatt Tokyo or Kyoto Station"
          className="w-full rounded-xl border border-white/15 bg-[#121212] px-3 py-3 text-base text-white placeholder:text-white/30"
          autoComplete="off"
        />

        {openList && suggestions.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute top-full right-0 left-0 z-50 mt-2 max-h-60 overflow-y-auto rounded-xl border border-white/20 bg-[#0A1017]/95 py-1 shadow-2xl backdrop-blur-md"
          >
            {suggestions.map((s) => (
              <li key={s.placeId || `${s.lat}-${s.lng}-${s.name}`}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition hover:bg-white/10"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                >
                  <span className="text-sm font-semibold text-white">
                    {s.name}
                  </span>
                  <span className="line-clamp-1 font-mono text-[10px] text-white/45">
                    {[s.city, s.address].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1 text-xs text-white/40">
            {loading
              ? "Searching Japan…"
              : error
                ? error
                : hint
                  ? hint
                  : "Japan only · pick a suggestion, or type any hotel name and save"}
          </p>
          <div className="flex shrink-0 gap-1.5">
            {showUseTyped ? (
              <button
                type="button"
                onClick={() => saveCustomTyped(query)}
                className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-cyan-300 uppercase hover:bg-cyan-500/20"
              >
                Use typed text
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void resolveTypedAddress()}
              className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white/70 uppercase hover:border-white/30"
            >
              Resolve
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-0 mt-3 h-64 w-full overflow-hidden rounded-xl border border-white/10">
        <GeoapifyDarkMatterMap
          lat={mapLat}
          lng={mapLng}
          className="h-full w-full rounded-none border-0"
        />
      </div>
    </div>
  );
}
