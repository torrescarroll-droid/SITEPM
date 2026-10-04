/**
 * Stage 4E retrieval Experiment 2 — evaluator/shadow tooling ONLY.
 * NOT production retrieval. Must not be imported by Ask, Stage 4C, or providers.
 *
 * Hypothesis: construction-family unigrams and hyphen phrases, merged so
 * narrow component/event/document searches control ranking while broad
 * location searches contribute to union/recall, can improve first-8 quality
 * without production SQL, embeddings, LLMs, or ground-truth generation.
 *
 * Family lexicons are frozen CLOSED lists of generic construction/query
 * language. They are not derived from RP001 gold, answers, or question IDs.
 */

import { DOCUMENT_CHUNK_RETRIEVAL_CAP } from "@/lib/document-chunk-retrieval";
import type { DocumentChunkHit } from "@/lib/document-intelligence-types";

export const STAGE4E_FTS_EXPERIMENT2_MAX_SUBQUERIES = 6;
export const STAGE4E_FTS_EXPERIMENT2_CANDIDATE_CAP = DOCUMENT_CHUNK_RETRIEVAL_CAP;
export const STAGE4E_FTS_EXPERIMENT2_LABEL =
  "STAGE 4E RETRIEVAL EXPERIMENT 2 — CONSTRUCTION-FAMILY + SIGNAL-AWARE MERGE — NOT PRODUCTION";

/** Same NL scaffolding set as Experiment 1 (duplicated so Exp 1 files stay frozen). */
export const STAGE4E_FTS_EXPERIMENT2_STOPWORDS = new Set([
  "i",
  "me",
  "my",
  "myself",
  "we",
  "our",
  "ours",
  "ourselves",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
  "he",
  "him",
  "his",
  "himself",
  "she",
  "her",
  "hers",
  "herself",
  "it",
  "its",
  "itself",
  "they",
  "them",
  "their",
  "theirs",
  "themselves",
  "what",
  "which",
  "who",
  "whom",
  "this",
  "that",
  "these",
  "those",
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "having",
  "do",
  "does",
  "did",
  "doing",
  "a",
  "an",
  "the",
  "and",
  "but",
  "if",
  "or",
  "because",
  "as",
  "until",
  "while",
  "of",
  "at",
  "by",
  "for",
  "with",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "to",
  "from",
  "up",
  "down",
  "in",
  "out",
  "on",
  "off",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "s",
  "t",
  "can",
  "will",
  "just",
  "don",
  "should",
  "now",
  "would",
  "could",
  "show",
]);

/**
 * Frozen Experiment 2 family lexicons.
 * Generic construction / builder-question language. Not RP001 gold-derived.
 */
export const STAGE4E_FTS_EXPERIMENT2_BROAD_LOCATION = [
  "area",
  "bathroom",
  "bedroom",
  "building",
  "ceiling",
  "closet",
  "east",
  "field",
  "floor",
  "garden",
  "ground",
  "hallway",
  "house",
  "indoor",
  "jobsite",
  "kitchen",
  "living",
  "north",
  "outdoor",
  "pantry",
  "room",
  "site",
  "south",
  "upstairs",
  "wall",
  "west",
  "yard",
] as const;

export const STAGE4E_FTS_EXPERIMENT2_COMPONENT = [
  "actuator",
  "actuators",
  "boiler",
  "cabinet",
  "circuit",
  "control",
  "controls",
  "electrical",
  "finish",
  "fitting",
  "fittings",
  "flooring",
  "heating",
  "hydronic",
  "length",
  "lengths",
  "loop",
  "loops",
  "manifold",
  "manifolds",
  "paint",
  "panel",
  "pipe",
  "piping",
  "pump",
  "radiant",
  "rh",
  "stone",
  "subfloor",
  "system",
  "thermostat",
  "tube",
  "tubing",
  "valve",
  "voltage",
  "wiring",
  "wood",
] as const;

export const STAGE4E_FTS_EXPERIMENT2_ACTION_EVENT = [
  "april",
  "approved",
  "august",
  "commission",
  "commissioning",
  "complaint",
  "covered",
  "covering",
  "december",
  "designed",
  "february",
  "install",
  "installation",
  "installed",
  "investigate",
  "investigation",
  "january",
  "july",
  "june",
  "march",
  "may",
  "missing",
  "november",
  "october",
  "punctured",
  "recorded",
  "relocated",
  "relocation",
  "repair",
  "repaired",
  "replace",
  "replaced",
  "replacement",
  "september",
  "serves",
  "service",
  "serviced",
  "serving",
] as const;

export const STAGE4E_FTS_EXPERIMENT2_DOCUMENT_BUSINESS = [
  "asbuilt",
  "budget",
  "change",
  "closeout",
  "completion",
  "contract",
  "cost",
  "coverage",
  "drawing",
  "invoice",
  "ledger",
  "log",
  "manual",
  "order",
  "paid",
  "permit",
  "photo",
  "photograph",
  "photographs",
  "plan",
  "plans",
  "record",
  "rfi",
  "schedule",
  "spec",
  "specification",
  "subcontract",
  "submittal",
  "warranty",
  "workmanship",
] as const;

export const STAGE4E_FTS_EXPERIMENT2_WEAK_DISCOURSE = [
  "applies",
  "direct",
  "handled",
  "inquiries",
  "proves",
  "remains",
  "say",
  "says",
  "versus",
  "whether",
] as const;

export type Stage4eFtsExperiment2Family =
  | "broad_location"
  | "component"
  | "action_event"
  | "document_business"
  | "narrow_construction"
  | "fallback";

export type Stage4eFtsExperiment2Signal = "broad" | "narrow";

export type Stage4eFtsExperiment2SubqueryOrigin =
  | "hyphen_phrase"
  | "component_unigram"
  | "action_event_unigram"
  | "document_business_unigram"
  | "broad_location_phrase"
  | "fallback_join";

export type Stage4eFtsExperiment2Subquery = {
  query: string;
  origin: Stage4eFtsExperiment2SubqueryOrigin;
  family: Stage4eFtsExperiment2Family;
  signal: Stage4eFtsExperiment2Signal;
};

type PhraseSpan = { start: number; end: number; text: string };

const BROAD = new Set<string>(STAGE4E_FTS_EXPERIMENT2_BROAD_LOCATION);
const COMPONENT = new Set<string>(STAGE4E_FTS_EXPERIMENT2_COMPONENT);
const ACTION = new Set<string>(STAGE4E_FTS_EXPERIMENT2_ACTION_EVENT);
const DOCUMENT = new Set<string>(STAGE4E_FTS_EXPERIMENT2_DOCUMENT_BUSINESS);
const WEAK = new Set<string>(STAGE4E_FTS_EXPERIMENT2_WEAK_DISCOURSE);

export function frozenStage4eFtsExperiment2Lexicons() {
  return {
    broad_location: [...STAGE4E_FTS_EXPERIMENT2_BROAD_LOCATION],
    component: [...STAGE4E_FTS_EXPERIMENT2_COMPONENT],
    action_event: [...STAGE4E_FTS_EXPERIMENT2_ACTION_EVENT],
    document_business: [...STAGE4E_FTS_EXPERIMENT2_DOCUMENT_BUSINESS],
    weak_discourse: [...STAGE4E_FTS_EXPERIMENT2_WEAK_DISCOURSE],
  };
}

function normalizeQuestion(question: string) {
  return question.trim().toLowerCase();
}

function isDateLikePhrase(phrase: string) {
  return /^[\d][\d-]*$/.test(phrase.replace(/\s/g, "-"));
}

function collectHyphenPhrases(normalized: string): PhraseSpan[] {
  const spans: PhraseSpan[] = [];
  const re = /[a-z0-9]+(?:-[a-z0-9]+)+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized))) {
    const text = match[0];
    if (isDateLikePhrase(text)) {
      continue;
    }
    spans.push({ start: match.index, end: match.index + text.length, text });
  }
  return spans;
}

function isStopword(token: string) {
  return STAGE4E_FTS_EXPERIMENT2_STOPWORDS.has(token);
}

function isPureNumeric(token: string) {
  return /^\d+$/.test(token);
}

function coveredByPhrase(index: number, phrases: PhraseSpan[]) {
  return phrases.some((span) => index >= span.start && index < span.end);
}

function usefulToken(token: string) {
  return (
    token.length >= 2 &&
    !isStopword(token) &&
    !isPureNumeric(token) &&
    !WEAK.has(token)
  );
}

export function classifyStage4eFtsExperiment2Token(
  token: string,
): Stage4eFtsExperiment2Family | "weak_discourse" | null {
  const normalized = token.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (WEAK.has(normalized)) {
    return "weak_discourse";
  }
  if (BROAD.has(normalized)) {
    return "broad_location";
  }
  if (COMPONENT.has(normalized)) {
    return "component";
  }
  if (ACTION.has(normalized)) {
    return "action_event";
  }
  if (DOCUMENT.has(normalized)) {
    return "document_business";
  }
  return null;
}

function phraseTokens(phrase: string) {
  return phrase
    .split(/[^a-z0-9]+/i)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length >= 2 && !isPureNumeric(token));
}

function classifyHyphenPhrase(rawHyphen: string): {
  family: Stage4eFtsExperiment2Family;
  signal: Stage4eFtsExperiment2Signal;
} {
  const tokens = phraseTokens(rawHyphen.replace(/-/g, " "));
  const families = tokens
    .map((token) => classifyStage4eFtsExperiment2Token(token))
    .filter((item): item is Stage4eFtsExperiment2Family =>
      Boolean(item && item !== "weak_discourse"),
    );
  if (
    families.length > 0 &&
    families.every((item) => item === "broad_location")
  ) {
    return { family: "broad_location", signal: "broad" };
  }
  if (families.includes("component")) {
    return { family: "component", signal: "narrow" };
  }
  if (families.includes("action_event")) {
    return { family: "action_event", signal: "narrow" };
  }
  if (families.includes("document_business")) {
    return { family: "document_business", signal: "narrow" };
  }
  return { family: "narrow_construction", signal: "narrow" };
}

function originForFamily(
  family: Stage4eFtsExperiment2Family,
): Stage4eFtsExperiment2SubqueryOrigin {
  if (family === "component") {
    return "component_unigram";
  }
  if (family === "action_event") {
    return "action_event_unigram";
  }
  if (family === "document_business") {
    return "document_business_unigram";
  }
  if (family === "broad_location") {
    return "broad_location_phrase";
  }
  return "fallback_join";
}

function pushUnique(
  out: Stage4eFtsExperiment2Subquery[],
  seen: Set<string>,
  query: string,
  origin: Stage4eFtsExperiment2SubqueryOrigin,
  family: Stage4eFtsExperiment2Family,
  signal: Stage4eFtsExperiment2Signal,
) {
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!normalized || seen.has(normalized)) {
    return;
  }
  if (out.length >= STAGE4E_FTS_EXPERIMENT2_MAX_SUBQUERIES) {
    return;
  }
  seen.add(normalized);
  out.push({ query: normalized, origin, family, signal });
}

/**
 * Deterministic Experiment 2 generation. Question string only.
 */
export function decomposeStage4eFtsExperiment2Question(
  question: string,
): Stage4eFtsExperiment2Subquery[] {
  const normalized = normalizeQuestion(question);
  const phrases = collectHyphenPhrases(normalized);
  const leftover: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    if (coveredByPhrase(cursor, phrases)) {
      const span = phrases.find(
        (item) => cursor >= item.start && cursor < item.end,
      );
      if (!span) {
        cursor += 1;
        continue;
      }
      cursor = span.end;
      continue;
    }
    const rest = normalized.slice(cursor);
    const tokenMatch = rest.match(/^[a-z0-9]+/);
    if (!tokenMatch) {
      cursor += 1;
      continue;
    }
    const token = tokenMatch[0];
    if (usefulToken(token)) {
      leftover.push(token);
    }
    cursor += token.length;
  }

  const out: Stage4eFtsExperiment2Subquery[] = [];
  const seen = new Set<string>();
  let emittedBroad = false;

  for (const phrase of phrases) {
    const query = phrase.text.replace(/-/g, " ");
    const classified = classifyHyphenPhrase(phrase.text);
    if (classified.signal === "broad") {
      if (emittedBroad) {
        continue;
      }
      emittedBroad = true;
      pushUnique(
        out,
        seen,
        query,
        "hyphen_phrase",
        "broad_location",
        "broad",
      );
      continue;
    }
    pushUnique(
      out,
      seen,
      query,
      "hyphen_phrase",
      classified.family,
      "narrow",
    );
  }

  const leftoverByFamily: Record<
    "component" | "action_event" | "document_business",
    string[]
  > = {
    component: [],
    action_event: [],
    document_business: [],
  };
  for (const token of leftover) {
    const family = classifyStage4eFtsExperiment2Token(token);
    if (
      family === "component" ||
      family === "action_event" ||
      family === "document_business"
    ) {
      leftoverByFamily[family].push(token);
    }
  }

  for (const token of leftoverByFamily.component) {
    pushUnique(
      out,
      seen,
      token,
      originForFamily("component"),
      "component",
      "narrow",
    );
  }
  for (const token of leftoverByFamily.action_event) {
    pushUnique(
      out,
      seen,
      token,
      originForFamily("action_event"),
      "action_event",
      "narrow",
    );
  }
  for (const token of leftoverByFamily.document_business) {
    pushUnique(
      out,
      seen,
      token,
      originForFamily("document_business"),
      "document_business",
      "narrow",
    );
  }

  if (!emittedBroad) {
    const locationRun: string[] = [];
    let collecting = false;
    for (const token of leftover) {
      if (classifyStage4eFtsExperiment2Token(token) === "broad_location") {
        collecting = true;
        locationRun.push(token);
        continue;
      }
      if (collecting) {
        break;
      }
    }
    if (locationRun.length > 0) {
      pushUnique(
        out,
        seen,
        locationRun.join(" "),
        "broad_location_phrase",
        "broad_location",
        "broad",
      );
    }
  }

  if (out.length === 0) {
    const fallbackTokens = leftover.length > 0 ? leftover : phraseTokens(normalized).filter(usefulToken);
    if (fallbackTokens.length > 0) {
      pushUnique(
        out,
        seen,
        fallbackTokens.join(" "),
        "fallback_join",
        "fallback",
        "narrow",
      );
    }
  }
  return out;
}

export type Stage4eFtsExperiment2MergeSource = {
  subqueryIndex: number;
  query: string;
  signal: Stage4eFtsExperiment2Signal;
  family: Stage4eFtsExperiment2Family;
  hits: DocumentChunkHit[];
};

type MergeAccumulator = {
  hit: DocumentChunkHit;
  hasNarrowMatch: boolean;
  narrowMatchCount: number;
  narrowBestPosition: number;
  broadLocationPosition: number;
};

const NO_BROAD_POSITION = 10_000;
const NO_NARROW_POSITION = 10_000;

function identityTieBreak(a: DocumentChunkHit, b: DocumentChunkHit) {
  if (a.document_id !== b.document_id) {
    return a.document_id < b.document_id ? -1 : 1;
  }
  if (a.locator !== b.locator) {
    return a.locator < b.locator ? -1 : 1;
  }
  if (a.part_index !== b.part_index) {
    return a.part_index - b.part_index;
  }
  return a.chunk_id < b.chunk_id ? -1 : a.chunk_id > b.chunk_id ? 1 : 0;
}

export type Stage4eFtsExperiment2MergeMeta = {
  chunk_id: string;
  hasNarrowMatch: boolean;
  narrowMatchCount: number;
  narrowBestPosition: number | null;
  broadLocationPosition: number | null;
};

export function mergeStage4eFtsExperiment2HitsDetailed(
  sources: Stage4eFtsExperiment2MergeSource[],
  cap = STAGE4E_FTS_EXPERIMENT2_CANDIDATE_CAP,
): { hits: DocumentChunkHit[]; meta: Stage4eFtsExperiment2MergeMeta[] } {
  const byChunk = new Map<string, MergeAccumulator>();
  for (const source of sources) {
    const isBroadLocation =
      source.signal === "broad" && source.family === "broad_location";
    source.hits.forEach((hit, index) => {
      const position = index + 1;
      let existing = byChunk.get(hit.chunk_id);
      if (!existing) {
        existing = {
          hit,
          hasNarrowMatch: false,
          narrowMatchCount: 0,
          narrowBestPosition: NO_NARROW_POSITION,
          broadLocationPosition: NO_BROAD_POSITION,
        };
        byChunk.set(hit.chunk_id, existing);
      }
      if (isBroadLocation) {
        existing.broadLocationPosition = Math.min(
          existing.broadLocationPosition,
          position,
        );
        if (!existing.hasNarrowMatch) {
          existing.hit = hit;
        }
      } else {
        existing.hasNarrowMatch = true;
        existing.narrowMatchCount += 1;
        if (position < existing.narrowBestPosition) {
          existing.narrowBestPosition = position;
          existing.hit = hit;
        }
      }
    });
  }
  const ranked = [...byChunk.values()].sort((a, b) => {
    if (a.hasNarrowMatch !== b.hasNarrowMatch) {
      return a.hasNarrowMatch ? -1 : 1;
    }
    if (a.narrowMatchCount !== b.narrowMatchCount) {
      return b.narrowMatchCount - a.narrowMatchCount;
    }
    if (a.narrowBestPosition !== b.narrowBestPosition) {
      return a.narrowBestPosition - b.narrowBestPosition;
    }
    if (a.broadLocationPosition !== b.broadLocationPosition) {
      return a.broadLocationPosition - b.broadLocationPosition;
    }
    return identityTieBreak(a.hit, b.hit);
  });
  const capped = ranked.slice(0, cap);
  return {
    hits: capped.map((item) => item.hit),
    meta: capped.map((item) => ({
      chunk_id: item.hit.chunk_id,
      hasNarrowMatch: item.hasNarrowMatch,
      narrowMatchCount: item.narrowMatchCount,
      narrowBestPosition:
        item.narrowBestPosition === NO_NARROW_POSITION
          ? null
          : item.narrowBestPosition,
      broadLocationPosition:
        item.broadLocationPosition === NO_BROAD_POSITION
          ? null
          : item.broadLocationPosition,
    })),
  };
}

export function mergeStage4eFtsExperiment2Hits(
  sources: Stage4eFtsExperiment2MergeSource[],
  cap = STAGE4E_FTS_EXPERIMENT2_CANDIDATE_CAP,
): DocumentChunkHit[] {
  return mergeStage4eFtsExperiment2HitsDetailed(sources, cap).hits;
}

export function stage4eFtsExperiment2DecomposeArityIsQuestionOnly(
  fn: typeof decomposeStage4eFtsExperiment2Question,
) {
  return fn.length === 1;
}

export function stage4eFtsExperiment2BroadQueryCount(
  subqueries: Stage4eFtsExperiment2Subquery[],
) {
  return subqueries.filter((item) => item.signal === "broad").length;
}
