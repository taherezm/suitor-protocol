import type { DemoDepositGateway, DepositQuote } from "./types.ts";

export const MIN_DEPOSIT_CENTS = 100;
export const MAX_DEPOSIT_CENTS = 100_000_000;

export type AmountResult =
  | { valid: true; cents: number }
  | { valid: false; error: string };

export function validateAmount(value: string): AmountResult {
  const text = value.trim();
  if (!text) return { valid: false, error: "Enter an amount in test dollars." };
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(text)) {
    return {
      valid: false,
      error:
        "Use a positive number with up to two decimal places, without commas.",
    };
  }
  const [whole = "0", fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_DEPOSIT_CENTS) {
    return {
      valid: false,
      error: "The demo limit is $1,000,000 in test dollars.",
    };
  }
  if (cents < MIN_DEPOSIT_CENTS)
    return { valid: false, error: "Enter at least $1.00 in test dollars." };
  return { valid: true, cents };
}

export function quoteDeposit(
  amountCents: number,
  sharePriceCents: number,
  sharesOutstanding: number,
): DepositQuote {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents < MIN_DEPOSIT_CENTS ||
    amountCents > MAX_DEPOSIT_CENTS
  ) {
    throw new Error("Invalid demo deposit amount.");
  }
  if (
    !Number.isSafeInteger(sharePriceCents) ||
    sharePriceCents <= 0 ||
    !Number.isFinite(sharesOutstanding) ||
    sharesOutstanding < 0
  ) {
    throw new Error("Invalid sample pool assumptions.");
  }
  const shares = amountCents / sharePriceCents;
  return {
    amountCents,
    sharePriceCents,
    shares,
    ownershipPercent: (shares / (sharesOutstanding + shares)) * 100,
  };
}

/** In-memory only. Never signs, broadcasts, transfers, or persists a transaction. */
export const demoDepositGateway: DemoDepositGateway = {
  mode: "simulated",
  async submit(quote) {
    return { mode: "simulated", quote };
  },
};
