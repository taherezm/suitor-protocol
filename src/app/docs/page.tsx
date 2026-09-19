import type { Metadata } from "next";
import { DocsArticle } from "@/components/docs-article";

export const metadata: Metadata = { title: "Documentation" };
export default function DocsPage() {
  return <DocsArticle slug="overview" />;
}
