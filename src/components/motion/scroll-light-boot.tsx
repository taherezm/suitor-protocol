"use client";

import { useEffect } from "react";

/**
 * Drives every `[data-scroll-light]` block on the page from one passive scroll
 * listener and one rAF.
 *
 * All it ever writes is a single custom property, `--p`, on the block itself.
 * The per word colour is resolved from there in CSS (`motion.css`, `.sl-w`), so
 * a paragraph of thirty words costs one style write per frame rather than
 * thirty, and only while that paragraph is near the viewport.
 *
 * Progress is 0 while the block's top edge is at 88% of the viewport height and
 * 1 once it has reached 42%, which is the reading line: the lead sentence has
 * finished lighting by the time the block is comfortably on screen and the
 * continuation follows it.
 *
 * Nothing here is required for the text to be readable. `--p` defaults to 1,
 * so without JavaScript, before this mounts, and whenever the reader has asked
 * for reduced motion, every word is already fully lit.
 *
 * Mount once, in the root layout.
 */

/**
 * Every lit block except the ones that drive themselves. A block marked
 * `data-scroll-light-manual` resolves `--p` from something other than its
 * position in the viewport (the pool terminal's caption reads it from its tab's
 * slice of the pinned scroll), and an inline write from here would beat the
 * stylesheet rule that does it.
 */
const SELECTOR = "[data-scroll-light]:not([data-scroll-light-manual])";

/** Viewport fractions the block's top edge travels between. */
const START = 0.88;
const END = 0.42;

/** Blocks are only driven while they are within this much of the viewport. */
const NEAR = "30% 0px 30% 0px";

export function ScrollLightBoot() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    /** Everything observed, so it can be unobserved and cleared on teardown. */
    const known = new Set<HTMLElement>();
    /** The blocks close enough to the viewport to be worth measuring. */
    const active = new Set<HTMLElement>();
    /** The last value written, so an unchanged frame costs no style write. */
    const written = new WeakMap<HTMLElement, number>();

    let frame = 0;

    function clear(element: HTMLElement) {
      written.delete(element);
      element.style.removeProperty("--p");
    }

    function read(element: HTMLElement) {
      const height = window.innerHeight || 1;
      const start = height * START;
      const span = height * (START - END) || 1;
      const top = element.getBoundingClientRect().top;
      const progress = Math.min(1, Math.max(0, (start - top) / span));
      // Two hundred steps is finer than a word on any block on this site, and
      // it keeps a slow scroll from writing a new value every single frame.
      const snapped = Math.round(progress * 200) / 200;
      if (written.get(element) === snapped) return;
      written.set(element, snapped);
      element.style.setProperty("--p", String(snapped));
    }

    function measure() {
      frame = 0;
      if (reduced.matches) return;
      for (const element of active) {
        if (!element.isConnected) {
          active.delete(element);
          known.delete(element);
          continue;
        }
        read(element);
      }
    }

    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    }

    const near =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                const element = entry.target as HTMLElement;
                if (entry.isIntersecting) active.add(element);
                else active.delete(element);
              }
              schedule();
            },
            { rootMargin: NEAR },
          );

    /**
     * Adopts blocks that have appeared since the last pass.
     *
     * A new block is measured on the spot rather than on the next frame: a
     * panel that swaps under the reader (the terminal changing view) would
     * otherwise paint one frame fully lit before the first measurement dimmed
     * it again.
     */
    function scan() {
      if (reduced.matches) return;
      for (const node of Array.from(
        document.querySelectorAll<HTMLElement>(SELECTOR),
      )) {
        if (known.has(node)) continue;
        known.add(node);
        active.add(node);
        read(node);
        near?.observe(node);
      }
      for (const node of Array.from(known)) {
        if (node.isConnected) continue;
        known.delete(node);
        active.delete(node);
        near?.unobserve(node);
      }
    }

    // Mutations are rare here (a tab swap, a route change), so a scan per batch
    // is cheaper than any bookkeeping that would avoid it.
    const changes = new MutationObserver(() => scan());

    function stop() {
      for (const element of known) clear(element);
      active.clear();
    }

    /** The reader changed their motion preference while the page was open. */
    function apply() {
      if (reduced.matches) {
        stop();
        return;
      }
      // Everything known goes back in the active set for one pass. The
      // intersection observer prunes whatever is nowhere near the viewport on
      // its next callback, and until then nothing is stranded fully lit
      // waiting for a scroll that may never come.
      for (const element of known) active.add(element);
      scan();
      schedule();
    }

    scan();
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    reduced.addEventListener("change", apply);
    changes.observe(document.body, { childList: true, subtree: true });
    // Web fonts land after the first measurement and move every block on the page.
    document.fonts?.ready.then(schedule).catch(() => {});

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", apply);
      changes.disconnect();
      near?.disconnect();
      stop();
      known.clear();
    };
  }, []);

  return null;
}
