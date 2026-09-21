import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollLight } from "@/components/motion/scroll-light";

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h15m-6-6 6 6-6 6"} />
    </svg>
  );
}

export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="text-link">
      {children}
      <Arrow />
    </Link>
  );
}

export function Badge({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <span className={`badge${dark ? " badge-dark" : ""}`}>{children}</span>
  );
}

/** Names a section. Ordinals live in the table of contents, where they mean something. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="section-label">{children}</p>;
}

export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="page-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <div className="intro-copy">{children}</div>
    </header>
  );
}

/**
 * A white lead sentence followed by a muted continuation, inside one paragraph.
 * The sentence keeps reading as a sentence; only the emphasis changes.
 *
 * The paragraph is a scroll-lit block: every word starts dim and lights in
 * reading order as the paragraph climbs the viewport, the lead reaching white
 * before the continuation reaches its muted tone. The split is spans and
 * whitespace only, so the rendered text is unchanged, and `--p` defaults to 1,
 * so without JavaScript or under reduced motion the paragraph is simply lit.
 *
 * `lit` opts out of all of that and renders the paragraph at its final colours.
 * Text lights as it is scrolled into, which means the effect needs a block that
 * arrives: a paragraph that is already on the screen at first paint, like the
 * hero's, would simply sit there half dim. The hero is the one block on the
 * site that is never scrolled into, so the hero is the one block that opts out.
 */
export function TwoTone({
  lead,
  children,
  className,
  lit = false,
}: {
  lead: ReactNode;
  children?: ReactNode;
  className?: string;
  lit?: boolean;
}) {
  const classes = className ? `two-tone ${className}` : "two-tone";

  if (lit) {
    return (
      <p className={classes}>
        {lead}
        {children ? (
          <>
            {" "}
            <span>{children}</span>
          </>
        ) : null}
      </p>
    );
  }

  return (
    <ScrollLight className={classes}>
      {(light) => (
        <>
          {light(lead)}
          {children ? (
            <>
              {" "}
              <span>{light(children, "soft")}</span>
            </>
          ) : null}
        </>
      )}
    </ScrollLight>
  );
}

/**
 * A centred section heading: optional ruled eyebrow, the lead as the h2, then
 * the continuation as a 20px two-tone line beneath it.
 *
 * The continuation deliberately does not sit inside the heading. An h2 runs to
 * 56px, so a second and third sentence set at that size becomes the wall of
 * giant type this rebuild exists to replace; at 20px it reads as the muted
 * continuation of the same thought, which is what the design language asks for.
 * Every section on the site gets this shape from here, so they all match.
 *
 * The header is one scroll-lit block rather than two, so the words are
 * numbered straight through the heading and on into the line under it: the
 * heading finishes lighting before the continuation starts. The heading is
 * still a real `h2` of real text, spans and all, and its accessible name is
 * unchanged because the whitespace between the words is left as it was.
 */
export function SectionHead({
  eyebrow,
  lead,
  children,
  id,
  className,
}: {
  eyebrow?: ReactNode;
  lead: ReactNode;
  children?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <ScrollLight
      as="header"
      className={className ? `section-head ${className}` : "section-head"}
    >
      {(light) => (
        <>
          {eyebrow ? (
            <p className="eyebrow-rule">
              <span>{eyebrow}</span>
            </p>
          ) : null}
          <h2 id={id}>{light(lead)}</h2>
          {children ? (
            <p className="two-tone section-sub">
              <span>{light(children, "soft")}</span>
            </p>
          ) : null}
        </>
      )}
    </ScrollLight>
  );
}

/** Dark glass with a stroke and a lit top edge. `frame` opens it up into a stage. */
export function GlassPanel({
  children,
  className,
  frame = false,
}: {
  children: ReactNode;
  className?: string;
  frame?: boolean;
}) {
  const classes = ["glass", frame ? "glass-frame" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return <div className={classes}>{children}</div>;
}

/**
 * A pill with a register mark. Given an `href` it becomes a link and grows an
 * arrow; without one it stays the inert label it has always been. `live` marks
 * a chip that reports current state.
 */
export function Chip({
  children,
  live = false,
  className,
  href,
}: {
  children: ReactNode;
  live?: boolean;
  className?: string;
  href?: string;
}) {
  const classes = [
    "chip",
    live ? "chip-live" : "",
    href ? "chip-link" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const led = <span className="chip-led" aria-hidden="true" />;
  if (href) {
    return (
      <Link className={classes} href={href}>
        {led}
        {children}
        <Arrow />
      </Link>
    );
  }
  return (
    <span className={classes}>
      {led}
      {children}
    </span>
  );
}
