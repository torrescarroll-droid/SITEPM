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
        title="How to use LINEHORSE"
        description="Short orientation for invited builders. This is not a full help center."
      />
      <Card>
        <ol className="space-y-5 text-sm leading-6 text-stone-700">
          <li>
            <p className="font-medium text-stone-950">1. Create a job</p>
            <p className="mt-1">
              Open{" "}
              <Link href="/projects/new" className="font-medium text-stone-950">
                Jobs
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
              Add a to-do (a simple action), a daily report (what happened, who
              was here, and a jobsite photo), or schedule activities for the
              sequence of work.
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
              4. Ask LINEHORSE about that same job
            </p>
            <p className="mt-1">
              Open the job and use the question field on the job desk. Ask about{" "}
              <em>this</em> job only — specs, dates, to-dos, daily reports,
              schedule, or PDF text LINEHORSE could read. Then check Sources. A
              document source should name the file and page.
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
              tried (upload, a question on the job, to-do, daily report, schedule), and about when it happened.
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
