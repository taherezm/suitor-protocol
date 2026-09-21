"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Arrow } from "@/components/ui";
import { scrollToAnchor } from "@/components/motion/anchor-scroll";
import {
  IndicatorPill,
  useSlidingIndicator,
} from "@/components/motion/sliding-indicator";
import { useScrollSpy } from "@/components/motion/use-scroll-spy";

/**
 * The site is one page plus the docs, so four of the five links are positions
 * on the home page and one is a route. `section` is the id a link owns; a link
 * without one is a route and is matched by path instead.
 */
type NavLink = { href: string; label: string; section: string | null };

const links: NavLink[] = [
  { href: "/#pool", label: "Pool", section: "pool" },
  { href: "/#underwriting", label: "Underwriting", section: "underwriting" },
  { href: "/#timeline", label: "Timeline", section: "timeline" },
  { href: "/#outcomes", label: "Outcomes", section: "outcomes" },
  { href: "/docs", label: "Docs", section: null },
];

const sections = links
  .map((link) => link.section)
  .filter((section): section is string => section !== null);

/** Three stacked ingots seen end on: two below, one resting across them. */
function Logomark() {
  return (
    <svg
      className="nav-logo"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M8.5 6.3h7l1.2 4.6H7.3z" opacity="0.55" />
      <path d="M2.6 13.1h7l1.2 4.6H1.4z" />
      <path d="M14.4 13.1h7l1.2 4.6H13.2z" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/" || pathname === "";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLElement>(null);

  // The spy only has anything to look at on the home page; elsewhere the ids
  // are absent and it reports null, which leaves the route match in charge.
  const current = useScrollSpy(isHome ? sections : [], 140);
  const active = isHome ? current : null;
  const onDocs = pathname.startsWith("/docs");

  useSlidingIndicator(list, "a[aria-current]", [active, onDocs, open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function closeAndReturnFocus() {
    setOpen(false);
    menuButton.current?.focus();
  }

  return (
    <header className="nav-wrap">
      <div
        className="nav-bar"
        data-open={open ? "true" : "false"}
        data-scrolled={scrolled ? "true" : "false"}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) closeAndReturnFocus();
        }}
      >
        <Link className="nav-mark" href="/" onClick={() => setOpen(false)}>
          <Logomark />
          Suitor Protocol
        </Link>

        <nav
          id="main-navigation"
          aria-label="Main navigation"
          className="nav-links"
          ref={list}
          data-hover-preview=""
        >
          <IndicatorPill className="nav-pill" />
          {links.map((link, index) => {
            const isCurrent = link.section
              ? isHome && active === link.section
              : onDocs;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{ "--i": index } as CSSProperties}
                aria-current={
                  isCurrent ? (link.section ? "true" : "page") : undefined
                }
                onClick={(event) => {
                  setOpen(false);
                  if (link.section && isHome)
                    scrollToAnchor(event, link.section);
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* One action only. The prototype disclosure lives in the footer, where
            it is read rather than glanced at. */}
        <div className="nav-right">
          <Link
            className="button button-primary nav-cta"
            href="/#pool"
            onClick={(event) => {
              if (isHome) scrollToAnchor(event, "pool");
            }}
          >
            Explore the pool
            <Arrow />
          </Link>
        </div>

        <button
          ref={menuButton}
          type="button"
          className="nav-menu"
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
    </header>
  );
}
