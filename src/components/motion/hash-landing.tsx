"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { jumpToAnchor } from "@/components/motion/anchor-scroll";

/**
 * Lands an arrival from another route on its hash target, instantly.
 *
 * Smooth scrolling is for a click on a section of the page you are already
 * reading. Arriving at `/#underwriting` from the documentation is not that: the
 * target can be five thousand pixels down a page the reader has never seen, and
 * animating that distance drags the viewport through every section in between,
 * waking a WebGL canvas and a pinned timeline on the way. On a machine without
 * a GPU that is seconds of blocked main thread, and the scroll can fail to
 * settle at all. So a cross-route arrival jumps.
 *
 * The landing is re-asserted a few times rather than done once. Fonts swap,
 * reveals unblur and charts measure themselves, and every one of those moves
 * the target after it has been scrolled to. Each pass is another jump to the
 * same element, which also cancels any smooth scroll the router may have
 * started before this effect ran.
 *
 * It stops the moment the reader does anything: a wheel, a touch, a key or a
 * pointer press ends the landing, because from then on the scroll position is
 * theirs and nothing here may take it back.
 *
 * Mount once, in the root layout.
 */

/** Re-assert points after the route commits: layout, fonts, then reveals. */
const CHECKS = [60, 200, 500];

/** Anything the reader does that means the scroll position is now theirs. */
const INTERRUPTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

export function HashLanding() {
  const pathname = usePathname();

  useEffect(() => {
    const raw = window.location.hash.slice(1);
    if (!raw) return;

    let id: string;
    try {
      id = decodeURIComponent(raw);
    } catch {
      id = raw;
    }

    // Held for the whole landing window, so a scroll started by the router
    // rather than by this effect is instant as well.
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";

    let done = false;
    let frame = 0;
    const timers: number[] = [];

    function land() {
      if (done) return;
      const target = document.getElementById(id);
      if (target) jumpToAnchor(target);
    }

    function finish() {
      if (done) return;
      done = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      for (const timer of timers) window.clearTimeout(timer);
      timers.length = 0;
      html.style.scrollBehavior = previous;
      for (const type of INTERRUPTS) window.removeEventListener(type, finish);
    }

    for (const type of INTERRUPTS)
      window.addEventListener(type, finish, { passive: true, once: true });

    // The DOM for the new route is committed by the time an effect runs, but
    // its first layout is not, so the first landing waits a frame.
    frame = requestAnimationFrame(() => {
      frame = 0;
      land();
    });
    for (const delay of CHECKS) timers.push(window.setTimeout(land, delay));
    timers.push(window.setTimeout(finish, CHECKS[CHECKS.length - 1] + 40));
    document.fonts?.ready.then(land).catch(() => {});

    return finish;
  }, [pathname]);

  return null;
}
