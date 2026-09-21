"use client";

import { CountUp } from "@/components/motion/count-up";
import { Reveal, Stagger } from "@/components/motion/reveal";
import { SectionHead, TextLink } from "@/components/ui";
import { dollars } from "@/lib/format";
import type { OutcomePreview } from "@/lib/types";

/**
 * Owner: outcomes agent. Four assumed endings for one $250,000 allocation.
 * Loss is drawn hollow (outline, dashed, wireframe); gain is drawn filled.
 * No probabilities are assigned, and none may be implied.
 *
 * The only difference between a win and a loss on this page is fill and
 * luminance. There is no green and no red, because a colour would read as a
 * verdict on a scenario that is explicitly not a prediction.
 *
 * This is a client component only because `CountUp` takes a `format` function,
 * and a function cannot cross the server boundary. Everything here is still
 * rendered on the server first: the props are plain data, so the markup is
 * identical on both sides.
 *
 * There is no ornament on these cards at all. The engraved seal was cut first,
 * because a rosette is a 1000 unit drawing whose hairlines collapse into a grey
 * smudge at card scale; the hairline ruler that ran under each figure and ended
 * in a marker has now gone the same way. It repeated the month the caption
 * above it already states, and it left every card ending in a band of empty
 * space. The card is the words and the figure, and nothing else.
 */

/** Module scope, because a new identity on every render restarts the count. */
const money = (cents: number) => dollars(cents);

/**
 * The bento. Columns alternate 7/5 then 5/7 so the grid closes on both rows,
 * and the one card that is a loss is the one card that is not filled in.
 */
const LAYOUT: Record<
  string,
  { rank: number; wide: boolean; hollow?: boolean }
> = {
  "Judgment & collection": { rank: 0, wide: true },
  Settlement: { rank: 1, wide: false },
  "Favorable outcome, delayed collection": { rank: 2, wide: false },
  Loss: { rank: 3, wide: true, hollow: true },
};

export function Outcomes({ outcomes }: { outcomes: OutcomePreview }) {
  const cards = [...outcomes.scenarios]
    .map((scenario) => ({
      scenario,
      shape: LAYOUT[scenario.label] ?? { rank: 99, wide: false },
    }))
    .sort((a, b) => a.shape.rank - b.shape.rank);

  return (
    <section className="section out" aria-labelledby="out-heading">
      <div className="shell">
        <Reveal className="out-head">
          <SectionHead
            id="out-heading"
            lead="Outcomes have different economics."
          >
            Assumed scenarios for one $250,000 allocation. Not predictions, and
            no probabilities are assigned.
          </SectionHead>
        </Reveal>

        <Stagger className="out-grid" step={90}>
          {cards.map(({ scenario, shape }) => {
            const hollow = shape.hollow === true;

            return (
              <article
                key={scenario.label}
                className={[
                  "out-card",
                  "glass",
                  "ix-card",
                  shape.wide ? "out-card-wide" : "out-card-narrow",
                  shape.rank === 0 ? "out-card-tall" : "",
                  hollow ? "out-card-hollow" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <h3 className="out-label">{scenario.label}</h3>

                <p className="out-cap">Pool receives</p>
                <p
                  className={
                    hollow
                      ? "out-figure out-figure-hollow"
                      : "out-figure platinum-text"
                  }
                >
                  <CountUp value={scenario.receiptsCents} format={money} />
                </p>

                <p className="out-meta">
                  <span className="out-when mono">
                    month {scenario.monthsToCash}
                  </span>
                </p>

                <p className="out-effect">{scenario.capitalEffect}</p>
              </article>
            );
          })}
        </Stagger>

        <Reveal className="out-note">
          <p className="small muted">
            Receipts are assumed cash returned to the pool before pool fees, not
            total case damages. A filled figure returns more cash than the
            funded capital. A hollow one returns less.
          </p>
          <TextLink href="/#outcome-engine">
            See how the outcome engine would work
          </TextLink>
        </Reveal>
      </div>
    </section>
  );
}
