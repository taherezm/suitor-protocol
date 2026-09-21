"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  type CSSProperties,
  type JSX,
  type ReactElement,
  type ReactNode,
} from "react";

type Tag = keyof JSX.IntrinsicElements;

/** Custom properties are how a reveal is tuned, so the style type has to admit them. */
type RevealStyle = CSSProperties & Record<`--${string}`, string | number>;

/**
 * One observer for the whole document. Reveals are one-shot: an element is
 * unobserved the moment it latches, so a long page costs one callback per
 * element and nothing afterwards.
 */
let shared: IntersectionObserver | null = null;

/** Everything still waiting to latch, so a sweep can find it without a query. */
const pending = new Set<Element>();

/**
 * Promotes an element for exactly as long as it is moving.
 *
 * `will-change` used to live in motion.css on every element that had not
 * latched yet, which meant a long page asked the compositor for fifty layers
 * before a single one of them had started to animate. It is written here
 * instead, on the one element that is about to move, and taken off again the
 * moment the transition ends. The timer is the floor: a transition that never
 * fires an end event, because the element was hidden or the delay was cut
 * short, must still give the layer back.
 */
function promote(element: Element): void {
  if (!(element instanceof HTMLElement)) return;
  element.style.willChange = "opacity, transform";
  let timer = 0;
  const release = () => {
    element.style.willChange = "";
    element.removeEventListener("transitionend", release);
    if (timer) window.clearTimeout(timer);
  };
  element.addEventListener("transitionend", release);
  timer = window.setTimeout(release, 2400);
}

function latch(element: Element): void {
  // Promotion is pointless unless something is actually going to move, which
  // is only true while the motion system is armed.
  if (
    !element.hasAttribute("data-inview") &&
    document.documentElement.classList.contains("motion-ready")
  )
    promote(element);
  element.setAttribute("data-inview", "");
  pending.delete(element);
  shared?.unobserve(element);
}

/**
 * The recovery pass.
 *
 * An intersection callback can be missed: a busy frame, a scroll that jumps the
 * element clean over the viewport, a tab that was hidden while the page moved.
 * A missed callback used to mean the element stayed at `opacity: 0` for the
 * rest of the session, which is a section of the page simply gone. So nothing
 * relies on the callback alone. Anything whose top edge has already reached the
 * bottom of the viewport has, by definition, been on screen or is on screen
 * now, and is latched here whatever the observer did or did not say.
 */
function sweep(): void {
  if (pending.size === 0) return;
  const fold = window.innerHeight;
  for (const element of Array.from(pending)) {
    if (!element.isConnected) {
      pending.delete(element);
      continue;
    }
    if (element.getBoundingClientRect().top < fold) latch(element);
  }
}

/** The sweep is armed once per document, not once per component. */
let armed = false;

function arm(): void {
  if (armed || typeof window === "undefined") return;
  armed = true;
  // `scrollend` covers the common case: whatever was missed during the scroll
  // is caught the moment it stops. The timer covers a first paint that settled
  // before anything was observed, and browsers without `scrollend`.
  window.addEventListener("scrollend", sweep, { passive: true });
  window.setTimeout(sweep, 2000);
}

function observer(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  shared ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        // Above the top edge is past, not pending: an element the viewport has
        // already left must be visible, however it got there.
        if (!entry.isIntersecting) {
          if (entry.boundingClientRect.top < 0) latch(entry.target);
          continue;
        }
        latch(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px" },
  );
  return shared;
}

/** Nothing may stay hidden because the platform was missing a feature. */
function watch(elements: Element[]): (() => void) | undefined {
  const active = observer();
  if (!active) {
    for (const element of elements) element.setAttribute("data-inview", "");
    return;
  }
  arm();
  for (const element of elements) {
    if (element.hasAttribute("data-inview")) continue;
    pending.add(element);
    active.observe(element);
  }
  return () => {
    for (const element of elements) {
      pending.delete(element);
      active.unobserve(element);
    }
  };
}

/**
 * Fades and lifts its subtree the first time it enters the viewport.
 *
 * `delay` offsets this element alone; inside a `Stagger` the sibling index is
 * added to it. The hidden half of the animation lives in motion.css under
 * `html.motion-ready`, so without JavaScript or under reduced motion the
 * element renders exactly as it would have anyway.
 *
 * Do not wrap a `position: sticky` subtree in one: the `transform` on the
 * wrapper establishes a containing block for the length of the transition.
 */
export function Reveal({
  as,
  delay,
  className,
  children,
}: {
  as?: Tag;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return watch([element]);
  }, []);

  // Casting the tag to a single known element keeps the ref and the prop types
  // honest while still letting callers pick the semantic element they need.
  const Element = (as ?? "div") as "div";
  const style =
    delay === undefined
      ? undefined
      : ({ "--reveal-delay": `${delay}ms` } as RevealStyle);

  return (
    <Element ref={ref} data-reveal="" className={className} style={style}>
      {children}
    </Element>
  );
}

/**
 * Reveals its direct children in sequence, `step` milliseconds apart.
 *
 * Each child is marked and numbered during render rather than in an effect, so
 * the server output already carries `--i` and nothing flickers between paint
 * and hydration. Children that are not elements (bare strings, `null`) are
 * passed through untouched.
 */
export function Stagger({
  as,
  className,
  step,
  children,
}: {
  as?: Tag;
  className?: string;
  step?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return watch(
      Array.from(element.children).filter((child) =>
        child.hasAttribute("data-reveal"),
      ),
    );
  }, [children]);

  const items = Children.toArray(children).map((child, index) => {
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<{ style?: CSSProperties }>;
    const style: RevealStyle = { ...element.props.style, "--i": index };
    return cloneElement(element as ReactElement<Record<string, unknown>>, {
      "data-reveal": "",
      style,
    });
  });

  const Element = (as ?? "div") as "div";
  const style =
    step === undefined
      ? undefined
      : ({ "--reveal-step": `${step}ms` } as RevealStyle);

  return (
    <Element ref={ref} className={className} style={style}>
      {items}
    </Element>
  );
}
