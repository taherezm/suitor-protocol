import type { Metadata } from "next";
import { Badge, PageIntro, SectionLabel, TextLink } from "@/components/ui";
import { protocolData } from "@/lib/sample-data";
import { dollars } from "@/lib/format";

export const metadata: Metadata = { title: "Underwriting & outcomes" };

const process = [
  {
    title: "Understand the legal claim",
    text: "Review the cause of action, available evidence, defenses, and procedural position. Identify what remains unverified.",
  },
  {
    title: "Examine the funding request",
    text: "Assess counsel’s budget and the costs still needed to reach resolution. Test whether the proposed terms justify the exposure.",
  },
  {
    title: "Consider recovery and timing",
    text: "Examine possible recoveries, the ability to collect them, and the expected time to payment. Include the effects of appeals and delays.",
  },
  {
    title: "Require operator approval",
    text: "An operator reviews the assessment and supporting documents before approving an allocation. A model estimate would inform this review, not authorize funding.",
  },
];

export default async function UnderwritingPage() {
  const [assessment, outcomes] = await Promise.all([
    protocolData.getAssessment(),
    protocolData.getOutcomePreview(),
  ]);
  return (
    <>
      <PageIntro
        eyebrow="Underwriting & outcomes"
        title="Review the claim. Test the economics."
      >
        <p>
          A proposed framework for evaluating legal claims and the capital they
          require. Human review remains part of every funding decision.
        </p>
      </PageIntro>
      <nav className="anchor-nav" aria-label="On this page">
        <a href="#process">
          <span>01</span>Underwriting process<span aria-hidden="true">↓</span>
        </a>
        <a href="#outcomes">
          <span>02</span>Outcome engine<span aria-hidden="true">↓</span>
        </a>
      </nav>
      <section id="process" className="content-section">
        <div className="split-section">
          <div>
            <SectionLabel index="01">Underwriting process</SectionLabel>
            <h2>
              Before capital
              <br />
              is committed.
            </h2>
            <p className="section-description">
              The process below is proposed. Live assessments and allocation
              approvals are not implemented.
            </p>
          </div>
          <ol className="process-list">
            {process.map((item, i) => (
              <li key={item.title}>
                <span className="mono">0{i + 1}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="assessment">
          <div className="section-top">
            <div>
              <p className="eyebrow">Fictional case / {assessment.id}</p>
              <h3>Sample case assessment</h3>
            </div>
            <Badge>Illustrative only</Badge>
          </div>
          <div className="assessment-summary">
            <div>
              <span className="muted small">Funding request</span>
              <strong>{dollars(assessment.requestedCents)}</strong>
              <span className="small muted">{assessment.claim}</span>
            </div>
            <dl className="assessment-terms">
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
          <details className="assumption-details" open>
            <summary>
              Supporting assumptions{" "}
              <span className="small muted">Sample inputs</span>
            </summary>
            <dl className="assumption-rows">
              {assessment.assumptions.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </section>
      <section id="outcomes" className="content-section section-rule">
        <div className="section-top">
          <div>
            <SectionLabel index="02">Outcome engine</SectionLabel>
            <h2>Outcomes have different economics.</h2>
          </div>
          <Badge>Methodology preview</Badge>
        </div>
        <p className="section-description wide">
          The engine is not implemented. A future service would use case
          information to estimate possible outcomes, with explicit uncertainty.
          The examples below are scenario assumptions, not predictions or
          assigned probabilities.
        </p>
        <div
          className="table-scroll"
          role="region"
          aria-label="Illustrative outcome scenarios"
          tabIndex={0}
        >
          <table className="data-table outcome-table">
            <caption>
              Independent scenarios for {dollars(outcomes.fundedCents)} of
              funding. Receipts are assumed cash returned to the pool before
              pool fees, not total case damages. Timing is measured to
              collection.
            </caption>
            <thead>
              <tr>
                <th scope="col">Assumed scenario</th>
                <th scope="col" className="numeric">
                  Pool receives
                </th>
                <th scope="col">Time to cash</th>
                <th scope="col">Effect on funded capital</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.scenarios.map((scenario) => (
                <tr key={scenario.label}>
                  <th scope="row">{scenario.label}</th>
                  <td className="numeric">{dollars(scenario.receiptsCents)}</td>
                  <td>{scenario.monthsToCash} months</td>
                  <td>{scenario.capitalEffect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="outcome-callout">
          <span className="mono">THE COST OF TIME</span>
          <div>
            <h3>A legal win can still be a poor investment.</h3>
            <p>
              Receiving $275,000 five years after funding $250,000 produces only
              about 1.9% annualized, before pool fees or inflation. If only
              $200,000 is collected, the investment loses $50,000 despite a
              favorable judgment.
            </p>
            <p className="small muted">
              Illustrative calculation: ($275,000 ÷ $250,000)<sup>1/5</sup> − 1.
              No interim cash flows assumed.
            </p>
          </div>
        </div>
        <div className="split-section history-section">
          <h3>
            Historical results and
            <br />
            future estimates stay separate.
          </h3>
          <div className="reading-copy">
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
            <TextLink href="/docs/outcome-estimates">
              Read the estimation methodology
            </TextLink>
          </div>
        </div>
      </section>
    </>
  );
}
