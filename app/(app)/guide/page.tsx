import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import {
  INSUFFICIENT_EVIDENCE_EXPLAINED,
  PDF_ASK_EXPECTATION,
} from "@/lib/beta-copy";

export default function PrivateBetaGuidePage() {
  return (
    <div>
      <PageHeader
        kicker="Private beta"
        title="How to use SITEPM"
        description="Short orientation for invited builders. This is not a full help center."
      />
      <Card>
        <ol className="space-y-5 text-sm leading-6 text-stone-700">
          <li>
            <p className="font-medium text-stone-950">1. Create a project</p>
            <p className="mt-1">
              Open{" "}
              <Link href="/projects/new" className="font-medium text-stone-950">
                Projects
              </Link>{" "}
              and add the job (name, address, client if you have it). Everything
              else hangs off that job.
            </p>
          </li>
          <li>
            <p className="font-medium text-stone-950">
              2. Capture work on that job
            </p>
            <p className="mt-1">
              Add a task (what needs doing, who, when) or a field log (what
              happened on site). Photos are not part of this beta.
            </p>
          </li>
          <li>
            <p className="font-medium text-stone-950">
              3. Upload a digital-text PDF
            </p>
            <p className="mt-1">{PDF_ASK_EXPECTATION}</p>
          </li>
          <li>
            <p className="font-medium text-stone-950">
              4. Ask SITEPM about that same job
            </p>
            <p className="mt-1">
              Open the project, choose Ask SITEPM, and ask a question about{" "}
              <em>this</em> job only — specs, dates, tasks, field notes, or PDF
              text SITEPM could read. Then check Sources. A document source
              should name the file and page.
            </p>
          </li>
          <li>
            <p className="font-medium text-stone-950">
              5. What “insufficient evidence” means
            </p>
            <p className="mt-1">{INSUFFICIENT_EVIDENCE_EXPLAINED}</p>
          </li>
          <li>
            <p className="font-medium text-stone-950">6. If something is wrong</p>
            <p className="mt-1">
              Message the person who invited you. Include the job name, what you
              tried (upload, Ask, task, field log), and about when it happened.
              Do not send passwords or other companies&apos; files.
            </p>
          </li>
        </ol>
        <p className="mt-6 text-sm text-stone-500">
          Scans and drawings are not supported by document search yet. Store
          them if you need the file; do not expect Ask to read them.
        </p>
      </Card>
    </div>
  );
}
