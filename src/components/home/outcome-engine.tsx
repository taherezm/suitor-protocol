import { Badge, SectionHead, TextLink } from "@/components/ui";
import { Reveal, Stagger } from "@/components/motion/reveal";
import type { OutcomePreview } from "@/lib/types";
import { dollars } from "@/lib/format";

/**
 * Owner: page-sections engineer. The outcome engine that used to live at
 * /underwriting#outcomes: how an assumed ending turns into a number, with the
 * methodology still marked as a preview.
 *
 * The exact text "Methodology preview" belongs here and appears exactly once on
 * the whole site, and `#outcome-engine` is the third row of the section index.
 *
 * There is deliberately no scenario table here any more. The four cards
 * directly above are the same four scenarios with the same four figures, and
 * printing them again underneath, in a different order, was the page padding
 * itself out with its only data set. The cards are the scenarios; this is the
 * method, the arithmetic and the caveat, which is what the cards cannot carry.
 *
 * The head goes through `SectionHead` like every other section on the page,
 * so it is centred at the same scale rather than reading as a block someone
 * forgot to restyle.
 */
export function OutcomeEngine({ outcomes }: { outcomes: OutcomePreview }) {
  return (
    <section id="outcome-engine" className="engine section">
      <div className="shell">
        <Reveal className="engine-head">
          <SectionHead
            eyebrow="Outcome engine"
            lead="How the outcome engine would work."
          >
            It is not implemented. A future service would use case information
            to estimate possible outcomes, with explicit uncertainty.
          </SectionHead>
          <p className="engine-badge">
            <Badge>Methodology preview</Badge>
          </p>
        </Reveal>

        <Reveal className="engine-callout-outer" delay={80}>
          <div className="engine-callout glass">
            <h3>The cost of time</h3>
            <p>
              Receiving $275,000 five years after funding{" "}
              {dollars(outcomes.fundedCents)} produces only about 1.9%
              annualized, before pool fees or inflation. If only $200,000 is
              collected, the investment loses $50,000 despite a favorable
              judgment.
            </p>
            <p className="small muted">
              Illustrative calculation: ($275,000 ÷ $250,000)<sup>1/5</sup> − 1.
              No interim cash flows assumed.
            </p>
          </div>
        </Reveal>

        <div className="engine-history">
          <Reveal className="engine-history-head">
            <h3>Historical results and future estimates stay separate.</h3>
          </Reveal>
          <Stagger className="engine-history-copy" step={70}>
            <p>
              There is no Suitor performance history presented here. Future
              reporting should identify the exact cohort, observation period,
              and number of cases behind any win or loss figure.
            </p>
            <p>
              Settlements should be reported separately. Unresolved cases should
              remain unresolved, and a favorable judgment should be
              distinguished from money actually collected. Neither should be
              silently counted as a loss.
            </p>
            <div className="engine-history-link">
              <TextLink href="/docs/outcome-estimates">
                Read the estimation methodology
              </TextLink>
            </div>
          </Stagger>
        </div>
      </div>
    </section>
  );
}
