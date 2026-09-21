"use client";

import { useEffect, useRef } from "react";

/**
 * Counts a figure up once, the first time it is seen.
 *
 * The finished number is what renders on the server, what a reader without
 * JavaScript gets, and what is left behind when the animation ends, so the text
 * on the page is never a number the data does not support. Under reduced motion
 * the count never starts.
 *
 * The animation writes straight into the text node rather than through state:
 * a page of figures would otherwise re-render sixty times a second between
 * them, and the final value is identical to the one React already committed.
 *
 * `format` must be stable across renders (define it at module scope), because
 * changing it restarts the count.
 */
export function CountUp({
  value,
  format,
  duration = 900,
  className,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!document.documentElement.classList.contains("motion-ready")) return;
    if (typeof IntersectionObserver === "undefined") return;

    let frame = 0;
    let started = 0;

    function step(now: number) {
      if (!element) return;
      if (!started) started = now;
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = format(value * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
      else element.textContent = format(value);
    }

    const watcher = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        watcher.disconnect();
        element.textContent = format(0);
        frame = requestAnimationFrame(step);
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    watcher.observe(element);

    return () => {
      watcher.disconnect();
      if (frame) cancelAnimationFrame(frame);
      // Whatever interrupted the count, the true value is what stays on screen.
      element.textContent = format(value);
    };
  }, [value, format, duration]);

  return (
    <span
      ref={ref}
      className={className ? `tnum ${className}` : "tnum"}
      suppressHydrationWarning
    >
      {format(value)}
    </span>
  );
}
