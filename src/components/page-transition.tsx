"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Carries one route into the next: a fade and an 8px rise, in motion.css.
 *
 * The key is the path and nothing else, so moving between sections of the home
 * page, which only changes the hash, leaves the subtree mounted and never
 * replays the entrance. The animation's fill is `backwards`, so once it has
 * played the wrapper holds no transform and a `position: sticky` or
 * `position: fixed` descendant behaves normally.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
