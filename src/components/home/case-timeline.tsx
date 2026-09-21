"use client";

import { useMemo, useRef, type CSSProperties } from "react";
import { Reveal, Stagger } from "@/components/motion/reveal";
import { CashflowChart } from "@/components/home/cashflow-chart";
import { useScrollProgress } from "@/components/home/use-scroll-progress";
import { IngotCanvas, type IngotBar } from "@/components/three/ingot-canvas";
import { dollars } from "@/lib/format";
import type { CaseAssessment, OutcomePreview } from "@/lib/types";

/**
 * Life of a case.
 *
 * This is the one section of the page that refuses to be skimmed. The stage
 * pins and the reader's own scrolling becomes the clock: five years of a legal
 * claim pass under a fixed frame, the bar sits there doing nothing for most of
 * it, and the cashflow fork only opens at the end. Duration is the risk in this
 * asset class, so duration is the thing the page spends its scroll on.
 *
 * Pinning is a privilege, not the structure. Below 900px, on a short viewport,
 * under reduced motion, or with no JavaScript at all, `data-pinned` is never
 * written and the same markup lays itself out as a plain vertical list of
 * cards, the figure and the chart. Nothing is hidden in that state and nothing
 * needs a scroll to be read.
 */

const TOTAL_MONTHS = 60;

interface Phase {
  months: string;
  title: string;
  body: string;
  /** Short name for the scrubber, where there is no room for a sentence. */
  short: string;
  /** The phase's real span, in months on the 0 to 60 ruler. */
  from: number;
  to: number;
  /** The first month the scrubber reads this phase out. */
  starts: number;
}

/**
 * The four phases, with the months they actually cover.
 *
 * `from`/`to` are the numbers in the captions, and they are the only numbers
 * the strip is drawn from: a month ruler that does not mean months is the one
 * thing a finance reader will not forgive, and the strip used to be laid out
 * on invented weights under a to-scale axis. The spans overlap, because they
 * are ranges rather than a partition, so each one gets its own row.
 *
 * `starts` is where the scrubber hands over, and it is inside the phase's own
 * span in every case: at month 41 the reader is told about months 18 to 60,
 * never about months 18 to 30.
 */
const PHASES: readonly Phase[] = [
  {
    months: "Month 0",
    title: "The capital goes in.",
    body: "$250,000 is committed to one claim. From here it is illiquid.",
    short: "Commitment",
    from: 0,
    to: 0,
    starts: 0,
  },
  {
    months: "Months 0 to 18",
    title: "Then nothing happens.",
    body: "Pleadings, discovery, motions. No distributions, no redemptions, no price.",
    short: "Litigation",
    from: 0,
    to: 18,
    starts: 1,
  },
  {
    months: "Months 18 to 30",
    title: "The resolution window opens.",
    body: "A settlement or a judgment could land anywhere in this range. Collection adds 3 to 12 months.",
    short: "Resolution window",
    from: 18,
    to: 30,
    starts: 18,
  },
  {
    months: "Months 18 to 60",
    title: "Then one of four endings.",
    body: "Settlement, judgment, a delayed collection, or a total loss.",
    short: "Cash or loss",
    from: 18,
    to: 60,
    starts: 31,
  },
];

const TICKS = [0, 12, 24, 36, 48, 60];

type Vars = CSSProperties & Record<`--${string}`, string | number>;

function phaseAt(month: number): number {
  let index = 0;
  for (let i = 0; i < PHASES.length; i += 1) {
    if (month >= PHASES[i].starts) index = i;
  }
  return index;
}

export function CaseTimeline({
  outcomes,
  assessment,
}: {
  outcomes: OutcomePreview;
  assessment: CaseAssessment;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // One step per month: React re-renders when the month a reader can read has
  // changed, and never for the fractions in between. Those go to CSS instead.
  const { progress, pinned } = useScrollProgress({
    trackRef,
    hostRef: sectionRef,
    steps: TOTAL_MONTHS,
  });

  const month = Math.round(progress * TOTAL_MONTHS);
  const active = pinned ? phaseAt(month) : -1;

  const bars = useMemo<IngotBar[]>(
    () => [
      {
        id: assessment.id,
        label: assessment.claim,
        amountCents: outcomes.fundedCents,
      },
    ],
    [assessment.id, assessment.claim, outcomes.fundedCents],
  );

  return (
    <section className="tl" ref={sectionRef} aria-labelledby="tl-heading">
      <div className="tl-track" ref={trackRef}>
        <div className="tl-stage">
          <div className="shell tl-stage-inner">
            <div className="tl-cols">
              <div className="tl-col tl-col-text">
                <Reveal>
                  <h2 className="eyebrow-rule tl-eyebrow" id="tl-heading">
                    <span>Life of a case</span>
                  </h2>
                </Reveal>

                <Stagger as="ol" className="tl-phases" step={80}>
                  {PHASES.map((phase, index) => (
                    <li
                      key={phase.title}
                      className="tl-phase glass"
                      data-on={active === index ? "" : undefined}
                    >
                      <p className="tl-month">{phase.months}</p>
                      <h3 className="tl-phase-title">{phase.title}</h3>
                      <p className="tl-phase-body">{phase.body}</p>
                    </li>
                  ))}
                </Stagger>
              </div>

              <Reveal className="tl-col tl-col-figure" delay={120}>
                <div className="glass-frame tl-frame">
                  <figure className="tl-bar">
                    <IngotCanvas
                      mode="timeline"
                      bars={bars}
                      progress={pinned ? progress : 0.9}
                      className="tl-canvas"
                    />
                    {/* The canvas is decoration and is hidden from assistive
                        technology, so the allocation it draws is written out
                        here as ordinary text. */}
                    <figcaption className="tl-bar-meta">
                      <span className="mono tl-bar-id">{assessment.id}</span>
                      <span className="tl-bar-claim">{assessment.claim}</span>
                      <span className="mono tl-bar-amount">
                        {dollars(outcomes.fundedCents)}
                      </span>
                    </figcaption>
                  </figure>

                  <CashflowChart
                    outcomes={outcomes}
                    progress={pinned ? progress : 1}
                  />
                </div>
              </Reveal>
            </div>

            {/* A visual index of copy that is already on the page in full, so it
                is decoration: it never announces a month that changes under a
                screen reader sixty times on the way down. */}
            <div className="tl-scrub" aria-hidden="true">
              <div className="tl-scrub-head">
                <span className="tl-scrub-label">Elapsed</span>
                <span className="tl-scrub-month mono">Month {month}</span>
              </div>

              <div className="tl-axis">
                <div className="tl-axis-rule" />
                <div className="tl-axis-fill" />
                <div className="tl-axis-cursor">
                  <span className="tl-axis-marker" />
                </div>
                <div className="tl-ticks">
                  {TICKS.map((tick) => (
                    <span
                      key={tick}
                      className="tl-tick"
                      style={{ "--t": tick } as Vars}
                    >
                      <span className="tl-tick-n mono">{tick}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* One row per phase, each band laid on the same 0 to 60 ruler
                  as the ticks above it. The rows exist because the phases
                  overlap; stacking them is what lets every band sit at its
                  true months instead of being squeezed into a partition. */}
              <ol className="tl-segs">
                {PHASES.map((phase, index) => (
                  <li
                    key={phase.short}
                    className="tl-seg"
                    data-on={active === index ? "" : undefined}
                    style={{ "--from": phase.from, "--to": phase.to } as Vars}
                  >
                    <span className="tl-seg-band" />
                    <span className="tl-seg-text">
                      <span className="tl-seg-months mono">{phase.months}</span>
                      <span className="tl-seg-name">{phase.short}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
