"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Reveal } from "@/components/motion/reveal";
import {
  IndicatorPill,
  useSlidingIndicator,
} from "@/components/motion/sliding-indicator";
import { SectionHead, TextLink } from "@/components/ui";
import { underwritingProcess } from "@/lib/underwriting-process";

/**
 * Owner: outcomes agent. The four underwriting checks, from
 * `@/lib/underwriting-process`. A person approves each one.
 *
 * `#review` is the first row of the section index above it, so the id stays on
 * this root element.
 *
 * This used to be four static cards in a row, which is the one shape on the
 * page with nothing to do and the shape every generated marketing site
 * reaches for. It is a sequence now, and the reader walks it: the four checks
 * are a segmented control on a progress rail, and choosing one opens what that
 * check asks and what would stop an allocation there. The connector finally
 * describes something, because there is now an order to be in.
 */

/** Custom properties sequence the strokes and the rail, so the type admits them. */
type Vars = CSSProperties & Record<`--${string}`, string | number>;

/**
 * One glyph per check, drawn rather than illustrated: a claim under a lens, a
 * budget sheet, a clock that comes back around, and a seal.
 */
const GLYPHS: readonly (readonly string[])[] = [
  [
    "M5.5 3h8L18.5 8v13h-13z",
    "M13.5 3v5h5",
    "M11.4 10.9a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6z",
    "m13.8 16.6 2.7 2.7",
  ],
  [
    "M4.5 4.5h15v15h-15z",
    "M4.5 9.2h15",
    "M9.6 9.2v10.3",
    "M12.6 12.4h4.2",
    "M12.6 15.8h4.2",
  ],
  [
    "M13.2 20.1A8.1 8.1 0 1 1 20 12.9",
    "m20.4 9.4.7 3.6-3.6.5",
    "M12 7.5V12l3.1 1.9",
  ],
  [
    "M12 3.4a6.7 6.7 0 1 0 0 13.4 6.7 6.7 0 0 0 0-13.4z",
    "m9.2 10.2 2 2 3.6-3.7",
    "M9 16.3 8 21.1l4-1.9 4 1.9-1-4.8",
  ],
];

/**
 * What each check is actually asking, and what sends the file back. Written
 * alongside the process rather than inside it: the four titles and their
 * descriptions are the shared contract, and these two lines are how this
 * section presents them.
 */
const DETAIL: readonly { asks: string; stops: string }[] = [
  {
    asks: "Is there a claim, and what about it is still unproven?",
    stops:
      "Evidence that does not carry the cause of action, or a procedural position there is no way back from.",
  },
  {
    asks: "Does the budget reach a resolution, and do the terms justify the exposure?",
    stops:
      "A budget that runs out before the case ends, or terms that only pay in the best case.",
  },
  {
    asks: "If the claim succeeds, when does cash arrive and who pays it?",
    stops:
      "A counterparty with nothing collectible, or a timetable appeals could push past the pool’s horizon.",
  },
  {
    asks: "Has a person read the file and put their name to it?",
    stops:
      "Anything left open in the three checks above. A model estimate informs this review; it never authorizes funding.",
  },
];

function Glyph({ step }: { step: number }) {
  const paths = GLYPHS[step] ?? [];
  return (
    <svg
      className="flow-glyph"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

const tabId = (index: number) => `flow-tab-0${index + 1}`;

export function UnderwritingFlow() {
  const [active, setActive] = useState(0);
  const rail = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useSlidingIndicator(rail, "[role='tab'][aria-selected='true']", [active]);

  const steps = underwritingProcess;
  const step = steps[active];
  const detail = DETAIL[active];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (active + 1) % steps.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (active - 1 + steps.length) % steps.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = steps.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <section
      id="review"
      className="section flow"
      aria-labelledby="flow-heading"
    >
      <div className="shell">
        <Reveal className="flow-head">
          <SectionHead
            id="flow-heading"
            lead="Every allocation starts with a review."
          >
            Four checks before capital is committed. A person approves each one.
          </SectionHead>
        </Reveal>

        <Reveal className="flow-rail" delay={100}>
          <div
            className="flow-steps"
            ref={rail}
            role="tablist"
            aria-label="Underwriting checks"
            data-hover-preview=""
            onKeyDown={onKeyDown}
          >
            <IndicatorPill className="flow-pill" />
            {steps.map((item, index) => (
              <button
                key={item.title}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                type="button"
                id={tabId(index)}
                className="flow-step"
                role="tab"
                aria-selected={active === index}
                aria-controls="flow-panel"
                tabIndex={active === index ? 0 : -1}
                onClick={() => setActive(index)}
              >
                <span className="flow-step-n mono">{`0${index + 1}`}</span>
                <span className="flow-step-label">{item.title}</span>
              </button>
            ))}
          </div>

          {/* The sequence, drawn. It fills to the check being read, so the
              wire finally describes the order the tiles only implied. */}
          <div className="flow-progress" aria-hidden="true">
            <span
              className="flow-progress-fill"
              style={{ "--p": (active + 1) / steps.length } as Vars}
            />
          </div>

          <div
            className="flow-panel glass"
            id="flow-panel"
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={tabId(active)}
          >
            <div className="flow-panel-swap" key={step.title}>
              <div className="flow-panel-lead">
                <span className="flow-icon" aria-hidden="true">
                  <Glyph step={active} />
                </span>
                <h3 className="flow-title">{step.title}</h3>
                <p className="flow-text">{step.text}</p>
              </div>

              <dl className="flow-checks">
                <div>
                  <dt>What the review asks</dt>
                  <dd>{detail.asks}</dd>
                </div>
                <div>
                  <dt>What would stop it here</dt>
                  <dd>{detail.stops}</dd>
                </div>
              </dl>
            </div>
          </div>
        </Reveal>

        <Reveal className="flow-foot">
          <TextLink href="/docs/underwriting-methodology">
            Read the underwriting methodology
          </TextLink>
        </Reveal>
      </div>
    </section>
  );
}
