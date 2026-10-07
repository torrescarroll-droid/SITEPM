import type { AskCitation, AskEpistemicKind } from "@/lib/ask-types";
import type { AskEvidenceItem, AskEvidencePack } from "@/lib/ask-evidence";

export type NextScheduleAnswer = {
  answer: string;
  citations: AskCitation[];
  insufficientEvidence: boolean;
  epistemicKind: AskEpistemicKind;
};

/**
 * Schedule-sequence questions only. To-do, delay, and predecessor questions stay on the normal path.
 * Matching does not read project names, record ids, or commissioning text.
 */
export function questionAsksNextScheduledWork(question: string) {
  const normalized = question
    .trim()
    .toLowerCase()
    .replace(/[?!.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  if (/\bto-?dos?\b/.test(normalized) || /\btasks?\b/.test(normalized) || /\bwork items?\b/.test(normalized)) {
    return false;
  }
  if (/\bbefore\b/.test(normalized) && /\b(happen|need|needs|required|predecessor)\b/.test(normalized)) {
    return false;
  }
  return (
    /\bscheduled next\b/.test(normalized) ||
    /\bnext scheduled\b/.test(normalized) ||
    /\bnext on the schedule\b/.test(normalized) ||
    /\bupcoming on the schedule\b/.test(normalized) ||
    /\bcoming up on the schedule\b/.test(normalized)
  );
}

function cite(item: AskEvidenceItem): AskCitation {
  return {
    type: "schedule_activity",
    id: item.sourceId,
    label: item.label,
  };
}

function activitySentence(item: AskEvidenceItem, lead: string) {
  const name = typeof item.data.name === "string" && item.data.name ? item.data.name : item.label;
  const start = typeof item.data.start_date === "string" ? item.data.start_date : null;
  const finish = typeof item.data.finish_date === "string" ? item.data.finish_date : null;
  const trade = typeof item.data.trade_name === "string" ? item.data.trade_name : null;
  const predecessor =
    typeof item.data.predecessor_name === "string" ? item.data.predecessor_name : null;
  const sentences = [`${lead} ${name}.`];
  if (start && finish && finish !== start) {
    sentences.push(`It is scheduled from ${start} through ${finish}.`);
  } else if (start) {
    sentences.push(`It is scheduled on ${start}.`);
  }
  if (item.data.is_milestone === true) sentences.push("It is a milestone.");
  if (trade) sentences.push(`Trade: ${trade}.`);
  if (predecessor) sentences.push(`It follows ${predecessor}.`);
  return sentences.join(" ");
}

/**
 * Answers a next-scheduled-work question from schedule activities already in the authorized pack.
 * Returns null when the question is not that kind, so to-do questions keep the normal Ask path.
 */
export function answerNextScheduledWork(
  question: string,
  pack: AskEvidencePack,
): NextScheduleAnswer | null {
  if (!questionAsksNextScheduledWork(question)) return null;

  const activities = pack.evidence.filter((item) => item.sourceType === "schedule_activity");
  const next = activities.find((item) => item.data.schedule_position === "next");
  if (next) {
    return {
      answer: activitySentence(next, "The next scheduled activity is"),
      citations: [cite(next)],
      insufficientEvidence: false,
      epistemicKind: "documented_fact",
    };
  }

  const current = activities.find((item) => item.data.schedule_position === "current");
  if (current) {
    return {
      answer: activitySentence(
        current,
        "No schedule activity starts after today. The current schedule activity is",
      ),
      citations: [cite(current)],
      insufficientEvidence: false,
      epistemicKind: "documented_fact",
    };
  }

  return {
    answer: "This job's schedule has no upcoming activity in the records.",
    citations: [],
    insufficientEvidence: true,
    epistemicKind: "insufficient_evidence",
  };
}
