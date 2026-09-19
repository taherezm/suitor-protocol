import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsArticle } from "@/components/docs-article";
import { docsNavigation, type DocSlug } from "@/lib/docs-navigation";

export function generateStaticParams() {
  return docsNavigation
    .filter((item) => item.slug !== "overview")
    .map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title:
      docsNavigation.find((item) => item.slug === slug)?.title ??
      "Documentation",
  };
}

export default async function DocumentationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!docsNavigation.some((item) => item.slug === slug && slug !== "overview"))
    notFound();
  return <DocsArticle slug={slug as DocSlug} />;
}
