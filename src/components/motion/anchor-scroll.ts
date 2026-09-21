"use client";

import type { MouseEvent } from "react";

/**
 * How far a smooth scroll is allowed to travel, in viewport heights.
 *
 * Past this the reader is not being taken somewhere, they are being dragged
 * through everything in between: four sections of charts, a pinned timeline and
 * two WebGL canvases, all of which wake up as they pass through the viewport.
 * Long jumps are cut to the last viewport instead, which looks the same at the
 * destination and costs nothing on the way.
 */
const MAX_TRAVEL = 2.5;

/** Runs `scroll` with the document's smooth scrolling switched off.
 *
 * An inline style beats the stylesheet, and a scroll with `behavior: "auto"`
 * resolves against the computed `scroll-behavior`, so this is what makes a
 * jump a jump. Auto scrolls complete synchronously, so the previous value can
 * be put back the moment the call returns.
 */
export function withoutSmoothScroll(scroll: () => void): void {
  const html = document.documentElement;
  const previous = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  try {
    scroll();
  } finally {
    html.style.scrollBehavior = previous;
  }
}

/**
 * Puts an element where a click on its anchor would, with no animation at all.
 *
 * The offset under the fixed bar comes from `scroll-margin-top` on the target
 * and `scroll-padding-top` on `<html>`, so nothing here needs to know how tall
 * the bar is.
 */
export function jumpToAnchor(target: Element): void {
  withoutSmoothScroll(() =>
    target.scrollIntoView({ behavior: "auto", block: "start" }),
  );
}

/**
 * Scrolls to an in-page target instead of jumping to it, and writes the hash
 * into the address bar without handing the navigation to the router.
 *
 * The router is deliberately bypassed: Next scrolls a hash target by disabling
 * `scroll-behavior` for the duration, which is exactly the snap this site is
 * trying not to do. `history.pushState` is patched by the App Router, so the
 * back button still works and `usePathname` stays correct.
 *
 * A long journey is cut short first. Anything further than `MAX_TRAVEL`
 * viewports away is jumped to within one viewport of the target and then
 * smooth-scrolled the rest of the way, so the gesture still reads as travel
 * while the sections in between are never dragged through the viewport.
 *
 * Returns false when it did nothing, so the caller can let the link navigate.
 */
export function scrollToAnchor(
  event: MouseEvent<HTMLAnchorElement>,
  id: string,
): boolean {
  if (event.defaultPrevented) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return false;
  if (event.button !== 0) return false;

  const target = document.getElementById(id);
  if (!target) return false;

  const href = event.currentTarget.getAttribute("href");
  event.preventDefault();

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    jumpToAnchor(target);
  } else {
    const viewport = window.innerHeight || 1;
    const distance = target.getBoundingClientRect().top;
    if (Math.abs(distance) > viewport * MAX_TRAVEL) {
      // One viewport short of the target, on whichever side the reader is.
      const approach =
        window.scrollY + distance - Math.sign(distance) * viewport;
      withoutSmoothScroll(() =>
        window.scrollTo({ top: Math.max(0, approach), behavior: "auto" }),
      );
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (href) {
    try {
      window.history.pushState(null, "", href);
    } catch {
      // A blocked history write is not worth failing the scroll over.
    }
  }
  return true;
}

/** The id an in-page href points at, or null if it points somewhere else. */
export function anchorId(href: string): string | null {
  const hash = href.indexOf("#");
  if (hash === -1) return null;
  const before = href.slice(0, hash);
  if (before !== "" && before !== "/") return null;
  return href.slice(hash + 1) || null;
}
