"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { docsNavigation } from "@/lib/docs-navigation";
import {
  IndicatorPill,
  useSlidingIndicator,
} from "@/components/motion/sliding-indicator";

/** Turns with the panel. Decoration: the state is already on aria-expanded. */
function Chevron() {
  return (
    <svg
      className="ix-chevron docs-chevron"
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * The documentation rail: a sheet of glass parked under the floating bar.
 *
 * A single pill glides to whichever page is open and previews under whatever
 * the pointer or the keyboard is on, so the list reports position rather than
 * simply listing links. Below 860px the rail folds into a disclosure whose
 * button is named exactly "Documentation", the panel unfolds with its links
 * arriving in order, and Escape closes it and hands focus back to the button.
 */
export function DocsSidebar() {
  const pathname = usePathname().replace(/\/+$/, "") || "/";
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The panel's own open state changes what can be measured, so it is a
  // dependency as much as the route is.
  useSlidingIndicator(list, "a[aria-current]", [pathname, open]);

  function closeAndReturnFocus() {
    setOpen(false);
    toggle.current?.focus();
  }

  return (
    <aside
      className="docs-sidebar"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) closeAndReturnFocus();
      }}
    >
      <div className="docs-rail glass">
        <p className="docs-rail-title">Documentation</p>

        <button
          ref={toggle}
          type="button"
          className="docs-toggle"
          aria-expanded={open}
          aria-controls="docs-navigation"
          onClick={() => setOpen(!open)}
        >
          Documentation
          <Chevron />
        </button>

        <nav
          id="docs-navigation"
          aria-label="Documentation"
          ref={list}
          className={open ? "docs-nav is-open" : "docs-nav"}
          data-hover-preview=""
        >
          <IndicatorPill className="docs-pill" />
          {docsNavigation.map((item, index) => (
            <Link
              key={item.slug}
              href={item.href}
              className="ix-row docs-row"
              style={{ "--i": index } as CSSProperties}
              aria-current={pathname === item.href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <span className="ix-row-n">{item.index}</span>
              <span className="ix-row-label">{item.title}</span>
            </Link>
          ))}
        </nav>

        <div className="docs-rail-note">
          <span className="mono">Version 0.1</span>
          <p>
            A working specification.
            <br />
            Mechanics remain proposed.
          </p>
        </div>
      </div>
    </aside>
  );
}
