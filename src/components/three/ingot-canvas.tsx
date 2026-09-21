"use client";

/**
 * The one physical object on the site, and it is data: a stack of platinum
 * ingots where each bar is one allocation, engraved with its case id and amount.
 *
 * This file is only the lifecycle. The renderer lives in `./ingot-scene`, is
 * loaded on demand, and is allowed to fail: a machine with no GPU (headless
 * Chromium, most CI) gets the inline SVG stand-in instead, and no exception
 * ever reaches the page.
 *
 * Loading is gated on the reader actually arriving. Three is not imported and
 * no scene is built until the canvas has been within about a viewport of the
 * screen for a moment, and even then the work is queued as idle time. A canvas
 * that is merely scrolled past, by a nav click or a hash landing, costs
 * nothing at all.
 *
 * The canvas is decorative. Every bar's id and amount is real text in the
 * markup around it, which is what a screen reader and the test suite read.
 */

import { useEffect, useId, useRef, useState } from "react";
import {
  createIngotScene,
  type IngotSceneHandle,
} from "@/components/three/ingot-scene";

export type IngotMode = "hero" | "timeline";

export type IngotBar = {
  id: string;
  label: string;
  amountCents: number;
};

export interface IngotCanvasProps {
  mode: IngotMode;
  bars: IngotBar[];
  /** 0..1 scrub position. Timeline mode only. */
  progress?: number;
  /** Hero mode only: which bar is pulled forward. */
  activeId?: string | null;
  /** Hero mode only: fired when hover or focus moves to another bar, or away. */
  onActiveChange?: (id: string | null) => void;
  className?: string;
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ---------- The gate ----------
   Importing three and building a scene costs a module graph, a PMREM pass and
   the first few frames, and on a machine without a GPU that is main thread time
   measured in seconds. None of it may happen because a canvas swept past the
   viewport: a nav click that travels the page, a restored scroll position or a
   hash landing must all leave this untouched.

   So the canvas has to be near the viewport and stay there. `NEAR` is roughly
   one viewport of headroom, `DWELL` is how long it has to hold still before the
   work is even queued, and the work itself is queued as idle time. */

const NEAR = "100% 0px";
const DWELL = 200;

/** Idle time if the browser offers it, a macrotask if it does not. */
function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(run, { timeout: 1200 });
    return () => window.cancelIdleCallback?.(handle);
  }
  const handle = window.setTimeout(run, 1);
  return () => window.clearTimeout(handle);
}

export function IngotCanvas({
  mode,
  bars,
  progress = 0,
  activeId = null,
  onActiveChange,
  className,
}: IngotCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<IngotSceneHandle | null>(null);
  /** Scene creation is async, so mounts are queued rather than raced. */
  const chainRef = useRef<Promise<void>>(Promise.resolve());

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(prefersReducedMotion);

  // Latest props, read by the async setup once the scene actually exists.
  const progressRef = useRef(progress);
  const activeRef = useRef(activeId);
  const callbackRef = useRef(onActiveChange);
  progressRef.current = progress;
  activeRef.current = activeId;
  callbackRef.current = onActiveChange;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Rebuilding is expensive, so it happens only when the scene's own shape
  // changes: the mode, the bars themselves, or the reader's motion preference.
  const barsKey = bars.map((bar) => `${bar.id}:${bar.amountCents}`).join("|");

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let cancelled = false;
    let started = false;
    let dwell = 0;
    let cancelIdle: (() => void) | null = null;
    let gate: IntersectionObserver | null = null;
    const cleanups: (() => void)[] = [];

    /** Swept past, or gone again. Whatever was queued is dropped unstarted. */
    const disarm = () => {
      if (dwell) window.clearTimeout(dwell);
      dwell = 0;
      cancelIdle?.();
      cancelIdle = null;
    };

    // Arrow functions rather than declarations: `host` and `canvas` are known
    // to be non-null from here down, and only a closure created after that
    // check keeps the narrowing.
    const build = async () => {
      if (cancelled) return;
      let scene: IngotSceneHandle;
      try {
        scene = await createIngotScene(canvas, {
          mode,
          bars,
          reducedMotion: reduced,
          onActiveChange: (id) => callbackRef.current?.(id),
        });
      } catch {
        if (!cancelled) {
          setFailed(true);
          setReady(false);
        }
        return;
      }
      if (cancelled) {
        scene.dispose();
        return;
      }

      sceneRef.current = scene;
      scene.resize();
      scene.setProgress(progressRef.current);
      scene.setActive(activeRef.current);
      setFailed(false);
      setReady(true);

      /* Nothing renders that nobody is looking at. */
      let visible = true;
      let onscreen = false;
      const sync = () => {
        if (visible && onscreen) scene.start();
        else scene.stop();
      };

      if (typeof IntersectionObserver !== "undefined") {
        const watcher = new IntersectionObserver(
          (entries) => {
            onscreen = entries.some((entry) => entry.isIntersecting);
            // The hero stage starts below the fold, so its entrance belongs to
            // the moment it is first reached rather than to page load. The
            // scene keeps it to one shot.
            if (onscreen) scene.playEntrance();
            sync();
          },
          { rootMargin: "120px" },
        );
        watcher.observe(host);
        cleanups.push(() => watcher.disconnect());
      } else {
        onscreen = true;
        scene.playEntrance();
      }

      const onVisibility = () => {
        visible = !document.hidden;
        sync();
      };
      document.addEventListener("visibilitychange", onVisibility);
      cleanups.push(() =>
        document.removeEventListener("visibilitychange", onVisibility),
      );

      if (typeof ResizeObserver !== "undefined") {
        const sizer = new ResizeObserver(() => scene.resize());
        sizer.observe(host);
        cleanups.push(() => sizer.disconnect());
      } else {
        const onResize = () => scene.resize();
        window.addEventListener("resize", onResize, { passive: true });
        cleanups.push(() => window.removeEventListener("resize", onResize));
      }

      if (mode === "hero") {
        // One pointer sample per frame at most: hover is a render input, not
        // a stream of events.
        let frame = 0;
        let px = 0;
        let py = 0;
        let inside = false;
        const flush = () => {
          frame = 0;
          scene.setPointer(px, py, inside);
        };
        const schedule = () => {
          if (frame) return;
          frame = requestAnimationFrame(flush);
        };
        const onMove = (event: PointerEvent) => {
          const box = canvas.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return;
          px = ((event.clientX - box.left) / box.width) * 2 - 1;
          py = -(((event.clientY - box.top) / box.height) * 2 - 1);
          inside = true;
          schedule();
        };
        const onLeave = () => {
          inside = false;
          schedule();
        };
        host.addEventListener("pointermove", onMove, { passive: true });
        host.addEventListener("pointerleave", onLeave, { passive: true });
        host.addEventListener("pointercancel", onLeave, { passive: true });
        cleanups.push(() => {
          if (frame) cancelAnimationFrame(frame);
          host.removeEventListener("pointermove", onMove);
          host.removeEventListener("pointerleave", onLeave);
          host.removeEventListener("pointercancel", onLeave);
        });
      }

      sync();
      onVisibility();
    };

    const begin = () => {
      started = true;
      // The gate has done its job and the scene owns its own observers now.
      gate?.disconnect();
      gate = null;
      chainRef.current = chainRef.current.then(build);
    };

    /** Near the viewport. Nothing is queued until it has stayed that way. */
    const arm = () => {
      if (started || cancelled || dwell || cancelIdle) return;
      dwell = window.setTimeout(() => {
        dwell = 0;
        cancelIdle = whenIdle(() => {
          cancelIdle = null;
          if (!cancelled && !started) begin();
        });
      }, DWELL);
    };

    if (typeof IntersectionObserver === "undefined") {
      begin();
    } else {
      gate = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) arm();
          else disarm();
        },
        { rootMargin: NEAR },
      );
      gate.observe(host);
    }

    return () => {
      cancelled = true;
      disarm();
      gate?.disconnect();
      gate = null;
      for (const cleanup of cleanups) cleanup();
      cleanups.length = 0;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      setReady(false);
    };
    // `bars` is covered by `barsKey`; a new array of the same bars must not
    // tear the scene down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, barsKey, reduced]);

  useEffect(() => {
    sceneRef.current?.setProgress(progress);
  }, [progress]);

  useEffect(() => {
    sceneRef.current?.setActive(activeId);
  }, [activeId]);

  const classes = ["ingot", className].filter(Boolean).join(" ");

  return (
    <div
      ref={hostRef}
      className={classes}
      data-ingot-mode={mode}
      data-ready={ready ? "" : undefined}
      data-fallback={failed ? "" : undefined}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="ingot-canvas" />
      <IngotFallback bars={bars} mode={mode} />
    </div>
  );
}

/**
 * The stand-in. It is what renders before the scene exists, what renders when
 * there is no GPU, and what renders with JavaScript switched off, so the stage
 * is never an empty box.
 */
function IngotFallback({ bars, mode }: { bars: IngotBar[]; mode: IngotMode }) {
  const single = mode === "timeline";
  // The page mounts more than one of these, so the gradients cannot take fixed
  // ids: two elements sharing an id is invalid, and the second copy's paint
  // would resolve against the first one's definition.
  const uid = useId();
  const face = `ingot-face-${uid}`;
  const top = `ingot-top-${uid}`;
  const pool = `ingot-pool-${uid}`;
  return (
    <svg
      className="ingot-fallback"
      viewBox="0 0 640 360"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={face} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="55%" stopColor="#cfd4dd" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#8d94a1" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={top} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#aab1bd" stopOpacity="0.6" />
        </linearGradient>
        <radialGradient id={pool} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#cddaff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#cddaff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="320" cy="286" rx="230" ry="46" fill={`url(#${pool})`} />
      {single ? (
        <g>
          <path
            d="M196 238h248l-26-54H222z"
            fill={`url(#${face})`}
            stroke="rgba(255,255,255,0.28)"
          />
          <path
            d="M222 184h196l24-26H198z"
            fill={`url(#${top})`}
            stroke="rgba(255,255,255,0.28)"
          />
        </g>
      ) : (
        <g>
          <path
            d="M96 252h214l-24-52H120z"
            fill={`url(#${face})`}
            stroke="rgba(255,255,255,0.24)"
          />
          <path
            d="M120 200h166l22-24H98z"
            fill={`url(#${top})`}
            stroke="rgba(255,255,255,0.24)"
          />
          <path
            d="M330 252h214l-24-52H354z"
            fill={`url(#${face})`}
            stroke="rgba(255,255,255,0.24)"
          />
          <path
            d="M354 200h166l22-24H332z"
            fill={`url(#${top})`}
            stroke="rgba(255,255,255,0.24)"
          />
          <path
            d="M204 172h232l-24-52H228z"
            fill={`url(#${face})`}
            stroke="rgba(255,255,255,0.3)"
          />
          <path
            d="M228 120h184l22-24H206z"
            fill={`url(#${top})`}
            stroke="rgba(255,255,255,0.3)"
          />
        </g>
      )}
      <g
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1"
        opacity={bars.length ? 1 : 0.5}
      >
        <circle cx="320" cy="146" r="17" />
        <circle cx="320" cy="146" r="9" />
      </g>
    </svg>
  );
}
