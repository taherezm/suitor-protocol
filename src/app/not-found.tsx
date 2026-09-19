import Link from "next/link";
import { PageIntro } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="not-found">
      <PageIntro eyebrow="404 / Page not found" title="This page isn’t here.">
        <p>
          Return to the protocol overview or find a topic in the documentation.
        </p>
      </PageIntro>
      <div className="hero-actions">
        <Link className="button button-primary" href="/">
          Back to home
        </Link>
        <Link className="button button-secondary" href="/docs">
          Browse the docs
        </Link>
      </div>
    </div>
  );
}
