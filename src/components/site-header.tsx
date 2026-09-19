"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/underwriting", label: "Underwriting" },
  { href: "/pool", label: "Pool" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="wordmark" href="/" onClick={() => setOpen(false)}>
          Suitor Protocol<span aria-hidden="true">.</span>
        </Link>
        <button
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close" : "Menu"}
          <span aria-hidden="true">{open ? "×" : "+"}</span>
        </button>
        <nav
          id="main-navigation"
          aria-label="Main navigation"
          className={`main-nav${open ? " is-open" : ""}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              document
                .querySelector<HTMLButtonElement>(".menu-toggle")
                ?.focus();
            }
          }}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname.startsWith(link.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="header-status">Hackathon prototype</span>
      </div>
    </header>
  );
}
