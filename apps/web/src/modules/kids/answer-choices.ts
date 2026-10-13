import { createHash } from "node:crypto";

type ChoiceCandidate = { quizId: string; answer: unknown };
type Answer = { canonical: string; aliases: string[] };

/** Only the correct canonical answer is stored on the question. Kids decoys are drawn from other approved questions. */
function readAnswer(value: unknown): Answer {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { canonical: "", aliases: [] };
  const raw = value as Record<string, unknown>;
  return {
    canonical: typeof raw.canonical === "string" ? raw.canonical.trim() : "",
    aliases: Array.isArray(raw.aliases) ? raw.aliases.filter((x): x is string => typeof x === "string") : []
  };
}

const key = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const digest = (seed: string) => createHash("sha256").update(seed).digest();
const randomIndex = (seed: string, length: number) => digest(seed).readUInt32BE(0) % length;

/**
 * For a run, assign each consecutive group of N rounds a seeded permutation of
 * the N answer positions. This distributes positions evenly without exposing an
 * answer key or moving buttons when the same session is loaded again.
 * Standalone questions use a stable session-specific position.
 */
function correctPosition(sessionId: string, runId: string | null, roundIndex: number | null, size: number) {
  if (!runId || roundIndex === null || !Number.isInteger(roundIndex) || roundIndex < 0)
    return randomIndex(sessionId + ":correct-position", size);
  const group = Math.floor(roundIndex / size);
  const positions = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) {
    const j = randomIndex(runId + ":correct-positions:" + group + ":" + i, i + 1);
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions[roundIndex % size];
}

/** Pure, repeatable generation: prefer siblings in the playing pack; reject overlapping synonyms. */
export function buildKidAnswerChoices(input: {
  sessionId: string;
  runId: string | null;
  roundIndex: number | null;
  answer: unknown;
  candidates: readonly ChoiceCandidate[];
  preferredQuizIds?: ReadonlySet<string>;
  minDecoys: number;
}): string[] {
  const correct = readAnswer(input.answer);
  if (!correct.canonical) return [];
  const used = new Set([correct.canonical, ...correct.aliases].map(key).filter(Boolean));
  const options: string[] = [];
  const preferred = input.preferredQuizIds ?? new Set<string>();

  const ordered = input.candidates
    .map(candidate => ({ ...candidate, parsed: readAnswer(candidate.answer) }))
    .filter(candidate => candidate.parsed.canonical)
    .sort((a, b) => {
      const preference = Number(preferred.has(b.quizId)) - Number(preferred.has(a.quizId));
      if (preference) return preference;
      const aKey = digest(input.sessionId + ":decoy:" + a.parsed.canonical).toString("hex");
      const bKey = digest(input.sessionId + ":decoy:" + b.parsed.canonical).toString("hex");
      return aKey.localeCompare(bKey) || a.quizId.localeCompare(b.quizId);
    });

  for (const candidate of ordered) {
    const accepted = [candidate.parsed.canonical, ...candidate.parsed.aliases].map(key).filter(Boolean);
    if (accepted.some(name => used.has(name))) continue;
    for (const name of accepted) used.add(name);
    options.push(candidate.parsed.canonical);
    if (options.length === 3) break;
  }
  if (options.length < input.minDecoys) return [];

  const slot = correctPosition(input.sessionId, input.runId, input.roundIndex, options.length + 1);
  options.splice(slot, 0, correct.canonical);
  return options;
}
