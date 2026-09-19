import type { Metadata } from "next";
import { Badge, PageIntro, SectionLabel, TextLink } from "@/components/ui";
import { PoolMetrics } from "@/components/pool-metrics";
import { DepositPreview } from "@/components/deposit-preview";
import { protocolData } from "@/lib/sample-data";
import { dollars } from "@/lib/format";

export const metadata: Metadata = { title: "Investment pool" };

export default async function PoolPage() {
  const pool = await protocolData.getPool();
  return (
    <>
      <PageIntro
        eyebrow="The investment pool"
        title="One pool. Shared exposure."
      >
        <p>
          The proposed pool brings capital together to fund selected legal
          claims. Explore its structure and preview how a deposit could
          translate into shares.
        </p>
      </PageIntro>
      <section className="pool-surface" aria-labelledby="pool-name">
        <div className="pool-heading">
          <div>
            <div className="eyebrow">{pool.id}</div>
            <h2 id="pool-name">{pool.name}</h2>
          </div>
          <Badge>Proposed · Not open for investment</Badge>
        </div>
        <p className="pool-strategy">
          Proposed strategy: fund commercial claims after legal and financial
          review, with capital spread across cases. Allocation limits and
          eligibility rules are pending.
        </p>
        <div className="sample-strip">
          <Badge dark>Sample data</Badge>
          <p>
            All cases and amounts below are fictional. No cases have been funded
            by this demonstration.
          </p>
        </div>
        <PoolMetrics pool={pool} target />
        <p className="target-note">
          The 10–12% annualized target is an unvalidated assumption, not a
          forecast or a demonstrated return. Fees and the method for calculating
          a net target are pending.
        </p>
        <div className="pool-deposit-row">
          <div>
            <h3>Explore a deposit, without moving funds.</h3>
            <p>Test dollars only. No wallet connection required.</p>
          </div>
          <DepositPreview
            sharePriceCents={pool.sharePriceCents}
            sharesOutstanding={pool.sharesOutstanding}
          />
        </div>
      </section>
      <section className="content-section" aria-labelledby="allocations-title">
        <div className="section-top">
          <div>
            <SectionLabel index="01">Sample allocations</SectionLabel>
            <h2 id="allocations-title">A view into the portfolio.</h2>
          </div>
          <span className="mono muted">03 FICTIONAL CASES</span>
        </div>
        <div
          className="table-scroll"
          role="region"
          aria-label="Sample case allocations"
          tabIndex={0}
        >
          <table className="data-table">
            <caption>
              Fictional commitments. Resolution windows start at assumed funding
              and exclude collection delays.
            </caption>
            <thead>
              <tr>
                <th scope="col">Case / claim</th>
                <th scope="col" className="numeric">
                  Committed amount
                </th>
                <th scope="col">Current status</th>
                <th scope="col">Est. resolution</th>
              </tr>
            </thead>
            <tbody>
              {pool.allocations.map((allocation) => (
                <tr key={allocation.id}>
                  <th scope="row">
                    <span className="mono">{allocation.id}</span>
                    <span className="table-secondary">{allocation.claim}</span>
                  </th>
                  <td className="numeric">
                    {dollars(allocation.committedCents)}
                  </td>
                  <td>
                    <Badge>{allocation.status}</Badge>
                  </td>
                  <td>{allocation.resolutionWindow}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total committed</th>
                <td className="numeric">{dollars(pool.allocatedCents)}</td>
                <td colSpan={2}>62.5% of sample deposits</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
      <section className="split-section section-rule">
        <div>
          <SectionLabel index="02">What investors receive</SectionLabel>
          <h2>
            An interest in
            <br />
            eventual distributions.
          </h2>
        </div>
        <div className="reading-copy">
          <p>
            Pool shares would represent a proportional interest in distributions
            from the pool. Payments would depend on collected recoveries after
            the pool’s costs and contractual obligations.
          </p>
          <p>
            A successful case does not guarantee an investment profit. Capital
            can be lost, including in full. Withdrawals would depend on the
            pool’s terms and available funds; immediate redemption is not
            promised.
          </p>
          <p>
            The legal structure, share pricing, fees, and withdrawal rules are
            still being developed.
          </p>
          <div className="inline-links">
            <TextLink href="/docs/pool-shares">How shares work</TextLink>
            <TextLink href="/docs/risks">Read the risks</TextLink>
          </div>
        </div>
      </section>
    </>
  );
}
