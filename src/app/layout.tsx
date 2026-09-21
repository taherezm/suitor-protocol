import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageTransition } from "@/components/page-transition";
import { MotionBoot } from "@/components/motion/motion-boot";
import { HashLanding } from "@/components/motion/hash-landing";
import { ScrollLightBoot } from "@/components/motion/scroll-light-boot";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-sans-ui",
});

/** Reserved for numerals, the ticker, terminal chrome and axis labels. */
const mono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-ui",
});

export const metadata: Metadata = {
  title: {
    default: "Suitor Protocol | Litigation funding on Solana",
    template: "%s | Suitor Protocol",
  },
  description:
    "Explore the proposed Suitor litigation funding protocol, its underwriting methodology, and a sample investment pool. Hackathon prototype only.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#050506",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* First child of the body: the parser reaches it before any content,
            which is the only moment early enough to arm the motion system
            without a flash of content appearing and then hiding itself. */}
        <MotionBoot />
        {/* Arriving from another route with a hash lands on the target at
            once. Smooth scrolling is for anchors on the page you are already
            reading, never for five thousand pixels of a page you have not
            seen. */}
        <HashLanding />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="main-content" tabIndex={-1}>
          <PageTransition>{children}</PageTransition>
        </main>
        <SiteFooter />
        {/* One passive scroll listener for every scroll-lit block on the page.
            It only ever writes `--p`; the words themselves are pure CSS. */}
        <ScrollLightBoot />
      </body>
    </html>
  );
}
