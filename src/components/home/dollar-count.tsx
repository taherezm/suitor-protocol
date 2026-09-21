"use client";

import { CountUp } from "@/components/motion/count-up";
import { dollars } from "@/lib/format";

/**
 * Owner: page-sections engineer. A private wrapper so a server section can
 * count a figure up.
 *
 * `CountUp` takes a `format` function, and a function cannot be handed from a
 * server component to a client one. Keeping the formatter here means the
 * section stays a server component, and keeping it at module scope means the
 * count is not restarted by a new function identity on every render.
 */
const wholeDollars = (cents: number) => dollars(cents);

export function DollarCount({
  cents,
  className,
}: {
  cents: number;
  className?: string;
}) {
  return <CountUp value={cents} format={wholeDollars} className={className} />;
}
