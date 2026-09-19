import Link from "next/link";
import { docs } from "@/content/docs";
import { docsNavigation, type DocSlug } from "@/lib/docs-navigation";
import { Arrow, Badge } from "./ui";

export function DocsArticle({ slug }: { slug: DocSlug }) {
  const doc = docs[slug];
  const index = docsNavigation.findIndex((item) => item.slug === slug);
  const next = docsNavigation[index + 1];
  const previous = docsNavigation[index - 1];
  return (
    <article className="docs-article">
      <header className="docs-article-header">
        <div className="docs-meta">
          <p className="eyebrow">Docs / {docsNavigation[index].title}</p>
          {doc.draft && <Badge dark>Draft</Badge>}
        </div>
        <h1>{doc.title}</h1>
        <p>{doc.description}</p>
      </header>
      <div className="prose">{doc.content}</div>
      <nav className="docs-pagination" aria-label="Documentation pages">
        {previous ? (
          <Link href={previous.href}>
            <span>Previous</span>
            <strong>{previous.title}</strong>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={next.href}>
            <span>
              Next <Arrow />
            </span>
            <strong>{next.title}</strong>
          </Link>
        )}
      </nav>
    </article>
  );
}
