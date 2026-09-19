import type { PoolSnapshot } from "@/lib/types";
import { dollars } from "@/lib/format";

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
          {dollars(pool.totalDepositsCents)}
          <span className="metric-note">Sample capital</span>
        </dd>
      </div>
      <div>
        <dt>Allocated capital</dt>
        <dd>
          {dollars(pool.allocatedCents)}
          <span className="metric-note">Fictional commitments</span>
        </dd>
      </div>
      <div>
        <dt>Available capital</dt>
        <dd>
          {dollars(pool.availableCents)}
          <span className="metric-note">Before reserves and costs</span>
        </dd>
      </div>
      {target && (
        <div>
          <dt>Illustrative target</dt>
          <dd>
            10–12%<span className="metric-unit"> / yr</span>
            <span className="metric-note">Unvalidated assumption</span>
          </dd>
        </div>
      )}
    </dl>
  );
}
