"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Props = {
  /** Active pose id — previous stays visible until this src is loaded. */
  pose: string;
  poses: Record<string, string>;
  className?: string;
  imgClassName?: string;
};

/**
 * Stacked mascot poses — never remount/blink.
 * Keeps showing the last ready pose until the wanted one has loaded.
 * Active/local poses use next/image; priority on the first paint pose.
 */
export function HoldUntilReadyMascot({
  pose,
  poses,
  className = "",
  imgClassName = "",
}: Props) {
  const ids = Object.keys(poses);
  const [display, setDisplay] = useState(pose);
  const [priorityPose] = useState(pose);
  const wantedRef = useRef(pose);
  const displayRef = useRef(pose);
  const loadedRef = useRef<Set<string>>(new Set());

  const markLoaded = (id: string) => {
    loadedRef.current.add(id);
    if (wantedRef.current === id && displayRef.current !== id) {
      displayRef.current = id;
      setDisplay(id);
    }
  };

  useEffect(() => {
    wantedRef.current = pose;
    if (loadedRef.current.has(pose)) {
      displayRef.current = pose;
      setDisplay(pose);
    }
  }, [pose]);

  return (
    <span className={`relative inline-block ${className}`}>
      {ids.map((id) => {
        const active = id === display;
        const src = poses[id];
        const isLocal = src.startsWith("/") && !src.startsWith("//");
        return (
          <span
            key={id}
            className={`${imgClassName} transition-opacity duration-500 ease-in-out ${
              active
                ? "relative z-[1]"
                : "pointer-events-none absolute inset-0 z-0"
            }`}
            style={{ opacity: active ? 1 : 0 }}
          >
            {isLocal ? (
              <Image
                src={src}
                alt=""
                width={220}
                height={280}
                priority={id === priorityPose}
                sizes="(max-width: 640px) 7rem, 11rem"
                aria-hidden
                draggable={false}
                onLoad={() => markLoaded(id)}
                className="h-full w-auto object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                aria-hidden
                draggable={false}
                width={220}
                height={280}
                onLoad={() => markLoaded(id)}
                className="h-full w-auto object-contain"
              />
            )}
          </span>
        );
      })}
    </span>
  );
}
