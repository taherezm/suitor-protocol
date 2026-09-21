import { DocsSidebar } from "@/components/docs-sidebar";

/**
 * Two columns: a sticky glass rail and one column of reading. The rail is a
 * sibling rather than a wrapper, so nothing between it and the viewport can
 * establish a containing block and strand its `position: sticky`.
 */
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="shell docs-layout">
      <DocsSidebar />
      {children}
    </div>
  );
}
