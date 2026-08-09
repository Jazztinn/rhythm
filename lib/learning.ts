export const LEARNING_STORAGE_KEY = "rhythm.learning.v1";
export const LEARNING_SCHEMA_VERSION = 1 as const;

export type LearningStatus =
  | "confirmed"
  | "still-learning"
  | "contextual"
  | "rejected"
  | "keep-observing";

export type LearningResponse = "yes" | "sometimes" | "no" | "keep-observing";
export type LearningSource = "tasks" | "calendar" | "rhythms" | "slack" | "notifications";

export type LearningEvidence = {
  count: number;
  sampleSize: number;
  summary: string;
  sources: LearningSource[];
  observedFrom?: string;
  observedTo?: string;
};

export type PendingPatternChange = {
  value: string;
  question: string;
  evidence: LearningEvidence;
  inferredAt: string;
};

export type LearnedPattern = {
  id: string;
  category: string;
  subject: string;
  value: string;
  question: string;
  status: LearningStatus;
  evidence: LearningEvidence;
  inferredAt: string;
  confirmedAt?: string;
  pendingChange?: PendingPatternChange;
};

export type LearningState = {
  version: typeof LEARNING_SCHEMA_VERSION;
  enabled: boolean;
  pausedCategories: string[];
  patterns: LearnedPattern[];
};

export type PatternInference = Omit<LearnedPattern, "status" | "confirmedAt" | "pendingChange">;

export type LearningMigrationResult = {
  state: LearningState;
  status: "fresh" | "current" | "migrated" | "recovered";
};

const sources: LearningSource[] = ["tasks", "calendar", "rhythms", "slack", "notifications"];
const statuses: LearningStatus[] = ["confirmed", "still-learning", "contextual", "rejected", "keep-observing"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeEvidence(value: unknown): LearningEvidence | null {
  if (!isRecord(value) || !nonEmpty(value.summary) || !Array.isArray(value.sources)) return null;
  const validSources = value.sources.filter((source): source is LearningSource => sources.includes(source as LearningSource));
  const count = typeof value.count === "number" && Number.isFinite(value.count) ? Math.max(0, Math.floor(value.count)) : 0;
  const sampleSize = typeof value.sampleSize === "number" && Number.isFinite(value.sampleSize) ? Math.max(count, Math.floor(value.sampleSize)) : count;
  return {
    count,
    sampleSize,
    summary: value.summary.trim(),
    sources: [...new Set(validSources)],
    observedFrom: nonEmpty(value.observedFrom) ? value.observedFrom : undefined,
    observedTo: nonEmpty(value.observedTo) ? value.observedTo : undefined,
  };
}

function normalizePending(value: unknown): PendingPatternChange | undefined {
  if (!isRecord(value) || !nonEmpty(value.value) || !nonEmpty(value.question) || !nonEmpty(value.inferredAt)) return undefined;
  const evidence = normalizeEvidence(value.evidence);
  if (!evidence) return undefined;
  return { value: value.value.trim(), question: value.question.trim(), inferredAt: value.inferredAt, evidence };
}

function normalizePattern(value: unknown): LearnedPattern | null {
  if (!isRecord(value) || !nonEmpty(value.id) || !nonEmpty(value.category) || !nonEmpty(value.subject) || !nonEmpty(value.value) || !nonEmpty(value.question) || !nonEmpty(value.inferredAt) || !statuses.includes(value.status as LearningStatus)) return null;
  const evidence = normalizeEvidence(value.evidence);
  if (!evidence) return null;
  return {
    id: value.id.trim(),
    category: value.category.trim(),
    subject: value.subject.trim(),
    value: value.value.trim(),
    question: value.question.trim(),
    status: value.status as LearningStatus,
    evidence,
    inferredAt: value.inferredAt,
    confirmedAt: nonEmpty(value.confirmedAt) ? value.confirmedAt : undefined,
    pendingChange: normalizePending(value.pendingChange),
  };
}

export function createLearningState(patterns: LearnedPattern[] = []): LearningState {
  return { version: LEARNING_SCHEMA_VERSION, enabled: true, pausedCategories: [], patterns };
}

export const seedLearningState: LearningState = createLearningState([
  {
    id: "weekly-review-time",
    category: "Rhythms",
    subject: "Weekly Review",
    value: "Sunday evening",
    question: "I’ve noticed you often complete Weekly Review on Sunday evening. Is that generally accurate?",
    status: "still-learning",
    evidence: { count: 6, sampleSize: 8, summary: "Observed on 6 of the last 8 Sundays.", sources: ["rhythms"] },
    inferredAt: "2026-08-09T10:00:00.000Z",
  },
  {
    id: "admin-window",
    category: "Task categories",
    subject: "Admin work",
    value: "Usually 6–8 PM",
    question: "It looks like you often complete admin work between 6–8 PM. Would you say that’s accurate?",
    status: "still-learning",
    evidence: { count: 7, sampleSize: 10, summary: "7 of 10 recent admin tasks were completed in this window.", sources: ["tasks"] },
    inferredAt: "2026-08-09T10:00:00.000Z",
  },
  {
    id: "meeting-prep",
    category: "Preparation",
    subject: "Meeting prep",
    value: "Often the evening before",
    question: "I’ve noticed meeting preparation often moves to the evening before. Is that useful context?",
    status: "still-learning",
    evidence: { count: 4, sampleSize: 6, summary: "Observed before 4 of the last 6 meetings with preparation tasks.", sources: ["tasks", "calendar"] },
    inferredAt: "2026-08-09T10:00:00.000Z",
  },
]);

export function migrateLearningState(input: unknown): LearningMigrationResult {
  if (input === null || input === undefined) return { state: seedLearningState, status: "fresh" };
  if (!isRecord(input)) return { state: seedLearningState, status: "recovered" };

  const rawPatterns = Array.isArray(input.patterns) ? input.patterns : [];
  const patterns = rawPatterns.map(normalizePattern).filter((pattern): pattern is LearnedPattern => pattern !== null);
  if (rawPatterns.length > 0 && patterns.length === 0) return { state: seedLearningState, status: "recovered" };

  const pausedCategories = Array.isArray(input.pausedCategories)
    ? [...new Set(input.pausedCategories.filter(nonEmpty).map((category) => category.trim()))]
    : [];
  return {
    state: {
      version: LEARNING_SCHEMA_VERSION,
      enabled: typeof input.enabled === "boolean" ? input.enabled : true,
      pausedCategories,
      patterns,
    },
    status: input.version === LEARNING_SCHEMA_VERSION ? "current" : "migrated",
  };
}

export function inferPattern(inference: PatternInference): LearnedPattern {
  return { ...inference, status: "still-learning" };
}

export function addInference(state: LearningState, inference: PatternInference): LearningState {
  if (!state.enabled || state.pausedCategories.includes(inference.category)) return state;
  const existing = state.patterns.find((pattern) => pattern.id === inference.id);
  if (!existing) return { ...state, patterns: [...state.patterns, inferPattern(inference)] };

  if (existing.status === "rejected" && inference.evidence.count < existing.evidence.count + 4) return state;
  if (existing.status === "confirmed" && existing.value !== inference.value) {
    return {
      ...state,
      patterns: state.patterns.map((pattern) => pattern.id === inference.id ? {
        ...pattern,
        pendingChange: {
          value: inference.value,
          question: inference.question,
          evidence: inference.evidence,
          inferredAt: inference.inferredAt,
        },
      } : pattern),
    };
  }

  return {
    ...state,
    patterns: state.patterns.map((pattern) => pattern.id === inference.id ? {
      ...inferPattern(inference),
      status: pattern.status === "confirmed" ? "confirmed" : "still-learning",
      confirmedAt: pattern.confirmedAt,
    } : pattern),
  };
}

export function answerPattern(state: LearningState, patternId: string, response: LearningResponse, answeredAt = new Date().toISOString()): LearningState {
  return {
    ...state,
    patterns: state.patterns.map((pattern) => {
      if (pattern.id !== patternId) return pattern;
      if (pattern.pendingChange) {
        if (response === "yes") return {
          ...pattern,
          value: pattern.pendingChange.value,
          question: pattern.pendingChange.question,
          evidence: pattern.pendingChange.evidence,
          inferredAt: pattern.pendingChange.inferredAt,
          confirmedAt: answeredAt,
          pendingChange: undefined,
        };
        if (response === "keep-observing") return pattern;
        return { ...pattern, pendingChange: undefined };
      }
      const status: LearningStatus = response === "yes" ? "confirmed" : response === "sometimes" ? "contextual" : response === "no" ? "rejected" : "keep-observing";
      return { ...pattern, status, confirmedAt: status === "confirmed" ? answeredAt : undefined };
    }),
  };
}

export function canPatternInfluence(state: LearningState, pattern: LearnedPattern): boolean {
  return state.enabled && pattern.status === "confirmed" && !state.pausedCategories.includes(pattern.category);
}

export function confirmedPatterns(state: LearningState, category?: string): LearnedPattern[] {
  return state.patterns.filter((pattern) => (!category || pattern.category === category) && canPatternInfluence(state, pattern));
}

export function editPattern(state: LearningState, patternId: string, value: string, editedAt = new Date().toISOString()): LearningState {
  const cleanValue = value.trim();
  if (!cleanValue) return state;
  return {
    ...state,
    patterns: state.patterns.map((pattern) => pattern.id === patternId ? {
      ...pattern,
      value: cleanValue,
      status: "confirmed",
      confirmedAt: editedAt,
      pendingChange: undefined,
    } : pattern),
  };
}

export function removePattern(state: LearningState, patternId: string): LearningState {
  return { ...state, patterns: state.patterns.filter((pattern) => pattern.id !== patternId) };
}

export function setCategoryPaused(state: LearningState, category: string, paused: boolean): LearningState {
  const categories = new Set(state.pausedCategories);
  if (paused) categories.add(category);
  else categories.delete(category);
  return { ...state, pausedCategories: [...categories] };
}
