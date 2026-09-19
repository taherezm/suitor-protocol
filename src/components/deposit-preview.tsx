"use client";

import { useEffect, useRef, useState } from "react";
import { Arrow, Badge } from "./ui";
import { dollars, number } from "@/lib/format";
import {
  demoDepositGateway,
  quoteDeposit,
  validateAmount,
} from "@/lib/deposit";
import type { DepositQuote } from "@/lib/types";

export function DepositPreview({
  sharePriceCents,
  sharesOutstanding,
}: {
  sharePriceCents: number;
  sharesOutstanding: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const [step, setStep] = useState<"amount" | "review" | "complete">("amount");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<DepositQuote | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (dialog.current?.open) {
      if (step === "amount") amountInput.current?.focus();
      else heading.current?.focus();
    }
  }, [step]);

  function open() {
    setStep("amount");
    setAmount("");
    setError("");
    setQuote(null);
    dialog.current?.showModal();
    amountInput.current?.focus();
  }

  function close() {
    dialog.current?.close();
  }

  function keepFocusInDialog(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), a[href], [tabindex='0']",
      ),
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        !controls.includes(document.activeElement as HTMLElement))
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function review(event: React.FormEvent) {
    event.preventDefault();
    const result = validateAmount(amount);
    if (!result.valid) {
      setError(result.error);
      amountInput.current?.focus();
      return;
    }
    try {
      setQuote(quoteDeposit(result.cents, sharePriceCents, sharesOutstanding));
      setError("");
      setStep("review");
    } catch {
      setError(
        "The sample quote could not be prepared. Close the preview and try again.",
      );
    }
  }

  async function submit() {
    if (!quote || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await demoDepositGateway.submit(quote);
      setStep("complete");
    } catch {
      setError("The simulation could not complete. Please try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button ref={trigger} className="button button-primary" onClick={open}>
        Preview deposit
        <Arrow />
      </button>
      <dialog
        ref={dialog}
        className="deposit-dialog"
        aria-labelledby="deposit-title"
        aria-describedby="demo-disclosure"
        onClose={() => trigger.current?.focus()}
        onKeyDown={keepFocusInDialog}
      >
        <div className="dialog-top">
          <Badge>Demo · Test dollars only</Badge>
          <button
            className="close-button"
            aria-label="Close deposit preview"
            onClick={close}
          >
            ×
          </button>
        </div>
        <p className="eyebrow dialog-step">
          {step === "amount"
            ? "Step 01 / Amount"
            : step === "review"
              ? "Step 02 / Review"
              : "Preview complete"}
        </p>
        <h2 ref={heading} tabIndex={-1} id="deposit-title">
          {step === "amount"
            ? "Preview your deposit."
            : step === "review"
              ? "Review the illustration."
              : "Deposit simulated."}
        </h2>
        <p id="demo-disclosure" className="dialog-description">
          {step === "complete"
            ? "No funds moved, no wallet was connected, and no real pool shares were issued."
            : "This is a simulation. No real funds or wallet signature are required."}
        </p>
        {step === "amount" && (
          <form onSubmit={review} noValidate>
            <label htmlFor="deposit-amount" className="input-label">
              Amount in test dollars
            </label>
            <div className={`amount-input${error ? " input-invalid" : ""}`}>
              <span aria-hidden="true">$</span>
              <input
                ref={amountInput}
                id="deposit-amount"
                type="text"
                inputMode="decimal"
                placeholder="1000.00"
                autoComplete="off"
                maxLength={24}
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError("");
                }}
                aria-invalid={!!error}
                aria-describedby={
                  error ? "amount-hint deposit-error" : "amount-hint"
                }
              />
            </div>
            <p className="small muted" id="amount-hint">
              $1.00 minimum · $1,000,000 demo limit. Enter digits without
              commas.
            </p>
            {error && (
              <p className="form-error" role="alert" id="deposit-error">
                {error}
              </p>
            )}
            <div className="demo-assumptions">
              <span>Assumed share price</span>
              <strong>{dollars(sharePriceCents, 2)} in test dollars</strong>
              <p>
                For this illustration only. Live share pricing and fees are
                pending.
              </p>
            </div>
            <button className="button button-primary button-full" type="submit">
              Review share allocation
              <Arrow />
            </button>
          </form>
        )}
        {step !== "amount" && quote && (
          <>
            <dl className="quote-rows">
              <div>
                <dt>Simulated deposit</dt>
                <dd>
                  {dollars(quote.amountCents, 2)}
                  <span>test dollars</span>
                </dd>
              </div>
              <div>
                <dt>Illustrative shares</dt>
                <dd>
                  {number(quote.shares)}
                  <span>at {dollars(quote.sharePriceCents, 2)} per share</span>
                </dd>
              </div>
              <div>
                <dt>Share of sample pool</dt>
                <dd>
                  {number(quote.ownershipPercent, 6)}%
                  <span>after this simulated issuance</span>
                </dd>
              </div>
            </dl>
            {step === "review" ? (
              <>
                <p className="small muted">
                  Assumes {number(sharesOutstanding)} existing shares and no
                  fees. Shares are a proportional interest in eventual
                  distributions, not a promise of repayment. Capital can be
                  lost.
                </p>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="button button-primary button-full"
                  onClick={submit}
                  disabled={busy}
                >
                  {busy ? "Simulating…" : "Complete simulated deposit"}
                  <Arrow />
                </button>
                <button
                  className="back-button"
                  onClick={() => {
                    setStep("amount");
                    setError("");
                  }}
                  disabled={busy}
                >
                  Back to amount
                </button>
              </>
            ) : (
              <>
                <p className="confirmation-note" role="status">
                  Your deposit was simulated. This preview is not saved and does
                  not change the sample pool totals.
                </p>
                <button
                  className="button button-primary button-full"
                  onClick={close}
                >
                  Return to the pool
                  <Arrow />
                </button>
              </>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
