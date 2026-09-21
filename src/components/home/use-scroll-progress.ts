"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/**
 * Scroll progress of a tall track through the viewport, for a pinned section.
 *
 * Three values come back. `progress` is 0..1, quantised to `steps` so React
 * only re-renders when the number a reader can actually see has changed.
 * `pinned` says whether the pinned presentation is allowed at all: it needs
 * room to stand in, and it needs a reader who has not asked for less motion.
 * `segment` is which of `segments` equal slices of the track the reader is in,
 * or -1 when the section is not pinned.
 *
 * The unquantised value never reaches React. It is written straight onto
 * `hostRef` as a custom property, so a scroll frame costs one style write and
 * the crossfades, the scrubber and the chart clip are all driven by CSS from
 * there. Nothing is animated in JavaScript.
 *
 * `data-pinned` is written on the same element rather than rendered from state,
 * which is what keeps the section honest: without JavaScript the attribute is
 * never set, the stylesheet's unpinned rules stand, and every phase, the figure
 * and the chart are simply visible in normal flow.
 */

/**
 * Pinning needs width for two columns wide enough that the chart can carry its
 * own end labels, and height for the whole stage to stand unclipped. Anything
 * narrower or shorter reads better as the list, so it gets the list.
 */
const PIN_QUERY = "(min-width: 1120px) and (min-height: 720px)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * How far past a boundary the reader has to travel before the segment flips,
 * as a fraction of the whole track. A reader resting on a boundary jitters by a
 * pixel or two, and without this the tab under them would chatter.
 */
const HYSTERESIS = 0.02;

export interface ScrollProgressOptions {
  /** The tall element whose passage through the viewport is measured. */
  trackRef: RefObject<HTMLElement | null>;
  /** Where `data-pinned` and the progress custom property are written. */
  hostRef: RefObject<HTMLElement | null>;
  /** Quantisation of the returned value. 60 gives one step per month. */
  steps?: number;
  /** The custom property that carries the unquantised value. */
  property?: string;
  /** The media query that decides whether there is room to pin at all. */
  query?: string;
  /** Slice the track into this many equal parts and report which one is live. */
  segments?: number;
  /** The custom property that carries the live segment index, for CSS. */
  segmentProperty?: string;
  /**
   * Holds `segment` where it is while true. The terminal sets it while the
   * reader is typing in the quote field, so the view cannot change under them.
   * The scroll itself is never blocked: only the handover is.
   */
  hold?: boolean;
}

export interface ScrollProgressState {
  progress: number;
  pinned: boolean;
  /** The live segment, or -1 when the section is not pinned. */
  segment: number;
  /**
   * Scrolls the page to the start of a segment. A no-op when the section is not
   * pinned, so a click on a tab is just a click on a tab.
   */
  scrollToSegment: (index: number) => void;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Which slice `value` falls in, refusing to leave `current` until the reader
 * has travelled `HYSTERESIS` past the boundary they just crossed.
 */
function segmentAt(value: number, current: number, count: number): number {
  const raw = Math.min(count - 1, Math.max(0, Math.floor(value * count)));
  if (raw === current || current < 0) return raw;
  if (raw > current && value < (current + 1) / count + HYSTERESIS)
    return current;
  if (raw < current && value > current / count - HYSTERESIS) return current;
  return raw;
}

export function useScrollProgress({
  trackRef,
  hostRef,
  steps = 60,
  property = "--tl-p",
  query = PIN_QUERY,
  segments = 0,
  segmentProperty = "--seg-i",
  hold = false,
}: ScrollProgressOptions): ScrollProgressState {
  const [pinned, setPinned] = useState(false);
  const [progress, setProgress] = useState(0);
  const [segment, setSegment] = useState(-1);
  const stepRef = useRef(0);
  const segmentRef = useRef(-1);

  /**
   * The segment a `scrollToSegment` is travelling to, or -1.
   *
   * A smooth scroll passes through every segment between here and there, so
   * without this a click on the last tab would walk the dock through all four
   * on the way. While a seek is live nothing but its own destination may
   * change the live segment, and it clears itself the moment the page arrives.
   */
  const seekRef = useRef(-1);
  const seekTimer = useRef(0);

  // Read through a ref, so changing it does not tear the listeners down and
  // rebuild them in the middle of a scroll.
  const holdRef = useRef(hold);
  holdRef.current = hold;

  // The decision is a media query, so it answers a resize and a change of
  // motion preference without the component knowing anything about either.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const room = window.matchMedia(query);
    const reduced = window.matchMedia(REDUCED_QUERY);
    const read = () => setPinned(room.matches && !reduced.matches);
    read();
    room.addEventListener("change", read);
    reduced.addEventListener("change", read);
    return () => {
      room.removeEventListener("change", read);
      reduced.removeEventListener("change", read);
    };
  }, [query]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (!pinned) {
      host.removeAttribute("data-pinned");
      host.style.removeProperty(property);
      if (segments > 0) host.style.removeProperty(segmentProperty);
      stepRef.current = 0;
      segmentRef.current = -1;
      setProgress(0);
      setSegment(-1);
      return;
    }

    let frame = 0;
    let last = -1;

    function measure() {
      frame = 0;
      const track = trackRef.current;
      if (!track || !host) return;
      const rect = track.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const value = span <= 0 ? 0 : clamp01(-rect.top / span);
      if (Math.abs(value - last) < 0.0005) return;
      last = value;
      host.style.setProperty(property, value.toFixed(4));
      const quantised = Math.round(value * steps);
      if (quantised !== stepRef.current) {
        stepRef.current = quantised;
        setProgress(quantised / steps);
      }
      if (segments <= 0 || holdRef.current) return;
      const next = segmentAt(value, segmentRef.current, segments);
      if (seekRef.current >= 0) {
        // Still travelling. Everything on the way there is passed over.
        if (next !== seekRef.current) return;
        seekRef.current = -1;
      }
      if (next !== segmentRef.current) {
        segmentRef.current = next;
        // Written for CSS as well as returned to React: the caption's own
        // scroll-light is resolved from the pair of them without a render.
        host.style.setProperty(segmentProperty, String(next));
        setSegment(next);
      }
    }

    function schedule() {
      // A hidden document cannot scroll, so there is nothing to catch up on.
      if (frame || document.hidden) return;
      frame = requestAnimationFrame(measure);
    }

    // The attribute and the first measurement land together, so the section is
    // never pinned for a frame with the unpinned value still on it.
    host.setAttribute("data-pinned", "");
    if (segments > 0) {
      segmentRef.current = -1;
      host.style.setProperty(segmentProperty, "0");
    }
    measure();

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
      host.removeAttribute("data-pinned");
      host.style.removeProperty(property);
      if (segments > 0) host.style.removeProperty(segmentProperty);
    };
  }, [pinned, trackRef, hostRef, steps, property, segments, segmentProperty]);

  /**
   * Puts the reader at the start of a segment, a hair inside it so the
   * hysteresis above cannot read the landing as the segment before it.
   *
   * The reader is moved, not the stage: the stage is sticky, so the page scroll
   * and the live segment are the same fact, and moving the reader is the only
   * thing that keeps the two from disagreeing after a click.
   *
   * The destination is adopted before the scroll starts rather than after it
   * arrives, so the panel answers the click at once and the four segments the
   * smooth scroll travels through on the way are passed over rather than
   * flicking the dock through all of them. The timer is the floor: a scroll
   * interrupted by the reader must still hand control back.
   */
  const scrollToSegment = useCallback(
    (index: number) => {
      const host = hostRef.current;
      const track = trackRef.current;
      if (!pinned || !host || !track || segments <= 0) return;
      const rect = track.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      if (span <= 0) return;

      const target = clamp01((index + 0.02) / segments);
      const top = rect.top + window.scrollY + target * span;

      seekRef.current = index;
      segmentRef.current = index;
      host.style.setProperty(segmentProperty, String(index));
      setSegment(index);
      if (seekTimer.current) window.clearTimeout(seekTimer.current);
      seekTimer.current = window.setTimeout(() => {
        seekRef.current = -1;
        seekTimer.current = 0;
      }, 1200);

      const reduced = window.matchMedia(REDUCED_QUERY).matches;
      window.scrollTo({
        top: Math.max(0, Math.round(top)),
        behavior: reduced ? "auto" : "smooth",
      });
    },
    [pinned, hostRef, trackRef, segments, segmentProperty],
  );

  useEffect(
    () => () => {
      if (seekTimer.current) window.clearTimeout(seekTimer.current);
    },
    [],
  );

  return { progress, pinned, segment, scrollToSegment };
}
