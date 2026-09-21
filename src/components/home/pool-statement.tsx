import type { CSSProperties } from "react";
import { Badge, SectionHead, SectionLabel, TextLink } from "@/components/ui";
import { Reveal, Stagger } from "@/components/motion/reveal";
import { PoolMetrics } from "@/components/pool-metrics";
import { DepositPreview } from "@/components/deposit-preview";
import type { PoolSnapshot } from "@/lib/types";
import { dollars, number } from "@/lib/format";

/** Custom properties are how a segment is sequenced, so the style type admits them. */
type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** Every resolution window is drawn against the same five year ruler. */
const TRACK_MONTHS = 60;

/**
 * Reads "18–30 months" off an allocation. Returns null rather than guessing, so
 * a window written some other way simply loses its track and keeps its text.
 */
function windowMonths(text: string): { from: number; to: number } | null {
  const match = text.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (!match) return null;
  const from = Number(match[1]);
  const to = Number(match[2]);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (to <= from || to > TRACK_MONTHS) return null;
  return { from, to };
}

function share(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${number((part / whole) * 100, 1)}%`;
}

/**
 * Owner: page-sections engineer. The pool's own page, folded into the home
 * page: the metrics ledger and the deposit preview that used to live at /pool.
 *
 * Contracts this section carries for the e2e suite:
 *  - it owns the only `.metrics` block on the site, and the row containing
 *    "Total deposits" holds a `dd` reading "$1,000,000"
 *  - it owns the only button named "Preview deposit" on the home page
 *  - only the deposit dialog may use role=alert or role=status on this page
 */
export function PoolStatement({ pool }: { pool: PoolSnapshot }) {
  const allocations = pool.allocations;

  return (
    <section id="pool-statement" className="stmt section">
      <div className="shell">
        <Reveal className="stmt-head">
          {/* Both sentences from the old page intro, carried verbatim into the
              one continuation line so the head keeps a single muted voice
              instead of stacking two subtitles.

              The lead deliberately does not open with "One pool." The terminal
              directly above already does, and two consecutive heads starting
              on the same two words read as one section written twice. */}
          <SectionHead eyebrow="The investment pool" lead="The pool on paper.">
            The proposed pool brings capital together to fund selected legal
            claims. Explore its structure and preview how a deposit could
            translate into shares.
          </SectionHead>
        </Reveal>

        <Reveal className="stmt-panel-outer" delay={80}>
          <div className="stmt-panel glass-frame">
            <div className="stmt-body">
              {/* The pool's name and its standing, and nothing else. A mono
                  `SP-POOL-01` used to sit above the name; an invented system
                  identifier for a pool the reader can only see one of is
                  chrome, not data, and it has gone the way of the fake
                  `suitor://` path and the sample-data chip on the terminal. */}
              <div className="stmt-top">
                <h3 className="stmt-name">{pool.name}</h3>
                <Badge>Proposed · Not open for investment</Badge>
              </div>

              <p className="stmt-strategy">
                Proposed strategy: fund commercial claims after legal and
                financial review, with capital spread across cases. Allocation
                limits and eligibility rules are pending.
              </p>

              <div className="stmt-sample glass">
                <Badge dark>Sample data</Badge>
                <p>
                  All cases and amounts below are fictional. No cases have been
                  funded by this demonstration.
                </p>
              </div>

              <PoolMetrics pool={pool} target />

              {/* No capital bar here. The terminal above draws the same split
                  live, segment by segment, and you can hover it; a second
                  static copy of it under the same data was the page repeating
                  itself. Where each dollar went is the table further down. */}

              <p className="stmt-target-note">
                The 10–12% annualized target is an unvalidated assumption, not a
                forecast or a demonstrated return. Fees and the method for
                calculating a net target are pending.
              </p>
            </div>

            <div className="stmt-deposit">
              <div className="stmt-deposit-copy">
                <h3>Explore a deposit, without moving funds.</h3>
                <p>Test dollars only. No wallet connection required.</p>
              </div>
              <DepositPreview
                sharePriceCents={pool.sharePriceCents}
                sharesOutstanding={pool.sharesOutstanding}
              />
            </div>
          </div>
        </Reveal>

        {/* A hairline, not an engraved band. The line-work is the footer's
            closing mark and appears nowhere else on the site. */}
        <div className="stmt-divider" aria-hidden="true" />

        <Reveal className="stmt-table-head">
          <SectionLabel>Sample allocations</SectionLabel>
          <h3>A view into the portfolio.</h3>
          <p className="stmt-table-count small muted">3 fictional cases</p>
        </Reveal>

        <Reveal className="stmt-table-outer" delay={60}>
          <div className="stmt-table-card glass">
            {/* The note sits outside the scroller on purpose. A `caption` is
                laid out on the table's own width, so inside an `overflow-x`
                box this sentence was set to 635px in a 336px card and sliced
                off mid-word at 390. Out here it wraps to the card, and the
                table keeps it as its description. */}
            <p className="stmt-table-note small" id="stmt-table-note">
              Fictional commitments. Resolution windows start at assumed funding
              and exclude collection delays.
            </p>
            <div
              className="table-scroll"
              role="region"
              aria-label="Sample case allocations"
              aria-describedby="stmt-table-note"
              tabIndex={0}
            >
              <table className="data-table stmt-table">
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
                  {allocations.map((allocation, index) => {
                    const span = windowMonths(allocation.resolutionWindow);
                    return (
                      <tr key={allocation.id} className="stmt-row">
                        <th scope="row">
                          <span className="mono ix-row-n">{allocation.id}</span>
                          <span className="table-secondary">
                            {allocation.claim}
                          </span>
                        </th>
                        <td className="numeric">
                          {dollars(allocation.committedCents)}
                        </td>
                        <td>
                          <Badge>{allocation.status}</Badge>
                        </td>
                        <td>
                          <span className="stmt-window tnum">
                            {allocation.resolutionWindow}
                          </span>
                          {span ? (
                            <span className="stmt-track" aria-hidden="true">
                              <span
                                className="stmt-band ix-grow-x"
                                style={
                                  {
                                    "--i": index,
                                    left: `${(span.from / TRACK_MONTHS) * 100}%`,
                                    width: `${((span.to - span.from) / TRACK_MONTHS) * 100}%`,
                                  } as Vars
                                }
                              />
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total committed</th>
                    <td className="numeric">{dollars(pool.allocatedCents)}</td>
                    <td colSpan={2}>
                      {share(pool.allocatedCents, pool.totalDepositsCents)} of
                      sample deposits
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="stmt-scale small muted">
              Each window is drawn against a 60 month ruler, measured from
              assumed funding.
            </p>
          </div>
        </Reveal>

        <div className="stmt-receive">
          <Reveal className="stmt-receive-head">
            <SectionLabel>What investors receive</SectionLabel>
            <h3>An interest in eventual distributions.</h3>
          </Reveal>
          <Stagger className="stmt-receive-copy" step={70}>
            <p>
              Pool shares would represent a proportional interest in
              distributions from the pool. Payments would depend on collected
              recoveries after the pool’s costs and contractual obligations.
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
            <div className="stmt-links">
              <TextLink href="/docs/pool-shares">How shares work</TextLink>
              <TextLink href="/docs/risks">Read the risks</TextLink>
            </div>
          </Stagger>
        </div>
      </div>
    </section>
  );
}
