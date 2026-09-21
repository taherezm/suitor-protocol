import { Badge } from "@/components/ui";
import { Reveal, Stagger } from "@/components/motion/reveal";
import { DollarCount } from "@/components/home/dollar-count";
import type { CaseAssessment } from "@/lib/types";

function Chevron() {
  return (
    <svg
      className="ix-chevron afile-chevron"
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Owner: page-sections engineer. The sample assessment that used to live at
 * /underwriting: one claim, its terms and its supporting assumptions, read as a
 * file rather than as a table.
 *
 * The `#assessment` id is the target of the second row of the section index, so
 * it has to exist exactly once.
 */
export function AssessmentFile({ assessment }: { assessment: CaseAssessment }) {
  return (
    <section id="assessment" className="afile section">
      <div className="shell">
        {/* The heading used to be preceded by a mono "Fictional case / SP-004"
            tag. The badge beside it already says the block is illustrative and
            the sentence under it says the claim is fictional in plain words, so
            the tag was costume for a case number the reader has no use for
            here; the id is still in the allocations table, where it selects a
            row. */}
        <Reveal className="afile-head">
          <div className="afile-head-top">
            <h3>Sample case assessment</h3>
            <Badge>Illustrative only</Badge>
          </div>
          <p className="afile-note">
            The claim below is fictional. The process above is proposed, and
            live assessments and allocation approvals are not implemented.
          </p>
        </Reveal>

        <Reveal className="afile-outer" delay={80}>
          {/* A clean glass frame. This used to carry an engraved border, and
              the wave ran through the labels at every width it was not drawn
              for; the plate is the object here, not the ornament around it. */}
          <div className="afile-file glass-frame">
            <div className="afile-inner">
              <div className="afile-summary">
                <div className="afile-request">
                  <span className="small muted">Funding request</span>
                  <strong className="afile-amount platinum-text">
                    <DollarCount cents={assessment.requestedCents} />
                  </strong>
                  <span className="small muted">{assessment.claim}</span>
                </div>
                <dl className="afile-terms">
                  <div>
                    <dt>Procedural stage</dt>
                    <dd>{assessment.stage}</dd>
                  </div>
                  <div>
                    <dt>Proposed terms</dt>
                    <dd>{assessment.proposedTerms}</dd>
                  </div>
                  <div>
                    <dt>Approval status</dt>
                    <dd>Operator review pending</dd>
                  </div>
                </dl>
              </div>

              <details className="afile-details" open>
                <summary className="afile-summary-bar">
                  <span className="afile-summary-label">
                    Supporting assumptions
                  </span>
                  <span className="small muted afile-summary-note">
                    Sample inputs
                  </span>
                  <Chevron />
                </summary>
                <Stagger as="dl" className="afile-rows" step={50}>
                  {assessment.assumptions.map((item) => (
                    <div key={item.label} className="afile-row ix-row">
                      <dt className="ix-row-label afile-row-label">
                        {item.label}
                      </dt>
                      <dd className="afile-row-value">{item.value}</dd>
                    </div>
                  ))}
                </Stagger>
              </details>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
