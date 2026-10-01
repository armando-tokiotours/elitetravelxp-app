"use client";

/**
 * Absolute collage layer for Builder M Hotels / Transport widgets.
 * 1 image = cover · 2 = 50/50 split · 3 = large + two stacked (transport mix).
 */
export function DynamicWidgetBackground({
  images,
}: {
  images: string[];
}) {
  const urls = images.filter(Boolean).slice(0, 3);
  if (urls.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[22px]"
      aria-hidden
    >
      {urls.length === 1 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urls[0]}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : urls.length === 2 ? (
        <div className="flex h-full w-full gap-0.5 bg-black/50">
          {urls.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`bg-2-${i}-${src}`}
              src={src}
              alt=""
              className="h-full w-1/2 object-cover"
            />
          ))}
        </div>
      ) : (
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5 bg-black/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`bg-3-0-${urls[0]}`}
            src={urls[0]}
            alt=""
            className="col-span-1 row-span-2 h-full w-full object-cover"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`bg-3-1-${urls[1]}`}
            src={urls[1]}
            alt=""
            className="col-start-2 row-start-1 h-full w-full object-cover"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`bg-3-2-${urls[2]}`}
            src={urls[2]}
            alt=""
            className="col-start-2 row-start-2 h-full w-full object-cover"
          />
        </div>
      )}
      {/* Readability scrim — under text/icons (z-10), over photos */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A1017] via-[#0A1017]/80 to-[#0A1017]/30" />
    </div>
  );
}

/** Branded collage art for Hotels / Transport arrangement modes. */
export const HOTEL_ARRANGE_IMAGES = {
  self: "/brand/widgets/hotel-self.jpg",
  tokiotours: "/brand/widgets/hotel-tokiotours.jpg",
} as const;

export const TRANSPORT_ARRANGE_IMAGES = {
  /** Self / walk — red panda hiker plate */
  self: "/brand/widgets/transport-self.jpg",
  /** Public / Suica — Metro doors plate */
  public: "/brand/widgets/transport-public.jpg",
  /** Private chauffeur — vanity van plate */
  private: "/brand/widgets/transport-private.jpg",
} as const;

export type HotelArrangeKind = keyof typeof HOTEL_ARRANGE_IMAGES;
export type TransportArrangeKind = keyof typeof TRANSPORT_ARRANGE_IMAGES;

export function hotelArrangeImageUrls(
  kinds: Iterable<HotelArrangeKind>
): string[] {
  const order: HotelArrangeKind[] = ["tokiotours", "self"];
  const set = new Set(kinds);
  return order.filter((k) => set.has(k)).map((k) => HOTEL_ARRANGE_IMAGES[k]);
}

export function transportArrangeImageUrls(
  kinds: Iterable<TransportArrangeKind>
): string[] {
  const order: TransportArrangeKind[] = ["private", "public", "self"];
  const set = new Set(kinds);
  return order.filter((k) => set.has(k)).map((k) => TRANSPORT_ARRANGE_IMAGES[k]);
}
