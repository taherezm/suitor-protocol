"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { docsNavigation } from "@/lib/docs-navigation";

export function DocsSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  return (
    <aside className="docs-sidebar">
      <p className="eyebrow docs-sidebar-title">Documentation</p>
      <button
        className="docs-toggle"
        aria-expanded={open}
        aria-controls="docs-navigation"
        onClick={() => setOpen(!open)}
      >
        Documentation<span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <nav
        id="docs-navigation"
        aria-label="Documentation"
        className={open ? "is-open" : ""}
      >
        {docsNavigation.map((item) => (
          <Link
            href={item.href}
            key={item.slug}
            aria-current={pathname === item.href ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            <span className="mono">{item.index}</span>
            {item.title}
          </Link>
        ))}
      </nav>
      <div className="docs-sidebar-note">
        <span className="mono">VERSION 0.1</span>
        <p>
          A working specification.
          <br />
          Mechanics remain proposed.
        </p>
      </div>
    </aside>
  );
}
