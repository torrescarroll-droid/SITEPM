import { AskThread } from "@/components/ask-thread";
import { PageHeader } from "@/components/ui";
import { projectName } from "@/lib/demo-data";

export default function AskPage() {
  return (
    <div>
      <PageHeader
        kicker="Ask SITEPM"
        title="Project-grounded questions"
        description={`Currently scoped to ${projectName("willow-ave")}. Answers must come from project information.`}
      />
      <AskThread />
    </div>
  );
}
