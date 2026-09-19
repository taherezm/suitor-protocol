import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Suitor Protocol | Litigation funding on Solana",
    template: "%s | Suitor Protocol",
  },
  description:
    "Explore the proposed Suitor litigation funding protocol, its underwriting methodology, and a sample investment pool. Hackathon prototype only.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="shell main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="site-footer">
          <div className="shell footer-inner">
            <p>
              © {new Date().getFullYear()} Suitor Protocol. All rights reserved.
            </p>
            <div>
              <span>Hackathon prototype · Sample data</span>
              <Link href="/docs/risks">
                Risks & disclosures
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
      </body>
    </html>
  );
}
