import assert from "node:assert/strict";
import test from "node:test";
import {
  demoDepositGateway,
  quoteDeposit,
  validateAmount,
} from "../src/lib/deposit.ts";
import { samplePool } from "../src/lib/sample-data.ts";

test("validates decimal amounts without floating point rounding", () => {
  for (const [input, cents] of [
    ["1", 100],
    ["1.01", 101],
    [" 1000.25 ", 100025],
    ["1000000", 100000000],
    ["10.", 1000],
  ] as const) {
    assert.deepEqual(validateAmount(input), { valid: true, cents });
  }
});

test("rejects missing, malformed, negative, out-of-range, and over-precise amounts", () => {
  for (const input of [
    "",
    " ",
    "0",
    ".99",
    "-100",
    "abc",
    "NaN",
    "Infinity",
    "1e3",
    "0x10",
    "1,000",
    "1.001",
    "1000000.01",
    "999999999999999999999999",
    "1 00",
  ]) {
    assert.equal(validateAmount(input).valid, false, input);
  }
});

test("ownership uses shares outstanding after issuance", () => {
  const quote = quoteDeposit(100000, 100, 1000000);
  assert.equal(quote.shares, 1000);
  assert.equal(quote.ownershipPercent, (1000 / 1001000) * 100);
  assert.equal(quote.amountCents, 100000);
  assert.equal(quoteDeposit(10001, 100, 1000000).shares, 100.01);
  assert.equal(quoteDeposit(100000000, 100, 1000000).ownershipPercent, 50);
});

test("invalid share-pricing inputs cannot create a quote", () => {
  for (const amount of [0, -1, 100000001, 100.1, NaN, Infinity])
    assert.throws(() => quoteDeposit(amount, 100, 1000000));
  for (const price of [0, -1, 0.1, NaN, Infinity])
    assert.throws(() => quoteDeposit(100, price, 1000000));
  for (const shares of [-1, NaN, Infinity])
    assert.throws(() => quoteDeposit(100, 100, shares));
});

test("fictional commitments reconcile with pool totals", () => {
  assert.equal(
    samplePool.allocations.reduce((sum, row) => sum + row.committedCents, 0),
    samplePool.allocatedCents,
  );
  assert.equal(
    samplePool.allocatedCents + samplePool.availableCents,
    samplePool.totalDepositsCents,
  );
  assert.equal(
    samplePool.sharesOutstanding * samplePool.sharePriceCents,
    samplePool.totalDepositsCents,
  );
});

test("demo returns a simulated receipt and leaves the sample pool unchanged", async () => {
  const before = JSON.stringify(samplePool);
  const quote = quoteDeposit(
    100000,
    samplePool.sharePriceCents,
    samplePool.sharesOutstanding,
  );
  const receipt = await demoDepositGateway.submit(quote);
  assert.equal(receipt.mode, "simulated");
  assert.deepEqual(receipt.quote, quote);
  assert.equal(JSON.stringify(samplePool), before);
});
