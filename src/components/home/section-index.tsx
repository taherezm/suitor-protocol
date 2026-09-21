"use client";

import Link from "next/link";
import { useRef } from "react";
import { anchorId, scrollToAnchor } from "@/components/motion/anchor-scroll";
import {
  IndicatorPill,
  useSlidingIndicator,
} from "@/components/motion/sliding-indicator";

export type SectionIndexItem = {
  n: string;
  label: string;
  href: string;
};

/** A down arrow: the row goes further down the same page, not away from it. */
function Down() {
  return (
    <svg
      className="ix-row-arrow ix-bob"
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M12 4v15m-6-6 6 6 6-6" />
    </svg>
  );
}

/**
 * The table of contents for a long section: a numbered row per anchor, with a
 * hairline that slides to whichever row the pointer or the keyboard is on.
 *
 * Rows are real links to real ids, so the index works with JavaScript off and
 * the ordinals are readable text rather than generated content.
 */
export function SectionIndex({ items }: { items: SectionIndexItem[] }) {
  const list = useRef<HTMLDivElement>(null);
  useSlidingIndicator(list, "a[data-current]", [items.length]);

  return (
    <nav aria-label="In this section" className="sx shell">
      <div className="sx-list" ref={list} data-hover-preview="">
        <IndicatorPill className="sx-pill" line />
        {items.map((item) => {
          const id = anchorId(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="sx-row ix-row"
              onClick={(event) => {
                if (id) scrollToAnchor(event, id);
              }}
            >
              <span className="ix-row-n">{item.n}</span>
              <span className="ix-row-label">{item.label}</span>
              <Down />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
