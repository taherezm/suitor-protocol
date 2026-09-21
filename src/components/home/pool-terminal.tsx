"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Reveal } from "@/components/motion/reveal";
import { ScrollLight } from "@/components/motion/scroll-light";
import {
  IndicatorPill,
  useSlidingIndicator,
} from "@/components/motion/sliding-indicator";
import { SectionHead } from "@/components/ui";
import { useScrollProgress } from "@/components/home/use-scroll-progress";
import {
  AllocationsView,
  DepositView,
  OutcomesView,
  OverviewView,
} from "./terminal-views";
import type { CaseAssessment, OutcomePreview, PoolSnapshot } from "@/lib/types";

/* The product itself, sitting on the page: one glass window, one dock, four
   views of the same pool. Everything in it is the sample data the page loaded.

   Owner: terminal agent. Styles: src/styles/terminal.css (prefix term-). */

/* ---------- Dock icons ----------
   Drawn here rather than loaded: the site ships no raster images and no
   external assets. Each one is decoration; the tab it sits in carries the
   name. */

const ICON = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function GaugeIcon() {
  return (
    <svg {...ICON}>
      <path d="M3.5 17a8.5 8.5 0 0 1 17 0" />
      <path d="M12 17 16.2 10.6" />
      <circle cx="12" cy="17" r="1.4" />
      <path d="M12 5.5v1.6M5.2 9.4l1.3.9M18.8 9.4l-1.3.9" />
    </svg>
  );
}

function BarsIcon() {
  return (
    <svg {...ICON}>
      <path d="M4 19.5h16" />
      <path d="M6.5 19.5v-6M12 19.5V5.5M17.5 19.5v-9" />
    </svg>
  );
}

/* Money going in, not a file coming down: a coin dropping into an open tray.
   The download arrow this used to be said the opposite of what the view does. */
function DepositIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="6.4" r="3.1" />
      <path d="M12 11.2v2.6" />
      <path d="M8.5 12.4v1.4M15.5 12.4v1.4" />
      <path d="M3.8 14.4v3.4a1.8 1.8 0 0 0 1.8 1.8h12.8a1.8 1.8 0 0 0 1.8-1.8v-3.4" />
    </svg>
  );
}

/* One path forking into three endings, and the ending nobody gets paid in is
   drawn hollow, which is how loss is drawn everywhere else on this page. */
function ForkIcon() {
  return (
    <svg {...ICON}>
      <path d="M3.4 12h4.2" />
      <path d="M7.6 12c3.4 0 2.8-5.4 6.2-5.4" />
      <path d="M7.6 12h6.2" />
      <path d="M7.6 12c3.4 0 2.8 5.4 6.2 5.4" />
      <circle cx="16" cy="6.6" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="16" cy="17.4" r="1.6" />
    </svg>
  );
}

/* ---------- Views ---------- */

type ViewId = "overview" | "allocations" | "deposit" | "outcomes";

interface ViewDefinition {
  id: ViewId;
  label: string;
  icon: ReactNode;
  lead: string;
  rest: string;
}

const VIEWS: ViewDefinition[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <GaugeIcon />,
    lead: "Know where the capital sits.",
    rest: "Allocated, available, and priced per share.",
  },
  {
    id: "allocations",
    label: "Allocations",
    icon: <BarsIcon />,
    lead: "Every claim has a clock.",
    rest: "Stage and resolution window for each funded case.",
  },
  {
    id: "deposit",
    label: "Deposit",
    icon: <DepositIcon />,
    lead: "Preview a deposit.",
    rest: "Test dollars in, illustrative shares out. Nothing is signed or sent.",
  },
  {
    id: "outcomes",
    label: "Outcomes",
    icon: <ForkIcon />,
    lead: "Same funding, four endings.",
    rest: "Assumed scenarios, not predictions.",
  },
];

const tabId = (id: ViewId) => `term-tab-${id}`;

/**
 * There has to be room for the whole stage to stand in, unclipped, under the
 * floating bar.
 *
 * The width is the owner's line. The height floor is this file's own and it is
 * measured rather than guessed: with the pinned compressions in terminal.css,
 * the two tallest views (the deposit quote card and the allocations ledger)
 * stop overflowing the window's canvas at about 815px of viewport. 840 is that
 * with enough slack that a different font metric cannot take the bottom off a
 * row.
 *
 * Under either figure the section is the plain, tap-driven one, which is a
 * complete way to read it rather than a degraded one.
 */
const PIN_QUERY = "(min-width: 900px) and (min-height: 840px)";

/**
 * The pool terminal.
 *
 * Two presentations, one set of markup.
 *
 * Unpinned is the default and is what the stylesheet describes first: a
 * heading, a glass window, a dock under it and a caption, in normal flow, with
 * the four views swapped by tapping the dock. That is what a narrow screen
 * gets, what a reader who asked for reduced motion gets, and what is on the
 * page before any JavaScript has run.
 *
 * Pinned is everything under `.term[data-pinned]`. The section grows a track of
 * 100vh plus four screens of 70vh, the stage sticks to the top of the viewport,
 * and the reader's own scrolling walks the dock through Overview, Allocations,
 * Deposit and Outcomes at four equal slices of that track. Scrolling back
 * reverses it, and a little hysteresis in the hook keeps the dock from
 * chattering while the reader rests on a boundary.
 *
 * The scroll position and the open tab are the same fact, so activating a tab
 * scrolls to the start of its slice rather than just swapping the panel: it is
 * the only way the two cannot end up disagreeing.
 *
 * The dock is a real tablist in both presentations: arrow keys, Home and End
 * move between the four views, only the selected tab is in the tab order, and
 * the window body is the panel they control.
 */
export function PoolTerminal({
  pool,
  outcomes,
  assessment,
}: {
  pool: PoolSnapshot;
  outcomes: OutcomePreview;
  assessment: CaseAssessment;
}) {
  /* One source of truth for which view is open. The scroll writes to it while
     the section is pinned, a click or a key writes to it directly, and it is
     the only thing the panel, the dock and the caption are rendered from. */
  const [view, setView] = useState(0);
  /* The Deposit view owns a text field. A tab that changed under the reader
     mid-number would be unforgivable, so scroll-driven handover is frozen
     while the field has focus. The scroll itself is never touched. */
  const [typing, setTyping] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const tabs = useRef<Partial<Record<ViewId, HTMLButtonElement | null>>>({});

  const { pinned, segment, scrollToSegment } = useScrollProgress({
    trackRef,
    hostRef: sectionRef,
    // The dock only has four positions, so there is nothing finer for React to
    // re-render for. Everything between them is CSS, driven from `--term-p`.
    steps: 4,
    property: "--term-p",
    query: PIN_QUERY,
    segments: VIEWS.length,
    segmentProperty: "--term-i",
    hold: typing,
  });

  /* The scroll hands over by moving `segment`, and the hook refuses to move it
     at all while `hold` is set, which is what freezes the view under a reader
     who is typing. Unpinned the hook reports -1 and the dock is in sole
     charge, which is the tap-only behaviour on a narrow screen. */
  useEffect(() => {
    if (pinned && segment >= 0) setView(segment);
  }, [pinned, segment]);

  const active = view;
  const current = VIEWS[active] ?? VIEWS[0];

  useSlidingIndicator(dock, "[role='tab'][aria-selected='true']", [active]);

  /** Opening a view means going to where that view lives on the page. */
  const open = useCallback(
    (next: number) => {
      setView(next);
      scrollToSegment(next);
    },
    [scrollToSegment],
  );

  function onDockKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (active + 1) % VIEWS.length;
        break;
      case "ArrowLeft":
        next = (active - 1 + VIEWS.length) % VIEWS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = VIEWS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    open(next);
    tabs.current[VIEWS[next].id]?.focus();
  }

  /* focusin/focusout, so a field anywhere inside the panel freezes the
     handover without the panel having to know which view is open. The scroll
     is never blocked: the reader can leave the section entirely while typing,
     and the dock simply catches up when the field is released. */
  function onPanelFocus(event: FocusEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLInputElement) setTyping(true);
  }
  function onPanelBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLInputElement) setTyping(false);
  }

  return (
    <section className="term" ref={sectionRef} aria-labelledby="term-title">
      {/* `term-scroll`, not `term-track`: the month rulers inside the
          allocation rows have owned `.term-track` since the window was built,
          and giving this the same name made every one of them 380vh tall. */}
      <div className="term-scroll" ref={trackRef}>
        {/* The slab: a raised, rounded panel, and the element that sticks. The
            slab look lives here rather than on an ancestor because `overflow`
            on an ancestor of a sticky element strands it; on the sticky element
            itself it is harmless. Nothing above this in the tree may take an
            overflow, transform, filter or contain. */}
        <div className="term-pin">
          <div className="term-inner">
            <Reveal className="term-head">
              <SectionHead
                id="term-title"
                eyebrow="Pool terminal"
                lead="One pool. Every dollar accounted for."
              >
                Deposits, allocations and outcomes in a single ledger.
              </SectionHead>
            </Reveal>

            <Reveal className="term-stage" delay={120}>
              <div className="term-stars" aria-hidden="true" />
              <div className="term-glow" aria-hidden="true" />

              <div className="term-window glass-frame">
                {/* The bar carries the name of the view and nothing else. It
                    used to hold a fake path and a "Sample data" chip as well;
                    the path was set dressing for a URL that does not exist, and
                    the sample data caveat is already stated in the statement
                    below and in the footer. */}
                <div className="term-chrome">
                  <span className="term-window-title">
                    <span className="term-window-name" key={current.id}>
                      {current.label}
                    </span>
                  </span>
                </div>

                <div
                  className="term-body"
                  id="term-panel"
                  role="tabpanel"
                  tabIndex={0}
                  aria-labelledby={tabId(current.id)}
                  onFocus={onPanelFocus}
                  onBlur={onPanelBlur}
                >
                  <div className="term-swap" key={current.id}>
                    {current.id === "overview" && <OverviewView pool={pool} />}
                    {current.id === "allocations" && (
                      <AllocationsView pool={pool} assessment={assessment} />
                    )}
                    {current.id === "deposit" && <DepositView pool={pool} />}
                    {current.id === "outcomes" && (
                      <OutcomesView outcomes={outcomes} />
                    )}
                  </div>
                </div>
              </div>

              <div className="term-dock-wrap">
                <div
                  className="term-dock"
                  ref={dock}
                  role="tablist"
                  aria-label="Pool terminal views"
                  data-hover-preview=""
                  onKeyDown={onDockKeyDown}
                >
                  <IndicatorPill className="term-pill" />
                  {VIEWS.map((view, position) => (
                    <button
                      key={view.id}
                      ref={(node) => {
                        tabs.current[view.id] = node;
                      }}
                      type="button"
                      id={tabId(view.id)}
                      className="term-dock-button"
                      role="tab"
                      aria-selected={position === active}
                      aria-controls="term-panel"
                      aria-label={view.label}
                      tabIndex={position === active ? 0 : -1}
                      onClick={() => open(position)}
                    >
                      {view.icon}
                      <span className="term-tip" aria-hidden="true">
                        {view.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Keyed on the view, so the caption crossfades with the panel.
                  It is scroll-lit like every other two-tone line on the page,
                  but from its own tab's slice of the track rather than from
                  where the words sit on the screen: `--p` is resolved in
                  terminal.css from `--term-p` and `--term-i`, which is why the
                  block opts out of the global driver. Unpinned there is
                  nothing driving it and it is simply lit. */}
              <ScrollLight
                key={`caption-${current.id}`}
                className="two-tone term-caption"
                manual
              >
                {(light) => (
                  <>
                    {light(current.lead)}{" "}
                    <span>{light(current.rest, "soft")}</span>
                  </>
                )}
              </ScrollLight>
            </Reveal>
          </div>

          {/* Where the reader is in the four views, as four ticks down the
              right edge of the stage. Decoration: the dock already says which
              view is open, and it says it with a name. */}
          <div className="term-steps" aria-hidden="true">
            <span className="term-steps-thumb" />
            {VIEWS.map((view) => (
              <span className="term-step" key={view.id} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
