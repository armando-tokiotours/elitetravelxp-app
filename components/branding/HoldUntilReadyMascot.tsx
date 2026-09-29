"use client";

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
 */
export function HoldUntilReadyMascot({
  pose,
  poses,
  className = "",
  imgClassName = "",
}: Props) {
  const ids = Object.keys(poses);
  const [display, setDisplay] = useState(pose);
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
      {ids.map((id) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={id}
          src={poses[id]}
          alt=""
          aria-hidden
          draggable={false}
          onLoad={() => markLoaded(id)}
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0) markLoaded(id);
          }}
          className={`${imgClassName} transition-opacity duration-500 ease-in-out ${
            id === display
              ? "relative opacity-100"
              : "pointer-events-none absolute inset-0 opacity-0"
          }`}
        />
      ))}
    </span>
  );
}
