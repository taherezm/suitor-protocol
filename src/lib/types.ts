/** View contracts for future data services. Amounts are integer test-dollar cents. */
export interface Allocation {
  id: string;
  claim: string;
  committedCents: number;
  status: "Discovery" | "Pre-trial" | "Pleadings";
  resolutionWindow: string;
}

export interface PoolSnapshot {
  id: string;
  name: string;
  mode: "sample";
  totalDepositsCents: number;
  allocatedCents: number;
  availableCents: number;
  sharePriceCents: number;
  sharesOutstanding: number;
  allocations: readonly Allocation[];
}

export interface CaseAssessment {
  id: string;
  claim: string;
  requestedCents: number;
  stage: string;
  proposedTerms: string;
  assumptions: readonly { label: string; value: string }[];
}

export interface ProtocolDataSource {
  getPool(): Promise<PoolSnapshot>;
  getAssessment(): Promise<CaseAssessment>;
  getOutcomePreview(): Promise<OutcomePreview>;
}

/** Assumption-based scenarios only. No estimated probabilities or model scores. */
export interface OutcomePreview {
  mode: "methodology-preview";
  fundedCents: number;
  scenarios: readonly {
    label: string;
    receiptsCents: number;
    monthsToCash: number;
    capitalEffect: string;
  }[];
}

export interface DepositQuote {
  amountCents: number;
  shares: number;
  ownershipPercent: number;
  sharePriceCents: number;
}

export interface SimulatedReceipt {
  mode: "simulated";
  quote: DepositQuote;
}

/** Live execution must use a separate, explicitly authorized wallet adapter. */
export interface DemoDepositGateway {
  mode: "simulated";
  submit(quote: DepositQuote): Promise<SimulatedReceipt>;
}
