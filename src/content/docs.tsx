import Link from "next/link";
import type { ReactNode } from "react";
import type { DocSlug } from "@/lib/docs-navigation";

export interface DocContent {
  title: string;
  description: string;
  draft?: boolean;
  content: ReactNode;
}

export const docs: Record<DocSlug, DocContent> = {
  overview: {
    title: "An introduction to Suitor.",
    description:
      "The proposed protocol, the website today, and what remains to be developed.",
    content: (
      <>
        <h2>What Suitor is being built to do</h2>
        <p>
          Suitor Protocol is being developed to connect investor capital with
          litigation funding on Solana. The proposed structure pools capital,
          reviews potential allocations, and gives investors shares representing
          a proportional interest in eventual pool distributions.
        </p>
        <p>
          Recoveries would come from funded claims. A favorable judgment alone
          does not create distributable cash; proceeds must be collected and the
          pool’s obligations paid.
        </p>
        <h2>What works today</h2>
        <p>
          This first version provides a website, an underwriting methodology
          preview, and an illustrative pool. The deposit flow calculates a
          sample share allocation and completes a simulation in the browser.
        </p>
        <div className="doc-note">
          <strong>All pool figures and cases are sample data.</strong>
          <p>
            The website does not accept investments, connect a wallet, or move
            funds. Simulations are not saved and do not issue real shares.
          </p>
        </div>
        <h2>What is proposed</h2>
        <p>
          Case intake and assessment, an outcome estimation service, operator
          approvals, and onchain investment operations will be developed in
          later stages. None is presented here as an operational or validated
          system.
        </p>
        <h2>Start with the mechanics</h2>
        <p>
          The <Link href="/docs/whitepaper">draft whitepaper</Link> sets out the
          initial proposal. Read{" "}
          <Link href="/docs/pool-shares">pool shares</Link> for the ownership
          illustration and <Link href="/docs/risks">risks</Link> for the factors
          that could reduce or prevent distributions.
        </p>
      </>
    ),
  },
  whitepaper: {
    title: "Suitor Protocol whitepaper.",
    description:
      "An initial proposal for pooled litigation funding on Solana. Version 0.1.",
    draft: true,
    content: (
      <>
        <div className="doc-note">
          <strong>Draft. Mechanics are not final.</strong>
          <p>
            This document describes a proposed design. The website is an
            interface preview, and no investment functionality is active.
          </p>
        </div>
        <h2>01. Purpose</h2>
        <p>
          Litigation requires capital before its outcome and timing are known.
          Suitor proposes a pool that funds selected legal claims in exchange
          for a contractual interest in recoveries. Investors would participate
          through shares in the pool.
        </p>
        <h2>02. Funding decisions</h2>
        <p>
          A proposed case would be assessed for legal merit and investment
          economics. The review would examine evidence, funding needs, potential
          recovery, and time to payment. An operator would examine the
          assessment and approve any allocation before capital is committed.
        </p>
        <p>
          A future outcome engine could support scenario estimates. It would not
          replace legal diligence or operator judgment. No prediction model,
          accuracy claim, or validated scoring system is implemented in this
          version.
        </p>
        <h2>03. Capital and distributions</h2>
        <p>
          Investors would receive shares representing a proportional interest in
          eventual pool distributions. Collected recoveries would enter the pool
          and become available for distribution subject to costs, reserves, and
          contractual obligations.
        </p>
        <p>
          The legal form of that interest, valuation policy, fees, issuance
          rules, and distribution waterfall are pending. There is no promise of
          principal repayment. Withdrawal timing would depend on final pool
          terms and available funds.
        </p>
        <h2>04. Proposed Solana role</h2>
        <p>
          Solana is the intended network for future investment operations.
          Wallet connection, asset custody, share accounting, and transaction
          execution remain to be designed and implemented. No program address or
          token is specified.
        </p>
        <p>
          The deposit asset, token standard, upgrade controls, and custody
          structure are explicitly pending. The relationship between onchain
          records and offchain contractual rights will require further work.
        </p>
        <h2>05. Targets and uncertainty</h2>
        <p>
          The sample pool displays a 10–12% annualized target as an unvalidated
          assumption. It is not a forecast or historical return. A method for
          calculating returns after fees has not been selected.
        </p>
        <p>
          Cases can fail, recoveries can be smaller than expected, and
          collections can take years. A legal victory can still produce an
          investment loss. Read the{" "}
          <Link href="/docs/risks">risk discussion</Link> alongside the sample
          pool.
        </p>
        <h2>06. Development status</h2>
        <p>
          Implemented: the website, documentation, sample case and pool views,
          and a simulated deposit flow. Pending: live underwriting, outcome
          modeling, operator workflows, wallet integration, and onchain
          execution.
        </p>
        <p>
          The project does not claim audits, model validation, partnerships, or
          legal approvals. Any production launch would require additional
          technical review and resolution of the legal and operational design.
        </p>
      </>
    ),
  },
  "pool-shares": {
    title: "Understanding pool shares.",
    description:
      "How a deposit could translate into a proportional interest in the pool.",
    content: (
      <>
        <h2>A proportional interest</h2>
        <p>
          Under the proposed structure, shares would represent a proportional
          interest in the pool’s eventual distributions. They would not be a
          claim to a fixed return or to immediate repayment of deposited
          capital.
        </p>
        <h2>An illustrative issuance</h2>
        <p>
          Assume 1,000,000 shares already exist at an illustrative price of
          $1.00 per share. A deposit of $1,000 in test dollars produces 1,000
          sample shares, bringing total shares to 1,001,000.
        </p>
        <div className="doc-formula">
          <span className="eyebrow">Illustrative ownership after issuance</span>
          <strong>1,000 ÷ 1,001,000 ≈ 0.0999%</strong>
          <p>No fees assumed. Live pricing and precision rules are pending.</p>
        </div>
        <p>
          The <Link href="/pool">pool deposit preview</Link> uses this formula.
          It does not update balances or create a persistent holding. Closing
          the preview discards the simulation.
        </p>
        <h2>Where distributions would come from</h2>
        <p>
          Collected case recoveries could support distributions after expenses
          and contractual obligations. The precise treatment of reserves, fees,
          and reinvestment is pending.
        </p>
        <p>
          A share percentage is not a return percentage. If the pool loses
          money, shares could receive less than the investor contributed or
          nothing at all.
        </p>
        <h2>Withdrawals and valuation</h2>
        <p>
          Litigation assets may remain illiquid for long periods. Withdrawals
          would depend on the final pool terms and available funds. There is no
          guaranteed redemption schedule or secondary market.
        </p>
        <p>
          The method for valuing unresolved cases and pricing new shares has not
          been decided. The $1.00 demonstration price is a fixed assumption, not
          a live net asset value.
        </p>
      </>
    ),
  },
  "underwriting-methodology": {
    title: "Underwriting methodology.",
    description: "A proposed review process before an allocation is approved.",
    content: (
      <>
        <h2>Legal review</h2>
        <p>
          Review the claim’s basis, evidence, defenses, procedural stage, and
          relevant enforcement questions. Record what is known, what is
          disputed, and which documents still need verification. Confidential
          case material is not collected by this website.
        </p>
        <h2>Funding requirements</h2>
        <p>
          Examine the remaining counsel budget and expected expenses. Compare
          the proposed commitment with the capital needed through resolution.
          Consider additional funding requests and whether reserves would be
          needed.
        </p>
        <h2>Recovery and payment timing</h2>
        <p>
          Separate claimed damages from realistically collectible proceeds.
          Assess contractual recovery terms alongside counsel costs and
          potential enforcement expenses. Estimate time to resolution separately
          from time to collection.
        </p>
        <h2>Operator review</h2>
        <p>
          An operator would inspect the assessment, supporting evidence, and
          conflicts before authorizing an allocation. No automated score would
          approve funding. Approval criteria, escalation policies, and
          concentration limits remain pending.
        </p>
        <h2>The current interface</h2>
        <p>
          The <Link href="/underwriting#process">sample assessment</Link>{" "}
          presents a fictional $250,000 request. Its inputs are assumptions, and
          its operator approval is pending. The pool table is a separate
          portfolio illustration, not evidence that this request has been
          approved or funded.
        </p>
        <p>
          A live service should return assessment inputs with their sources and
          review status. That service is not connected in this version.
        </p>
      </>
    ),
  },
  "outcome-estimates": {
    title: "Interpreting outcome estimates.",
    description:
      "Scenario analysis with visible assumptions and a clear separation from historical results.",
    content: (
      <>
        <div className="doc-note">
          <strong>Methodology preview</strong>
          <p>
            The outcome engine is not implemented. No displayed scenario is a
            validated prediction.
          </p>
        </div>
        <h2>Possible outcomes and financial effects</h2>
        <p>
          A future engine would use case information to support estimates of
          settlement, judgment, and loss, together with potential recoveries and
          time to collection. Scenarios should make costs and uncertainty
          explicit.
        </p>
        <p>
          Any example probabilities would be assumptions unless independently
          supported and validated. This version assigns no probabilities, model
          scores, or accuracy figures.
        </p>
        <h2>Keep legal results separate from cash</h2>
        <p>
          A favorable judgment can remain unpaid. Appeals, enforcement costs,
          and counterparty insolvency can reduce the amount collected or delay
          payment. Pool economics should depend on cash receipts and their
          timing.
        </p>
        <p>
          For example, investing $250,000 and collecting $275,000 five years
          later produces about 1.9% annualized before pool fees and inflation,
          assuming no interim distributions. A favorable legal result can
          therefore fall far short of an investment target.
        </p>
        <h2>Define the historical cohort</h2>
        <p>
          Historical statistics must identify the cases included, observation
          period, and denominator. Judgment win rates should state whether they
          count only cases decided by judgment. Report settlements separately
          and leave unresolved cases unresolved.
        </p>
        <p>
          No Suitor historical performance or sample win rate is shown. The
          fictional allocations and scenario examples are not a historical
          dataset.
        </p>
        <h2>Validation before use</h2>
        <p>
          Training data, model selection, probability calibration, and
          validation standards are pending. Future estimates should include
          their assumptions, provenance, uncertainty, and model version. An
          operator would still review each funding decision.
        </p>
      </>
    ),
  },
  risks: {
    title: "Risks and open questions.",
    description:
      "Factors that could reduce returns, delay distributions, or cause a total loss of capital.",
    content: (
      <>
        <h2>Loss of capital</h2>
        <p>
          Claims can fail or recover less than their funding cost. Adverse
          judgments, budget overruns, and unexpected obligations can reduce the
          pool’s value. Investors could lose their entire contribution.
        </p>
        <h2>Collection and illiquidity</h2>
        <p>
          Even a successful claim may not produce collectible cash. Appeals and
          enforcement can extend timing, while counterparty insolvency can
          prevent payment. Pool shares may be illiquid, with withdrawals
          dependent on terms and available funds.
        </p>
        <h2>Estimation and concentration</h2>
        <p>
          Case information can be incomplete or wrong. Estimates may fail to
          capture legal uncertainty and changing conditions. Several cases can
          be exposed to the same economic or legal risks, limiting the benefits
          of diversification.
        </p>
        <h2>Operator decisions and conflicts</h2>
        <p>
          Selection, monitoring, and allocation decisions introduce operational
          risk. Conflicts involving claimants, counsel, funders, or operators
          would require policies and oversight. Those policies are not
          finalized.
        </p>
        <h2>Legal structure and eligibility</h2>
        <p>
          The legal structure, enforceability of funding arrangements, investor
          eligibility, and applicable regulatory requirements are pending. No
          legal approval or authorization to offer investments is claimed.
        </p>
        <h2>Technical and custody risk</h2>
        <p>
          Future smart contracts and wallet integrations could introduce
          vulnerabilities, key compromise, custody failures, and transaction
          errors. No live program is deployed by this interface, and no security
          audit is claimed.
        </p>
        <h2>Targets are assumptions</h2>
        <p>
          The illustrative 10–12% annualized target has not been validated. It
          does not indicate realized performance, a guaranteed yield, or an
          expected outcome. Fees, reserves, and final economics remain to be
          determined.
        </p>
        <div className="doc-note">
          <strong>Current scope</strong>
          <p>
            This website demonstrates a proposed interface using fictional data.
            The simulated deposit does not move funds or issue an investment
            interest.
          </p>
        </div>
      </>
    ),
  },
};
