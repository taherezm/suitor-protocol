import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type JSX,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * Text that lights word by word as its block travels up the viewport.
 *
 * The whole behaviour is one custom property per block. `--p` is the block's
 * scroll progress, written once per frame by `ScrollLightBoot` for the handful
 * of blocks near the viewport; every word carries its own `--i` and reads the
 * block's `--n`, so each word's colour is resolved purely in CSS from
 * `clamp(0, var(--p) * var(--n) - var(--i), 1)`. No JavaScript touches a word.
 *
 * This module is deliberately server-safe: it renders plain elements, so a
 * server component can use it and the split text is in the first HTML the
 * browser receives. `--p` defaults to 1 in motion.css, which is why the text is
 * fully lit without JavaScript, before hydration, and under reduced motion.
 *
 * Words are wrapped in inline spans with the original whitespace left between
 * them as ordinary text nodes. The rendered text, `innerText` and the
 * accessible name of a heading are therefore byte for byte what they were, and
 * the line breaks exactly where it always did.
 */

type Tag = keyof JSX.IntrinsicElements;

/** Custom properties carry the whole effect, so the style type has to admit them. */
type LightStyle = CSSProperties & Record<`--${string}`, string | number>;

/** `lit` reaches white, `soft` reaches the muted continuation tone. */
export type Tone = "lit" | "soft";

/** Numbers the words of one block, across as many elements as it takes. */
export interface WordCounter {
  (node: ReactNode, tone?: Tone): ReactNode;
}

/** Splits on whitespace but keeps it: the separators are re-emitted verbatim. */
const PIECES = /(\s+)/;

function splitString(
  text: string,
  tone: Tone,
  next: () => number,
  keyPrefix: string,
): ReactNode[] {
  const out: ReactNode[] = [];
  const pieces = text.split(PIECES);
  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    if (piece === "") continue;
    // Whitespace stays a bare text node, so the browser breaks lines exactly
    // where it would have without the spans.
    if (piece.trim() === "") {
      out.push(piece);
      continue;
    }
    out.push(
      <span
        key={`${keyPrefix}-${index}`}
        className={tone === "soft" ? "sl-w sl-soft" : "sl-w"}
        style={{ "--i": next() } as LightStyle}
      >
        {piece}
      </span>,
    );
  }
  return out;
}

/**
 * Walks a subtree and wraps every run of text in it.
 *
 * Elements are kept: only their children are rewritten, so a link, an emphasis
 * or a line break inside a lit paragraph survives untouched and its own text
 * still lights in order.
 */
function splitNode(
  node: ReactNode,
  tone: Tone,
  next: () => number,
  keyPrefix: string,
): ReactNode {
  if (node === null || node === undefined || typeof node === "boolean")
    return node;
  if (typeof node === "string") return splitString(node, tone, next, keyPrefix);
  if (typeof node === "number")
    return splitString(String(node), tone, next, keyPrefix);

  if (Array.isArray(node)) {
    return Children.toArray(node).map((child, index) =>
      splitNode(child, tone, next, `${keyPrefix}-${index}`),
    );
  }

  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    const children = element.props.children;
    if (children === undefined) return element;
    return cloneElement(
      element as ReactElement<Record<string, unknown>>,
      undefined,
      splitNode(children, tone, next, `${keyPrefix}-c`),
    );
  }

  return node;
}

/**
 * One lit block.
 *
 * `children` is a render function given a `light(node, tone)` counter. Call it
 * for every run of text in the block, in reading order: the lead first, the
 * continuation after it, and the words light in exactly that order. The
 * function never crosses a server/client boundary, because this component is
 * not a client component; it is called during this element's own render.
 */
export function ScrollLight({
  as,
  className,
  id,
  style,
  manual = false,
  children,
}: {
  as?: Tag;
  className?: string;
  id?: string;
  style?: CSSProperties;
  /**
   * Takes the block out of `ScrollLightBoot`'s hands, so `--p` can be resolved
   * from something other than the block's position in the viewport. The pool
   * terminal's caption uses it: inside the pinned track the caption belongs to
   * one tab's slice of the scroll, not to where the words happen to be on the
   * screen, and the two would fight for the same property.
   *
   * A manual block still defaults to `--p: 1`, so it is fully lit whenever
   * nothing is driving it: no JavaScript, reduced motion, or a viewport with no
   * room to pin.
   */
  manual?: boolean;
  children: (light: WordCounter) => ReactNode;
}) {
  let count = 0;
  const next = () => count++;
  const light: WordCounter = (node, tone = "lit") =>
    splitNode(node, tone, next, "w");

  const tree = children(light);

  // Casting to one known element keeps the prop types honest while letting the
  // caller pick the semantic element the block actually is.
  const Element = (as ?? "p") as "p";
  const blockStyle = { ...style, "--n": count || 1 } as LightStyle;

  return (
    <Element
      id={id}
      className={className}
      style={blockStyle}
      data-scroll-light=""
      data-scroll-light-manual={manual ? "" : undefined}
    >
      {tree}
    </Element>
  );
}
