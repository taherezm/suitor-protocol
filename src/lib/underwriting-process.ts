/** The four checks before capital is committed. A person approves each one. */
export interface UnderwritingStep {
  readonly title: string;
  readonly text: string;
}

export const underwritingProcess: readonly UnderwritingStep[] = [
  {
    title: "Understand the legal claim",
    text: "Review the cause of action, available evidence, defenses, and procedural position. Identify what remains unverified.",
  },
  {
    title: "Examine the funding request",
    text: "Assess counsel’s budget and the costs still needed to reach resolution. Test whether the proposed terms justify the exposure.",
  },
  {
    title: "Consider recovery and timing",
    text: "Examine possible recoveries, the ability to collect them, and the expected time to payment. Include the effects of appeals and delays.",
  },
  {
    title: "Require operator approval",
    text: "An operator reviews the assessment and supporting documents before approving an allocation. A model estimate would inform this review, not authorize funding.",
  },
];
