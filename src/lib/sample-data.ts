import type {
  CaseAssessment,
  OutcomePreview,
  PoolSnapshot,
  ProtocolDataSource,
} from "./types";

export const samplePool: PoolSnapshot = {
  id: "SP-POOL-01",
  name: "Litigation pool 01",
  mode: "sample",
  totalDepositsCents: 100_000_000,
  allocatedCents: 62_500_000,
  availableCents: 37_500_000,
  sharePriceCents: 100,
  sharesOutstanding: 1_000_000,
  allocations: [
    {
      id: "SP-001",
      claim: "Commercial contract",
      committedCents: 25_000_000,
      status: "Discovery",
      resolutionWindow: "18–30 months",
    },
    {
      id: "SP-002",
      claim: "Insurance coverage",
      committedCents: 20_000_000,
      status: "Pre-trial",
      resolutionWindow: "12–24 months",
    },
    {
      id: "SP-003",
      claim: "Commercial receivable",
      committedCents: 17_500_000,
      status: "Pleadings",
      resolutionWindow: "24–36 months",
    },
  ],
};

export const sampleAssessment: CaseAssessment = {
  id: "SP-004",
  claim: "Commercial contract dispute",
  requestedCents: 25_000_000,
  stage: "Discovery",
  proposedTerms:
    "30% of net recoveries, capped at 2× funded capital. No guaranteed principal repayment.",
  assumptions: [
    {
      label: "Claim basis",
      value:
        "A fictional supplier alleges nonpayment under a written commercial contract. Liability is disputed.",
    },
    {
      label: "Funding budget",
      value:
        "$150,000 for counsel, $60,000 for experts and discovery, and $40,000 contingency. All amounts are assumptions.",
    },
    {
      label: "Claimed damages",
      value:
        "$2,000,000 before costs. The claim amount is not an expected recovery.",
    },
    {
      label: "Recovery assumption",
      value:
        "$1,000,000 net proceeds in the settlement example. Actual recovery could be zero.",
    },
    {
      label: "Timing assumption",
      value:
        "18–30 months to resolution, followed by an assumed 3–12 months to collection. Appeals may extend both.",
    },
    {
      label: "Collection assumption",
      value:
        "The counterparty is assumed to have collectible assets. Asset verification and enforceability review are pending.",
    },
    {
      label: "Operator decision",
      value:
        "Pending in this example. An operator must review evidence, counsel’s budget, conflicts, and proposed terms before approving an allocation.",
    },
  ],
};

export const sampleOutcomes: OutcomePreview = {
  mode: "methodology-preview",
  fundedCents: 25_000_000,
  scenarios: [
    {
      label: "Settlement",
      receiptsCents: 30_000_000,
      monthsToCash: 18,
      capitalEffect: "$50,000 gain before pool fees",
    },
    {
      label: "Judgment & collection",
      receiptsCents: 50_000_000,
      monthsToCash: 36,
      capitalEffect: "$250,000 gain before pool fees",
    },
    {
      label: "Loss",
      receiptsCents: 0,
      monthsToCash: 24,
      capitalEffect: "Entire $250,000 allocation lost",
    },
    {
      label: "Favorable outcome, delayed collection",
      receiptsCents: 27_500_000,
      monthsToCash: 60,
      capitalEffect: "About 1.9% annualized before pool fees",
    },
  ],
};

/** Replace this boundary with a server-side service when live data is available. */
export const protocolData: ProtocolDataSource = {
  async getPool() {
    return samplePool;
  },
  async getAssessment() {
    return sampleAssessment;
  },
  async getOutcomePreview() {
    return sampleOutcomes;
  },
};
