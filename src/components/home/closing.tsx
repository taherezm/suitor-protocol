import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { Arrow, TwoTone } from "@/components/ui";

/**
 * Owner: outcomes agent. The closing slab: "A legal win can still be a poor
 * investment.", the 1.9% arithmetic, and two calls to action.
 *
 * The finale is still a certificate, but a plain one: a double hairline frame
 * drawn in CSS and nothing else. The engraved border, the rosette seal, the
 * corner registration marks and the tilt that followed the pointer have all
 * been cut. Nothing on this site tracks the mouse, and no text on this site
 * sits on top of line-work.
 */
export function Closing() {
  return (
    <section className="close slab" aria-labelledby="close-heading">
      <span className="light-cone" aria-hidden="true" />
      <div className="shell close-inner">
        <Reveal>
          <div className="close-cert">
            <span className="close-rule" aria-hidden="true" />

            {/* No "Suitor Pool 01, specimen" line above the heading. A mono
                system label on a certificate is costume, and this page is
                keeping only the things that carry a fact. */}
            <div className="close-body">
              <h2 id="close-heading">
                A legal win can still be a poor investment.
              </h2>
              <TwoTone
                className="close-copy"
                lead="$275,000 back five years after $250,000 went out is about 1.9% a year before fees."
              >
                Time is the risk.
              </TwoTone>
              <div className="close-actions">
                <Link className="button button-primary" href="/#pool">
                  Explore the pool
                  <Arrow />
                </Link>
                <Link className="button button-secondary" href="/docs/risks">
                  Read the risks
                  <Arrow diagonal />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
