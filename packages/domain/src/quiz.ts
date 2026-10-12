/** Content model shared by future Web Studio, Play and Remote MCP. */
/** Game mechanic, not the type of answer. */
export type QuizMode = "progressive-clues";
export type AnswerType = "person" | "animal" | "place" | "thing" | "event" | "concept" | "other";
export interface QuizTopic { name: string; isSpoiler?: boolean; }

export type Clue =
  | { id: string; order: number; type: "text"; text: string }
  | {
      id: string;
      order: number;
      type: "image" | "audio" | "video";
      media: { url: string; alt?: string; transcript?: string; attribution?: string };
      text?: string;
    }
  | {
      id: string;
      order: number;
      type: "image-reveal";
      media: { url: string; alt?: string; attribution?: string };
      reveal: { effect: "blur" | "zoom" | "spotlight"; strength: number; focusX?: number; focusY?: number };
      text?: string;
    }
  | {
      id: string;
      order: number;
      type: "map";
      map: { latitude: number; longitude: number; zoom?: number };
      text?: string;
    };

export interface AgeRange {
  minimum?: number;
  maximum?: number;
}

export interface CreatorIntent {
  /** Creator may change this; not a safety classification. */
  ageRange?: AgeRange;
  note?: string;
}

export interface RecommendedAudience {
  /** AI/platform estimate; distinct from creator intent. */
  ageRange?: AgeRange;
  difficulty?: "easy" | "medium" | "hard";
}

export interface PlatformSafety {
  /** Only trusted server-side moderation may change this field. */
  readonly status: "pending" | "approved" | "restricted";
  readonly reviewedAt?: string;
}

export interface QuizQuestion {
  id: string;
  title: string;
  mode: QuizMode;
  answerType: AnswerType;
  topics?: QuizTopic[];
  prompt: string;
  answer: { canonical: string; aliases: string[] };
  clues: Clue[];
  creatorIntent?: CreatorIntent;
  recommendedAudience?: RecommendedAudience;
  publication: "draft" | "published" | "hidden";
  /** A type-level guard only; authorization must be enforced by the future API. */
  readonly platformSafety: PlatformSafety;
}
