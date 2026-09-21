import { Hero } from "@/components/home/hero";
import { PoolTerminal } from "@/components/home/pool-terminal";
import { PoolStatement } from "@/components/home/pool-statement";
import { SectionIndex } from "@/components/home/section-index";
import { UnderwritingFlow } from "@/components/home/underwriting-flow";
import { AssessmentFile } from "@/components/home/assessment-file";
import { CaseTimeline } from "@/components/home/case-timeline";
import { Outcomes } from "@/components/home/outcomes";
import { OutcomeEngine } from "@/components/home/outcome-engine";
import { Closing } from "@/components/home/closing";
import { protocolData } from "@/lib/sample-data";

/**
 * The whole product on one page. The docs keep their own routes; everything
 * else is a section here, and the four `.anchor-group` wrappers are what the
 * navigation points at and what the scroll spy watches.
 *
 * `.anchor-group` sets scroll-margin-top and nothing else. It must never take
 * an overflow, transform, filter or contain, because the timeline inside is
 * `position: sticky` and any of those would strand it.
 */
const underwritingIndex = [
  { n: "01", label: "Review process", href: "#review" },
  { n: "02", label: "Sample assessment", href: "#assessment" },
  { n: "03", label: "Outcome engine", href: "#outcome-engine" },
];

export default async function Home() {
  const [pool, outcomes, assessment] = await Promise.all([
    protocolData.getPool(),
    protocolData.getOutcomePreview(),
    protocolData.getAssessment(),
  ]);

  return (
    <>
      <Hero />

      <div id="pool" className="anchor-group">
        <PoolTerminal pool={pool} outcomes={outcomes} assessment={assessment} />
        <PoolStatement pool={pool} />
      </div>

      <div id="underwriting" className="anchor-group">
        <SectionIndex items={underwritingIndex} />
        <UnderwritingFlow />
        <AssessmentFile assessment={assessment} />
      </div>

      <div id="timeline" className="anchor-group">
        <CaseTimeline outcomes={outcomes} assessment={assessment} />
      </div>

      <div id="outcomes" className="anchor-group">
        <Outcomes outcomes={outcomes} />
        <OutcomeEngine outcomes={outcomes} />
      </div>

      <Closing />
    </>
  );
}
