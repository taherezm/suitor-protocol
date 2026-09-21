import { Badge } from "@/components/ui";
import type { PoolSnapshot } from "@/lib/types";
import { dollars, number } from "@/lib/format";

/**
 * The pool's terms, as a ledger.
 *
 * Deliberately not the pool's position: how much is allocated and how much is
 * still open is what the terminal upstairs shows live, with a capital bar you
 * can hover, and repeating those two figures under it was the page saying the
 * same thing twice in a row. What is left here is what the terminal does not
 * carry: the size of the pool, how it is divided into shares, and the target
 * that is only ever an assumption.
 *
 * This is the only `.metrics` block on the site, and the row reading "Total
 * deposits" is what the e2e suite checks for "$1,000,000", so the
 * `dl.metrics > div > dt + dd` shape stays exactly as it is.
 */
export function PoolMetrics({
  pool,
  target = false,
}: {
  pool: PoolSnapshot;
  target?: boolean;
}) {
  return (
    <dl className={`metrics${target ? " metrics-four" : ""}`}>
      <div>
        <dt>Total deposits</dt>
        <dd>
          <span className="metric-figure platinum-text">
            {dollars(pool.totalDepositsCents)}
          </span>
          <span className="metric-note">Sample capital</span>
        </dd>
      </div>
      <div>
        <dt>Shares outstanding</dt>
        <dd>
          <span className="metric-figure platinum-text">
            {number(pool.sharesOutstanding)}
          </span>
          <span className="metric-note">Illustrative issuance</span>
        </dd>
      </div>
      <div>
        <dt>Price per share</dt>
        <dd>
          <span className="metric-figure platinum-text">
            {dollars(pool.sharePriceCents, 2)}
          </span>
          <span className="metric-note">Test dollars, fixed for the demo</span>
        </dd>
      </div>
      {/* The one entry on this ledger that is not a measured figure. Three
          facts sit to the left of it in filled platinum, and set the same way
          this read as a fourth. It is drawn hollow instead, and its label
          carries the caveat, so the difference is visible before the note
          under it is read. */}
      {target && (
        <div>
          <dt className="metric-dt">
            Illustrative target
            <Badge>Unvalidated assumption</Badge>
          </dt>
          <dd>
            <span className="metric-figure metric-figure-hollow">10–12%</span>
            <span className="metric-unit"> / yr</span>
            <span className="metric-note">
              Not a forecast and not a demonstrated return
            </span>
          </dd>
        </div>
      )}
    </dl>
  );
}
