import Link from "next/link";
import { Arrow, Badge, SectionLabel, TextLink } from "@/components/ui";
import { PoolMetrics } from "@/components/pool-metrics";
import { protocolData } from "@/lib/sample-data";

export default async function Home() {
  const pool = await protocolData.getPool();
  return (
    <>
      <section className="home-hero">
        <div className="hero-meta">
          <p className="eyebrow">A proposed protocol on Solana</p>
          <span className="mono">FOUNDATION / 01</span>
        </div>
        <h1>
          Litigation funding
          <br />
          on Solana.
        </h1>
        <div className="hero-bottom">
          <p>
            Suitor is being built to connect investor capital with litigation
            funding. Review how cases are evaluated and explore the proposed
            investment pool.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/pool">
              Explore the pool
              <Arrow />
            </Link>
            <Link className="button button-secondary" href="/docs/whitepaper">
              Read the whitepaper
              <Arrow diagonal />
            </Link>
          </div>
        </div>
      </section>
      <section
        className="home-pool section-rule"
        aria-labelledby="pool-heading"
      >
        <div className="section-top">
          <div>
            <SectionLabel index="01">The proposed pool</SectionLabel>
            <h2 id="pool-heading">Capital with a defined purpose.</h2>
          </div>
          <Badge>Sample data</Badge>
        </div>
        <p className="section-description">
          An illustrative pool for commercial legal claims. These figures
          describe a possible structure, not funded cases or investment
          performance.
        </p>
        <PoolMetrics pool={pool} />
        <div
          className="allocation-bar"
          role="img"
          aria-label="Sample capital: 62.5 percent allocated, 37.5 percent available"
        >
          <span
            style={{
              width: `${(pool.allocatedCents / pool.totalDepositsCents) * 100}%`,
            }}
          />
        </div>
        <div className="pool-preview-bottom">
          <div className="legend">
            <span>
              <i className="legend-allocated" />
              Allocated · 62.5%
            </span>
            <span>
              <i className="legend-available" />
              Available · 37.5%
            </span>
          </div>
          <TextLink href="/pool">Review the pool</TextLink>
        </div>
      </section>
      <section className="home-explain section-rule">
        <div>
          <SectionLabel index="02">From funding to recovery</SectionLabel>
          <h2>
            A share in the pool.
            <br />
            Exposure to its outcomes.
          </h2>
        </div>
        <div className="explain-rows">
          <div>
            <h3>Investors hold pool shares.</h3>
            <p>
              Shares would represent a proportional interest in eventual pool
              distributions. Collected recoveries could support those
              distributions after costs and obligations.
            </p>
            <TextLink href="/docs/pool-shares">Understand pool shares</TextLink>
          </div>
          <div>
            <h3>Every allocation starts with a review.</h3>
            <p>
              The proposed process examines the claim and its economics before
              an operator approves funding. Capital can be lost. Withdrawals
              would depend on pool terms and available funds.
            </p>
            <TextLink href="/underwriting">
              See the underwriting process
            </TextLink>
          </div>
        </div>
      </section>
    </>
  );
}
