"use client";

import { useEffect, type RefObject } from "react";

/**
 * Glides one pill between the items of a container.
 *
 * The container must be `position: relative` and must contain exactly one
 * `[data-indicator]` child, which `IndicatorPill` provides. Nothing is measured
 * from CSS: the pill is positioned from the active item's own box, so it fits
 * whatever the item happens to be at that viewport.
 *
 * Put `data-hover-preview` on the container and the pill also follows the
 * pointer or keyboard focus, snapping back to the active item on the way out.
 *
 * `deps` is spread into the effect, so pass whatever changes the active item:
 * the current section, the open state of a panel, the route.
 */
export function useSlidingIndicator(
  containerRef: RefObject<HTMLElement | null>,
  activeSelector: string,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const pill = container.querySelector<HTMLElement>("[data-indicator]");
    if (!pill) return;

    const preview = container.hasAttribute("data-hover-preview");
    let held: HTMLElement | null = null;
    let frame = 0;

    function place() {
      frame = 0;
      if (!container || !pill) return;
      const target =
        (preview ? held : null) ??
        container.querySelector<HTMLElement>(activeSelector);
      if (!target || target.offsetParent === null) {
        pill.style.opacity = "0";
        return;
      }
      const box = container.getBoundingClientRect();
      const item = target.getBoundingClientRect();
      if (item.width === 0 && item.height === 0) {
        pill.style.opacity = "0";
        return;
      }
      pill.style.width = `${item.width}px`;
      pill.style.height = `${item.height}px`;
      pill.style.transform = `translate3d(${item.left - box.left}px, ${
        item.top - box.top
      }px, 0)`;
      pill.style.opacity = "1";
      // The first placement is silent; every later one animates.
      pill.setAttribute("data-placed", "");
    }

    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(place);
    }

    place();

    const resize = new ResizeObserver(schedule);
    resize.observe(container);
    for (const child of Array.from(container.children)) resize.observe(child);
    window.addEventListener("resize", schedule, { passive: true });

    // Web fonts land after the first measurement and change every item's width.
    document.fonts?.ready.then(schedule).catch(() => {});

    /** Any focusable item in the container is previewable, active or not. */
    function hold(event: Event) {
      const target = event.target as Element | null;
      const item = target?.closest?.("a, button, [role='tab']");
      held =
        item instanceof HTMLElement && container?.contains(item) ? item : null;
      schedule();
    }
    function release() {
      held = null;
      schedule();
    }

    if (preview) {
      container.addEventListener("pointerover", hold);
      container.addEventListener("pointerleave", release);
      container.addEventListener("focusin", hold);
      container.addEventListener("focusout", release);
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("resize", schedule);
      if (preview) {
        container.removeEventListener("pointerover", hold);
        container.removeEventListener("pointerleave", release);
        container.removeEventListener("focusin", hold);
        container.removeEventListener("focusout", release);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, activeSelector, ...deps]);
}

/** The pill itself. Decorative: the state it reports is already on the item. */
export function IndicatorPill({
  className,
  line = false,
}: {
  className?: string;
  line?: boolean;
}) {
  const classes = [
    "indicator-pill",
    line ? "indicator-line" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={classes} data-indicator="" aria-hidden="true" />;
}
