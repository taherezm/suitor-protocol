"use client";

/* Currently unmounted by owner decision: nothing renders this, and it is kept
   on disk so the stage can be put back by restoring the element in hero.tsx. */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Guilloche } from "@/components/guilloche";
import {
  IndicatorPill,
  useSlidingIndicator,
} from "@/components/motion/sliding-indicator";
import { IngotCanvas, type IngotBar } from "@/components/three/ingot-canvas";
import { dollars } from "@/lib/format";

export interface StageAllocation {
  id: string;
  claim: string;
  committedCents: number;
  status: string;
  resolutionWindow: string;
}

export interface StageTotals {
  depositsCents: number;
  allocatedCents: number;
  availableCents: number;
  claims: number;
}

/**
 * The stage: one object, lit, standing in its own pool of light.
 *
 * There is no grid under it, no grid behind it and no registration marks on its
 * corners. What is left of the drafting sheet is two diagonals and two arcs over
 * the engraved rosette, and the floor is light alone: a radial pool and a
 * contact shadow, both drawn by the scene.
 *
 * The bars are the allocations, so touching one has to mean something. Hovering
 * a bar pulls it out of the stack and fills the readout; the three chips
 * underneath do exactly the same thing from the keyboard, which is why they are
 * buttons and not decoration. Nothing here is the only copy of anything: the
 * canvas is hidden from assistive technology and every figure it shows is also
 * written in text below it.
 */
export function HeroStage({
  allocations,
  totals,
}: {
  allocations: readonly StageAllocation[];
  totals: StageTotals;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  const bars = useMemo<IngotBar[]>(
    () =>
      allocations.map((allocation) => ({
        id: allocation.id,
        label: allocation.claim,
        amountCents: allocation.committedCents,
      })),
    [allocations],
  );

  useSlidingIndicator(chipsRef, "[data-active]", [activeId]);

  /* How far the hero has been scrolled past, quantised so the pointer-driven
     scene is not re-rendered by React sixty times a second. */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const box = stage.getBoundingClientRect();
      const span = box.height + window.innerHeight * 0.4;
      const next = Math.min(1, Math.max(0, -box.top / span));
      setProgress((current) =>
        Math.abs(current - next) < 0.02 ? current : next,
      );
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const active = allocations.find((item) => item.id === activeId) ?? null;

  return (
    <div className="hero-stage-block">
      <div className="hero-stage" ref={stageRef}>
        <Guilloche
          variant="rosette"
          density={4}
          className="hero-rosette ix-drift"
        />
        <ConstructionLines />
        <div className="light-cone hero-cone" aria-hidden="true" />
        <IngotCanvas
          mode="hero"
          bars={bars}
          progress={progress}
          activeId={activeId}
          onActiveChange={setActiveId}
          className="hero-ingot"
        />
      </div>

      <div className="hero-panel">
        <div className="hero-chips" ref={chipsRef}>
          <IndicatorPill />
          {allocations.map((allocation) => {
            const on = allocation.id === activeId;
            return (
              <button
                key={allocation.id}
                type="button"
                className="hero-chip"
                data-active={on ? "" : undefined}
                aria-pressed={on}
                onPointerEnter={() => setActiveId(allocation.id)}
                onPointerLeave={() => setActiveId(null)}
                onFocus={() => setActiveId(allocation.id)}
                onBlur={() => setActiveId(null)}
                onClick={() => setActiveId(on ? null : allocation.id)}
              >
                <span className="hero-chip-id mono">{allocation.id}</span>
                <span className="hero-chip-claim">{allocation.claim}</span>
              </button>
            );
          })}
        </div>

        <div className="hero-readout" aria-live="polite">
          <div className="hero-readout-in" key={active ? active.id : "pool"}>
            {active ? (
              <>
                <p className="hero-readout-head">
                  <span className="mono hero-readout-id">{active.id}</span>
                  {active.claim}
                </p>
                <dl className="hero-readout-stats">
                  <Stat
                    label="Committed"
                    value={dollars(active.committedCents)}
                  />
                  <Stat label="Stage" value={active.status} />
                  <Stat label="Resolution" value={active.resolutionWindow} />
                </dl>
              </>
            ) : (
              <>
                {/* No "Pool 01" tag in front of the sentence. It was an
                    invented label for the one pool on the site; the id chip
                    that appears here when a bar is held is a real allocation
                    number and stays. */}
                <p className="hero-readout-head">
                  {totals.claims} funded claims, sample data
                </p>
                <dl className="hero-readout-stats">
                  <Stat
                    label="Deposits"
                    value={dollars(totals.depositsCents)}
                  />
                  <Stat
                    label="Allocated"
                    value={dollars(totals.allocatedCents)}
                  />
                  <Stat
                    label="Available"
                    value={dollars(totals.availableCents)}
                  />
                </dl>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hero-stat">
      <dt>{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  );
}

/**
 * What is left of the drafting sheet: two faint diagonals and the two big
 * arcs. The centre square, the horizon and the floor grid are gone, because a
 * ruled stage turns the object into a diagram of itself.
 *
 * The strokes draw in through `.ix-draw-line`, so they are keyed to the
 * `[data-reveal]` wrapper around the stage and play when the stage is scrolled
 * to rather than on page load. Pure ornament, and it says so.
 */
function ConstructionLines() {
  const paths = [
    "M0 0 L1000 440",
    "M1000 0 L0 440",
    "M120 440 A 380 380 0 0 1 880 440",
    "M40 440 A 460 460 0 0 1 960 440",
  ];
  return (
    <svg
      className="hero-lines"
      viewBox="0 0 1000 440"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      {paths.map((d, index) => (
        <path
          key={d}
          d={d}
          pathLength="1"
          className="ix-draw-line"
          vectorEffect="non-scaling-stroke"
          style={{ "--i": index } as CSSProperties}
        />
      ))}
    </svg>
  );
}
