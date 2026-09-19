export const docsNavigation = [
  { slug: "overview", href: "/docs", title: "Overview", index: "01" },
  {
    slug: "whitepaper",
    href: "/docs/whitepaper",
    title: "Whitepaper",
    index: "02",
  },
  {
    slug: "pool-shares",
    href: "/docs/pool-shares",
    title: "Pool shares",
    index: "03",
  },
  {
    slug: "underwriting-methodology",
    href: "/docs/underwriting-methodology",
    title: "Underwriting methodology",
    index: "04",
  },
  {
    slug: "outcome-estimates",
    href: "/docs/outcome-estimates",
    title: "Outcome estimates",
    index: "05",
  },
  { slug: "risks", href: "/docs/risks", title: "Risks", index: "06" },
] as const;

export type DocSlug = (typeof docsNavigation)[number]["slug"];
