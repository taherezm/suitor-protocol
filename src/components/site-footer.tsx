import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";

/* The protocol lives on one page now, so these are positions on it. */
const protocolLinks = [
  { href: "/#pool", label: "Pool" },
  { href: "/#underwriting", label: "Underwriting" },
  { href: "/#timeline", label: "Timeline" },
  { href: "/#outcomes", label: "Outcomes" },
];

const docsLinks = [
  { href: "/docs/whitepaper", label: "Whitepaper" },
  { href: "/docs/pool-shares", label: "Pool shares" },
  { href: "/docs/outcome-estimates", label: "Outcome estimates" },
  { href: "/docs/risks", label: "Risks" },
];

const status = [
  "Hackathon prototype",
  "Sample data",
  "Not open for investment",
];

export function SiteFooter() {
  return (
    <footer className="ft">
      <span className="ft-rule" aria-hidden="true" />
      <div className="shell">
        <div className="ft-cols">
          <div>
            <h2 className="ft-title">Protocol</h2>
            <ul className="ft-list">
              {protocolLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="ft-title">Docs</h2>
            <ul className="ft-list">
              {docsLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="ft-title">Status</h2>
            <ul className="ft-list ft-status">
              {status.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* The house name as an object, not a link. Drawn rather than set, so
            textLength pins it to the content width at every viewport and it can
            never push the page wider than itself.

            It fades in and does nothing else. */}
        <Reveal className="ft-mark-wrap">
          <svg
            className="ft-mark"
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 1000 134"
          >
            <linearGradient
              id="ft-mark-fade"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="6"
              x2="0"
              y2="130"
            >
              <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="0.55" stopColor="#cfd4dd" stopOpacity="0.6" />
              <stop offset="1" stopColor="#8d94a1" stopOpacity="0" />
            </linearGradient>
            <text
              x="0"
              y="124"
              fontSize="158"
              textLength="1000"
              lengthAdjust="spacingAndGlyphs"
              fill="url(#ft-mark-fade)"
            >
              Suitor Protocol
            </text>
          </svg>
        </Reveal>

        <div className="ft-bottom">
          <p>
            © {new Date().getFullYear()} Suitor Protocol. All rights reserved.
          </p>
          <Link href="/docs/risks">
            Risks &amp; disclosures
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="m6 18 12-12M6 6h12v12" />
            </svg>
          </Link>
        </div>
      </div>
    </footer>
  );
}
