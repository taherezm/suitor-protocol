import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";

/**
 * A missing page still belongs to the site: one object, centred, standing in
 * its own light. Nothing else, no corner marks and no engraving: bands and
 * borders belong to the footer alone. The heading text is fixed by the test
 * contract and must not be reworded.
 */
export default function NotFound() {
  return (
    <div className="shell nf">
      <Reveal as="section" className="nf-stage glass-frame">
        <span className="light-cone nf-cone" aria-hidden="true" />
        <div className="nf-inner">
          <p className="eyebrow-rule">
            <span>404 / Page not found</span>
          </p>
          <h1>This page isn’t here.</h1>
          <p className="nf-copy">
            Return to the protocol overview or find a topic in the
            documentation.
          </p>
          <div className="nf-actions">
            <Link className="button button-primary" href="/">
              Back to home
            </Link>
            <Link className="button button-secondary" href="/docs">
              Browse the docs
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
