import Link from "next/link";
import { docs } from "@/content/docs";
import { docsNavigation, type DocSlug } from "@/lib/docs-navigation";
import { Reveal } from "./motion/reveal";
import { Arrow, Badge } from "./ui";

/**
 * A document, set as a certificate rather than as a page of a manual.
 *
 * The header stands in its own cone of light and the body is a single measure
 * of about 68 characters. There are no corner marks on it and no engraved band
 * between them: engraving is the footer's, and nowhere else's. The pagination
 * at the foot is two pieces of glass, so leaving a document looks like the rest
 * of the site.
 */
export function DocsArticle({ slug }: { slug: DocSlug }) {
  const doc = docs[slug];
  const index = docsNavigation.findIndex((item) => item.slug === slug);
  const next = docsNavigation[index + 1];
  const previous = docsNavigation[index - 1];

  return (
    <article className="docs-article">
      <Reveal as="header" className="docs-article-header">
        <span className="light-cone docs-cone" aria-hidden="true" />
        {/* A mono "Docs / Whitepaper" breadcrumb used to open this header. The
            sidebar marks the current document, the bar marks the section and
            the title is directly underneath, so the tag was a path-shaped
            label repeating all three. The row is only drawn when it has the
            draft badge to carry. */}
        {doc.draft ? (
          <div className="docs-meta">
            <Badge dark>Draft</Badge>
          </div>
        ) : null}
        <h1>{doc.title}</h1>
        <p className="docs-lede">{doc.description}</p>
      </Reveal>

      <Reveal as="div" className="prose" delay={60}>
        {doc.content}
      </Reveal>

      <nav className="docs-pagination" aria-label="Documentation pages">
        {previous ? (
          <Reveal className="docs-page-cell">
            <Link className="docs-page-card glass ix-card" href={previous.href}>
              <span className="docs-page-kind">
                <span
                  className="docs-page-arrow docs-page-back"
                  aria-hidden="true"
                >
                  <Arrow />
                </span>
                Previous
              </span>
              <strong>{previous.title}</strong>
            </Link>
          </Reveal>
        ) : (
          <span className="docs-page-cell" />
        )}
        {next ? (
          <Reveal className="docs-page-cell docs-page-next" delay={80}>
            <Link className="docs-page-card glass ix-card" href={next.href}>
              <span className="docs-page-kind">
                Next
                <span className="docs-page-arrow" aria-hidden="true">
                  <Arrow />
                </span>
              </span>
              <strong>{next.title}</strong>
            </Link>
          </Reveal>
        ) : (
          <span className="docs-page-cell docs-page-next" />
        )}
      </nav>
    </article>
  );
}
