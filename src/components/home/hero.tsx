import Link from "next/link";
import type { CSSProperties } from "react";
import { Arrow, Chip, TwoTone } from "@/components/ui";

/**
 * The first screen is the hero and nothing else.
 *
 * Chip, headline, two-tone paragraph and the two actions are centred in the
 * first 100svh with the fixed bar accounted for, so the reader meets a finished
 * composition rather than the top half of an object, and the page goes
 * straight on into the pool.
 *
 * There used to be a second screen here: a lit stack of three ingots with the
 * allocation chips and the readout under it. It is unmounted by the owner's
 * decision, not deleted. `hero-stage.tsx`, the hero half of `ingot-scene.ts`
 * and the stage rules in `home-hero.css` are all still in the tree; putting
 * the block back is a matter of restoring the `HeroStage` element here.
 *
 * The entrance above the fold is CSS only and uses `.reveal` from base.css,
 * which is already in the reduced-motion block, so a reader who has asked for
 * stillness gets the finished page with nothing hidden and nothing to wait for.
 *
 * Two things here are locked by the e2e suite and must not move:
 *  - exactly one h1, reading "Litigation funding on Solana." (the <br /> is
 *    fine; do not split the words into spans, innerText must be stable)
 *  - exactly one link on this page whose name contains "Read the whitepaper"
 */
const step = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export function Hero() {
  return (
    <section className="hero">
      <div className="shell hero-inner">
        <span className="hero-step reveal" style={step(0)}>
          <Chip href="/docs">Proposed protocol on Solana</Chip>
        </span>

        <h1 className="reveal" style={step(90)}>
          Litigation funding
          <br />
          on Solana.
        </h1>

        <div className="hero-copy reveal" style={step(180)}>
          {/* Lit, not scroll-lit: this paragraph is on the screen at first
              paint, so there is no arrival for the light to answer. */}
          <TwoTone lit lead="Capital for legal claims, pooled on Solana.">
            See how cases are reviewed, how long money stays out, and what each
            outcome returns. Prototype with sample data.
          </TwoTone>
        </div>

        <div className="hero-actions reveal" style={step(260)}>
          <Link className="button button-primary" href="/#pool">
            Explore the pool
            <Arrow />
          </Link>
          <Link className="button button-secondary" href="/docs/whitepaper">
            Read the whitepaper
            <Arrow diagonal />
          </Link>
        </div>
      </div>
    </section>
  );
}
