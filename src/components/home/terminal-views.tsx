"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { scrollToAnchor } from "@/components/motion/anchor-scroll";
import { CountUp } from "@/components/motion/count-up";
import { Reveal, Stagger } from "@/components/motion/reveal";
import { Arrow } from "@/components/ui";
import { quoteDeposit, validateAmount } from "@/lib/deposit";
import { dollars, number } from "@/lib/format";
import type {
  CaseAssessment,
  DepositQuote,
  OutcomePreview,
  PoolSnapshot,
} from "@/lib/types";

/* The four panels of the pool terminal. Every figure here comes from the props
   the page loaded; nothing on this screen is invented, and nothing it does
   leaves the browser.

   Owner: terminal agent. Styles live in src/styles/terminal.css. */

/** The whole life of a funded claim, and the axis every track is drawn on. */
const HORIZON_MONTHS = 60;
const TICKS = [0, 12, 24, 36, 48, 60];

/* CountUp restarts whenever its `format` identity changes, so every formatter
   used by a figure on this screen is defined once, here. */
const money = (cents: number) => dollars(cents);
const shareCount = (value: number) => number(value);
const ownership = (value: number) => `${number(value, 6)}%`;

/** `18–30 months` becomes a band on the 0 to 60 month axis. */
function parseWindow(text: string): { from: number; to: number } | null {
  const match = text.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (!match) return null;
  const from = Number(match[1]);
  const to = Number(match[2]);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  return {
    from: Math.min(from, HORIZON_MONTHS),
    to: Math.min(to, HORIZON_MONTHS),
  };
}

function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/**
 * A figure that tweens from whatever it was showing to its new value.
 *
 * It writes into its own text node rather than through state, so typing in the
 * quote field does not re-render the panel sixty times a second. The server
 * renders the true value, and the true value is what is left behind if the
 * tween is interrupted.
 */
function Tick({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const from = shown.current;
    if (
      from === value ||
      !document.documentElement.classList.contains("motion-ready")
    ) {
      shown.current = value;
      element.textContent = format(value);
      return;
    }

    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / 300);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (value - from) * eased;
      shown.current = current;
      element.textContent = format(current);
      if (progress < 1) frame = requestAnimationFrame(step);
      else {
        shown.current = value;
        element.textContent = format(value);
      }
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      shown.current = value;
      element.textContent = format(value);
    };
  }, [value, format]);

  return (
    <span ref={ref} className="tnum" suppressHydrationWarning>
      {format(value)}
    </span>
  );
}

/* ---------- Overview ---------- */

export function OverviewView({ pool }: { pool: PoolSnapshot }) {
  const [hot, setHot] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const lit = pinned ?? hot;
  const allocatedPercent = percent(
    pool.allocatedCents,
    pool.totalDepositsCents,
  );

  return (
    <div className="term-view term-overview">
      <Reveal className="term-price">
        <p className="term-price-figure platinum-text tnum">
          {dollars(pool.sharePriceCents, 2)}
        </p>
        <p className="term-price-label">Share price, test dollars</p>
      </Reveal>

      <Stagger className="term-stats" step={70}>
        <div className="term-stat glass ix-card">
          <p className="term-stat-label">Total deposits</p>
          <p className="term-stat-value">
            <CountUp value={pool.totalDepositsCents} format={money} />
          </p>
          <p className="term-stat-note">Sample capital in the pool</p>
        </div>
        <div className="term-stat glass ix-card">
          <p className="term-stat-label">Allocated</p>
          <p className="term-stat-value">
            <CountUp value={pool.allocatedCents} format={money} />
          </p>
          <p className="term-stat-note">
            {number(allocatedPercent, 1)}% of deposits, across{" "}
            {pool.allocations.length} claims
          </p>
        </div>
        <div className="term-stat glass ix-card">
          <p className="term-stat-label">Available</p>
          <p className="term-stat-value">
            <CountUp value={pool.availableCents} format={money} />
          </p>
          <p className="term-stat-note">Uncommitted, before reserves</p>
        </div>
      </Stagger>

      <Reveal as="figure" className="term-capital">
        <figcaption className="term-capital-head">
          <span className="term-cap-title">Where the capital sits</span>
          <span className="mono muted">
            {number(allocatedPercent, 1)}% committed
          </span>
        </figcaption>

        <div className="term-bar">
          {pool.allocations.map((allocation, index) => (
            <button
              key={allocation.id}
              type="button"
              className="term-seg ix-grow-x"
              style={
                {
                  "--i": index,
                  flexGrow: allocation.committedCents,
                } as CSSProperties
              }
              aria-pressed={pinned === allocation.id}
              aria-label={`${allocation.id}, ${allocation.claim}, ${dollars(
                allocation.committedCents,
              )} committed`}
              data-lit={lit === allocation.id ? "" : undefined}
              onPointerEnter={() => setHot(allocation.id)}
              onPointerLeave={() => setHot(null)}
              onFocus={() => setHot(allocation.id)}
              onBlur={() => setHot(null)}
              onClick={() =>
                setPinned((current) =>
                  current === allocation.id ? null : allocation.id,
                )
              }
            />
          ))}
          <span
            className="term-seg term-seg-open ix-grow-x"
            aria-hidden="true"
            style={
              {
                "--i": pool.allocations.length,
                flexGrow: pool.availableCents,
              } as CSSProperties
            }
          />
        </div>

        <ul className="term-legend">
          {pool.allocations.map((allocation) => (
            <li
              key={allocation.id}
              className="term-legend-row"
              data-lit={lit === allocation.id ? "" : undefined}
              onPointerEnter={() => setHot(allocation.id)}
              onPointerLeave={() => setHot(null)}
            >
              <span className="term-swatch" aria-hidden="true" />
              <span className="mono term-legend-id">{allocation.id}</span>
              <span className="term-legend-claim">{allocation.claim}</span>
              <span className="mono term-legend-amount">
                {dollars(allocation.committedCents)}
              </span>
            </li>
          ))}
          <li className="term-legend-row term-legend-open">
            <span className="term-swatch term-swatch-open" aria-hidden="true" />
            <span className="mono term-legend-id">Open</span>
            <span className="term-legend-claim">Available capital</span>
            <span className="mono term-legend-amount">
              {dollars(pool.availableCents)}
            </span>
          </li>
        </ul>
      </Reveal>
    </div>
  );
}

/* ---------- Allocations ---------- */

function Track({
  from,
  to,
  open,
}: {
  from: number;
  to: number;
  open?: boolean;
}) {
  return (
    <div className="term-track" aria-hidden="true">
      <span className="term-track-rule" />
      <span
        className={open ? "term-track-band term-band-open" : "term-track-band"}
        style={{
          left: `${percent(from, HORIZON_MONTHS)}%`,
          width: `${percent(to - from, HORIZON_MONTHS)}%`,
        }}
      >
        <span className="term-track-fill ix-grow-x" />
      </span>
      <span className="term-ticks mono">
        {TICKS.map((month) => (
          <span
            key={month}
            className="term-tick"
            style={{ left: `${percent(month, HORIZON_MONTHS)}%` }}
          >
            {month}
          </span>
        ))}
      </span>
    </div>
  );
}

export function AllocationsView({
  pool,
  assessment,
}: {
  pool: PoolSnapshot;
  assessment: CaseAssessment;
}) {
  const timing = assessment.assumptions.find(
    (assumption) => assumption.label === "Timing assumption",
  );
  const pending = timing ? parseWindow(timing.value) : null;

  return (
    <div className="term-view term-alloc">
      <div className="term-cols" aria-hidden="true">
        <span>Case</span>
        <span>Claim</span>
        <span className="term-right">Committed</span>
        <span>Stage</span>
        <span>Window</span>
        <span>Months from funding</span>
      </div>

      <Stagger className="term-rows" step={70}>
        {pool.allocations.map((allocation) => {
          const span = parseWindow(allocation.resolutionWindow);
          return (
            <div className="term-row ix-row" key={allocation.id}>
              <span className="ix-row-n term-cell-id">{allocation.id}</span>
              <span className="ix-row-label term-cell-claim">
                {allocation.claim}
              </span>
              <span className="mono term-cell-amount">
                {dollars(allocation.committedCents)}
              </span>
              <span className="term-phase">{allocation.status}</span>
              <span className="mono term-cell-window">
                {allocation.resolutionWindow}
              </span>
              {span ? (
                <Track from={span.from} to={span.to} />
              ) : (
                <span className="term-track" />
              )}
            </div>
          );
        })}

        <div className="term-row term-row-pending ix-row">
          <span className="ix-row-n term-cell-id">{assessment.id}</span>
          <span className="ix-row-label term-cell-claim">
            {assessment.claim}
          </span>
          <span className="mono term-cell-amount">
            {dollars(assessment.requestedCents)}
          </span>
          <span className="term-phase term-phase-open">Under review</span>
          <span className="mono term-cell-window">
            {pending ? `${pending.from}–${pending.to} months` : "Not set"}
          </span>
          {pending ? (
            <Track from={pending.from} to={pending.to} open />
          ) : (
            <span className="term-track" />
          )}
        </div>
      </Stagger>

      <Reveal as="p" className="term-foot">
        <span className="term-foot-lead">
          Committed {dollars(pool.allocatedCents)} of{" "}
          {dollars(pool.totalDepositsCents)}.
        </span>{" "}
        Requested capital is drawn hollow because no one has approved it.
        Windows start at funding and exclude collection.
      </Reveal>
    </div>
  );
}

/* ---------- Deposit ---------- */

const QUICK_FILL = [100_000, 2_500_000, 25_000_000];

/** Either a quote or the reason there is not one. Never both, never neither. */
type QuoteState =
  { quote: DepositQuote; error: null } | { quote: null; error: string };

export function DepositView({ pool }: { pool: PoolSnapshot }) {
  const [amount, setAmount] = useState("1000");

  const result = useMemo<QuoteState>(() => {
    const checked = validateAmount(amount);
    if (!checked.valid) return { quote: null, error: checked.error };
    try {
      return {
        quote: quoteDeposit(
          checked.cents,
          pool.sharePriceCents,
          pool.sharesOutstanding,
        ),
        error: null,
      };
    } catch {
      return {
        quote: null,
        error: "That amount cannot be quoted against the sample pool.",
      };
    }
  }, [amount, pool.sharePriceCents, pool.sharesOutstanding]);

  return (
    <div className="term-view term-deposit">
      <div className="term-deposit-grid">
        <Reveal className="term-quote-in">
          <label className="term-field-label" htmlFor="term-quote-amount">
            Quote amount
          </label>
          <div className="term-field ix-field">
            <span className="term-field-sign" aria-hidden="true">
              $
            </span>
            <input
              id="term-quote-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              maxLength={24}
              placeholder="1000"
              value={amount}
              aria-describedby="term-quote-hint"
              onChange={(event) => setAmount(event.target.value)}
            />
            <span className="term-field-unit mono" aria-hidden="true">
              test dollars
            </span>
          </div>
          <p className="term-hint small" id="term-quote-hint">
            $1.00 minimum, $1,000,000 demo limit. Digits without commas.
          </p>
          <div className="term-quick">
            {QUICK_FILL.map((cents) => (
              <button
                key={cents}
                type="button"
                className="chip term-quick-chip"
                onClick={() => setAmount(String(cents / 100))}
              >
                {dollars(cents)}
              </button>
            ))}
          </div>

          {/* The arithmetic, written out. It fills the foot of the panel with
              the one thing the quote card cannot show, which is how the quote
              was reached, and it is hidden from assistive technology because
              every figure in it is already announced in the rows opposite. */}
          {result.quote ? (
            <div className="term-math" aria-hidden="true">
              <p className="term-math-label">How the quote is reached</p>
              <p className="mono term-math-line">
                {dollars(result.quote.amountCents, 2)} ÷{" "}
                {dollars(result.quote.sharePriceCents, 2)} ={" "}
                <b>{number(result.quote.shares)} shares</b>
              </p>
              <p className="mono term-math-line">
                {number(result.quote.shares)} ÷{" "}
                {number(pool.sharesOutstanding + result.quote.shares)} ={" "}
                <b>{number(result.quote.ownershipPercent, 6)}%</b>
              </p>
            </div>
          ) : null}
        </Reveal>

        <Reveal className="term-quote-out" delay={80}>
          <div className="term-quote-live" aria-live="polite">
            {result.quote ? (
              <dl className="term-quote-rows">
                <div>
                  <dt>Illustrative shares</dt>
                  <dd>
                    <Tick value={result.quote.shares} format={shareCount} />
                    <span>
                      at {dollars(result.quote.sharePriceCents, 2)} per share
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Share of sample pool</dt>
                  <dd>
                    <Tick
                      value={result.quote.ownershipPercent}
                      format={ownership}
                    />
                    <span>after this illustrative issuance</span>
                  </dd>
                </div>
                <div>
                  <dt>Shares outstanding after</dt>
                  <dd>
                    <Tick
                      value={pool.sharesOutstanding + result.quote.shares}
                      format={shareCount}
                    />
                    <span>
                      from {number(pool.sharesOutstanding)} before the deposit
                    </span>
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="term-quote-error">{result.error}</p>
            )}
          </div>
          <p className="term-quote-assumption small">
            Assumes {number(pool.sharesOutstanding)} existing shares and no
            fees. A share is a proportional interest in eventual distributions,
            not a promise of repayment.
          </p>
        </Reveal>
      </div>

      <Reveal className="term-quote-note" delay={160}>
        <p className="term-note">
          Simulated. Nothing is signed, sent or saved.
        </p>
        <Link
          href="/#pool-statement"
          className="text-link"
          onClick={(event) => scrollToAnchor(event, "pool-statement")}
        >
          Jump to the pool statement
          <Arrow />
        </Link>
      </Reveal>
    </div>
  );
}

/* ---------- Outcomes ----------

   The rows used to end in a small drawn path: a stroked run as long as the
   scenario's share of the horizon, solid with a filled dot where the pool is
   paid and dashed with a hollow one where it is not. It has been deleted here
   for the same reason it was deleted from the outcome cards in
   `@/components/home/outcomes`, and the two must stay consistent: the month is
   written in the row already, so the drawing was repeating it. */

export function OutcomesView({ outcomes }: { outcomes: OutcomePreview }) {
  return (
    <div className="term-view term-out">
      <Stagger className="term-rows" step={70}>
        {outcomes.scenarios.map((scenario) => (
          <div className="term-row term-out-row ix-row" key={scenario.label}>
            <span className="ix-row-label term-out-label">
              {scenario.label}
            </span>
            <span className="term-out-receipts">
              <span className="term-out-caption">Pool receives</span>
              <span className="mono term-out-amount">
                {dollars(scenario.receiptsCents)}
              </span>
            </span>
            <span className="mono term-out-month">
              Month {scenario.monthsToCash}
            </span>
            <span className="term-out-effect">{scenario.capitalEffect}</span>
          </div>
        ))}
      </Stagger>

      <Reveal as="p" className="term-foot">
        <span className="term-foot-lead">
          Every ending assumes the same {dollars(outcomes.fundedCents)}{" "}
          commitment.
        </span>{" "}
        Anything under that figure is capital that did not come back. These are
        assumptions, not forecasts, and no probability is attached to any of
        them.
      </Reveal>
    </div>
  );
}
