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

/** Resolved meeting point — custom entry may omit map coords. */
export type MeetingPointResolved = {
  name: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  placeId: string;
};

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

function toResolved(place: GeoapifyPlace): MeetingPointResolved {
  return {
    name: place.name,
    address: place.address,
    city: place.city,
    lat: place.lat,
    lng: place.lng,
    placeId: place.placeId,
  };
}

function makeFreeformResolved(text: string): MeetingPointResolved {
  const name = text.trim();
  return {
    name,
    address: name,
    city: "",
    lat: null,
    lng: null,
    placeId: `custom:${name.toLowerCase().replace(/\s+/g, "-").slice(0, 64)}`,
  };
}

/**
 * Geoapify JP autocomplete + dark-matter map for Builder S meeting point.
 * Guests can toggle to a freeform custom location (no map pin).
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
  /** City center used when saving a custom (ungeocoded) meeting point via map-mode typed save */
  fallbackLat?: number | null;
  fallbackLng?: number | null;
  onResolved: (place: MeetingPointResolved | null) => void;
}) {
  const listId = useId();
  const hasInitialCoords =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  const initialText = (initialName || initialAddress || "").trim();

  const [isCustomEntry, setIsCustomEntry] = useState(
    () => Boolean(initialText) && !hasInitialCoords
  );
  const [customText, setCustomText] = useState(() =>
    Boolean(initialText) && !hasInitialCoords ? initialText : ""
  );
  const [query, setQuery] = useState(
    hasInitialCoords ? initialName || initialAddress || "" : ""
  );
  const [suggestions, setSuggestions] = useState<GeoapifyPlace[]>([]);
  const [openList, setOpenList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [selected, setSelected] = useState<GeoapifyPlace | null>(
    hasInitialCoords
      ? {
          name: initialName || initialAddress || "",
          address: initialAddress || initialName || "",
          city: "",
          lat: lat as number,
          lng: lng as number,
          placeId: "",
        }
      : null
  );
  const skipNextFetch = useRef(false);

  useEffect(() => {
    if (isCustomEntry) return;
    setQuery(initialName || initialAddress || "");
  }, [initialName, initialAddress, isCustomEntry]);

  useEffect(() => {
    if (isCustomEntry) return;
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
  }, [query, isCustomEntry]);

  const pick = (place: GeoapifyPlace) => {
    skipNextFetch.current = true;
    setSelected(place);
    setQuery(place.name);
    setSuggestions([]);
    setOpenList(false);
    setError("");
    setHint("");
    onResolved(toResolved(place));
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
    onResolved(toResolved(place));
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
      onResolved(toResolved(selected));
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
        onResolved(toResolved(place));
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

  const emitCustomText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      onResolved(null);
      return;
    }
    onResolved(makeFreeformResolved(trimmed));
  };

  const switchToCustomEntry = () => {
    const seed = (query.trim() || customText || initialText).trim();
    setIsCustomEntry(true);
    setCustomText(seed);
    setSelected(null);
    setSuggestions([]);
    setOpenList(false);
    setError("");
    setHint("");
    setQuery("");
    emitCustomText(seed);
  };

  const switchToMapSearch = () => {
    setIsCustomEntry(false);
    setCustomText("");
    setSelected(null);
    setSuggestions([]);
    setOpenList(false);
    setError("");
    setHint("");
    setQuery("");
    onResolved(null);
  };

  const resolvedMapLat = selected?.lat ?? lat ?? fallbackLat ?? null;
  const resolvedMapLng = selected?.lng ?? lng ?? fallbackLng ?? null;
  const showUseTyped =
    !isCustomEntry &&
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
        {isCustomEntry ? (
          <>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#0A1017]">
              Custom meeting location
            </p>
            <textarea
              value={customText}
              onChange={(e) => {
                const next = e.target.value;
                setCustomText(next);
                emitCustomText(next);
              }}
              rows={4}
              placeholder="Hotel name, Airbnb link, address, or meeting instructions…"
              className="w-full resize-y rounded-xl border border-white/15 bg-[#121212] px-3 py-3 text-base text-white placeholder:text-white/30"
            />
            <p className="mt-2 text-xs text-[#64748b]">
              No map pin — guide will follow this text exactly.
            </p>
          </>
        ) : (
          <>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#0A1017]">
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
              <p className="min-w-0 flex-1 text-xs text-[#64748b]">
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
                    className="rounded-full border border-[#054F70]/40 bg-[#054F70]/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#054F70] uppercase hover:bg-[#054F70]/15"
                  >
                    Use typed text
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void resolveTypedAddress()}
                  className="rounded-full border border-black/15 px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#475569] uppercase hover:border-black/30 hover:text-[#0A1017]"
                >
                  Resolve
                </button>
              </div>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() =>
            isCustomEntry ? switchToMapSearch() : switchToCustomEntry()
          }
          className="mt-3 text-[11px] text-[#0080A3] hover:text-[#006B88] font-bold uppercase tracking-wider underline cursor-pointer transition-all"
        >
          {isCustomEntry
            ? "← Switch back to Map Search"
            : "Can't find place? Write custom location manually"}
        </button>
      </div>

      {!isCustomEntry ? (
        <div className="relative z-0 mt-3 h-64 w-full overflow-hidden rounded-xl border border-white/10">
          <GeoapifyDarkMatterMap
            lat={resolvedMapLat}
            lng={resolvedMapLng}
            className="h-full w-full rounded-none border-0"
          />
        </div>
      ) : null}
    </div>
  );
}
