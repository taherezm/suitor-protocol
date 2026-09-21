"use client";

import { useEffect, useState } from "react";

/**
 * Reports which of `ids` currently owns the top of the viewport, or `null` when
 * the reader is still above the first of them.
 *
 * A scroll handler rather than an IntersectionObserver, because the question is
 * not "is this on screen" but "which one is the reader in", and sections here
 * are taller than the viewport. It is passive and coalesced into one rAF per
 * frame, so it costs a handful of `getBoundingClientRect` calls per frame at
 * most and nothing at all while the page is still.
 *
 * `offset` is the line the section has to cross, measured from the top of the
 * viewport; pass the height of anything fixed over the page.
 */
export function useScrollSpy(ids: string[], offset = 0): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("|");

  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (list.length === 0) return;

    let frame = 0;

    function measure() {
      frame = 0;
      const line = offset + 1;
      let current: string | null = null;
      for (const id of list) {
        const element = document.getElementById(id);
        if (!element) continue;
        const box = element.getBoundingClientRect();
        if (box.top <= line && box.bottom > line) current = id;
      }
      // Sections do not tile the page: between two of them, keep the one just
      // passed rather than blinking off.
      if (!current) {
        for (const id of list) {
          const element = document.getElementById(id);
          if (element && element.getBoundingClientRect().top <= line)
            current = id;
        }
      }
      // The last section can be shorter than the space below it, so the foot of
      // the document always belongs to it.
      const root = document.documentElement;
      if (window.innerHeight + window.scrollY >= root.scrollHeight - 2)
        current = list.at(-1) ?? current;
      setActive((previous) => (previous === current ? previous : current));
    }

    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [key, offset]);

  return active;
}
