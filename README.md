# Suitor Protocol

A first website interface for a proposed litigation funding protocol on Solana. Built with Next.js App Router, TypeScript, and Tailwind CSS. All case and pool data are fictional. The site does not accept real investments or connect to a wallet.

## Local setup

Use Node.js 24 LTS (minimum 22.13) and pnpm 11.19.0. Install the package manager with `npm install --global pnpm@11.19.0` if needed.

```sh
git clone https://github.com/taherezm/suitor-protocol.git
cd suitor-protocol
git switch feat/site-foundation
pnpm install --frozen-lockfile
pnpm dev
```

Open [localhost:3000](http://localhost:3000). No environment variables, API keys, or external services are required. After this branch is merged, use `main` instead of `feat/site-foundation`.

To run the production version:

```sh
pnpm build
pnpm start
```

All content routes are statically prerendered. Interactive client code is limited to navigation and the deposit preview. Fonts are system fonts, so builds and page loads do not depend on a font service. Rebuild the site when updating content or at the start of a new year to refresh the statically rendered copyright year.

## Pages

| Route                            | Content                                                                 |
| -------------------------------- | ----------------------------------------------------------------------- |
| `/`                              | Protocol introduction, sample pool preview, and share explanation       |
| `/underwriting`                  | Proposed process, fictional assessment, and outcome methodology preview |
| `/pool`                          | Sample metrics and allocations, risk explanation, and simulated deposit |
| `/docs`                          | Documentation overview                                                  |
| `/docs/whitepaper`               | Draft whitepaper                                                        |
| `/docs/pool-shares`              | Proposed ownership and distribution mechanics                           |
| `/docs/underwriting-methodology` | Case review and operator approval                                       |
| `/docs/outcome-estimates`        | Scenario assumptions and historical cohort definitions                  |
| `/docs/risks`                    | Investment risks and pending design decisions                           |

## Deposit demo

The native modal dialog accepts $1.00 to $1,000,000 in test dollars, with at most two decimal places. Visitors review the illustrative allocation, can go back to edit, and complete a simulation with an explicit confirmation. Escape and the close control cancel the preview; focus returns to its trigger.

The demonstration assumes 1,000,000 existing shares at $1.00 each and no fees. New shares equal the test-dollar amount divided by the assumed share price. Ownership uses total shares **after** the illustrative issuance. Amounts are parsed into integer cents before calculations. Displayed ownership is rounded to six decimal places.

No signature is requested, no transaction is sent, and no holdings or deposits are persisted. Closing or refreshing discards the simulation, and the sample pool stays unchanged. The 10–12% annualized target is explicitly unvalidated; live pricing, fees, and redemption mechanics remain pending.

## Integration boundaries

- `src/lib/types.ts` defines pool, allocation, assessment, outcome-preview, quote, and simulation contracts. These are view models, not finalized onchain account schemas.
- `src/lib/sample-data.ts` implements `ProtocolDataSource`. Replace this server-side data boundary when a live pool and underwriting service exist. Keep real and sample modes explicit, and validate service data at the boundary before rendering.
- `src/lib/deposit.ts` owns demo validation and share math. `DemoDepositGateway` is deliberately restricted to simulated receipts. A future Solana implementation should add a distinct adapter with wallet consent, quotes from authoritative pricing, transaction states, and confirmed balances. It must not silently turn the demo submit action into a real deposit.
- `src/components/deposit-preview.tsx` owns the amount, review, and confirmation steps. It is isolated from the page layout so a future authorized wallet flow can reuse the interaction structure.
- `src/content/docs.tsx` contains the readable documentation. The scenario table consumes `getOutcomePreview()` from the shared data source. A future outcome engine can replace those fixtures and extend `OutcomePreview` with sourced inputs, uncertainty, and model version. No predictive model or invented accuracy metric exists here.

Case SP-004 is a pending underwriting example, separate from the three fictional commitments in the sample pool. Pool capital reconciles to $1,000,000 total, $625,000 allocated, and $375,000 available. Example outcome receipts are scenario assumptions before pool fees, not historical results.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Browser tests run against `pnpm start`, automatically starting it on `127.0.0.1:3000` if needed. Stop any unrelated development server on that port before testing. In Linux CI, install browser system dependencies with `pnpm exec playwright install --with-deps chromium`.

The domain tests cover amount boundaries, fractional cents rejection, post-issuance ownership, invalid pricing, reconciled pool data, and the in-memory simulation. Browser tests cover all nine content routes, internal links, mobile navigation, documentation navigation, the complete deposit flow, cancellation, keyboard focus, 320px layouts, enlarged documentation text, and the 404 page. They also check that completing a demo sends no POST request.

Screenshots are saved under `test-results/` for visual inspection. Failure traces are retained there too. Generated results, build output, and dependencies are ignored by Git. The dependency lockfile is committed.

## Scope still pending

Live underwriting and operator workflows, outcome modeling and validation, wallet integration, smart contracts, custody, legal structure, investor eligibility, share pricing, fees, and withdrawal policies are future work. No audit results, partnerships, approvals, or realized returns are claimed by this interface.
