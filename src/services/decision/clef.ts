/**
 * Cloudflare Clef — decision-model client
 * ========================================
 *
 * Clef is NOT a chat / narration model (that is still Gemini).
 * It is a *decision* model: you send it a `state` (facts about the world)
 * plus a schema of typed `questions`, and it returns calibrated
 * probabilities for every allowed answer.
 *
 * Docs: https://developers.cloudflare.com/ai/models/@cf/cloudflare/clef/
 *
 * Question types we care about:
 *   - noul   → Bernoulli yes/no probability in [0, 1]
 *   - choice → pick one of N labeled options (+ full probability map)
 *   - score  → ordinal rubric (e.g. Low / Med / High) as a weighted float
 *
 * In this app we currently use `choice` to pick which nearby POI to narrate.
 * The HTTP call goes straight to Workers AI REST (same "key in .env" style
 * as Gemini) — no Cloudflare Worker proxy required for personal use.
 */

import { config } from '../../config';
import { fetchJson } from '../http';

/** Model selector string required by the Clef API body. */
export type ClefModelName = 'clef' | 'clef-flash';

/** Yes/no question. */
export type ClefNoulQuestion = {
  type: 'noul';
  instructions: string;
};

/**
 * Multi-option classification.
 * `criteria` keys become the option ids returned in `answers.*.choice`
 * and in the `probabilities` map.
 */
export type ClefChoiceQuestion = {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
};

/** Ordered rubric; answer is a probability-weighted level index. */
export type ClefScoreQuestion = {
  type: 'score';
  instructions: string;
  criteria: string[];
};

export type ClefQuestion =
  | ClefNoulQuestion
  | ClefChoiceQuestion
  | ClefScoreQuestion;

export type ClefNoulAnswer = {
  type: 'noul';
  /** P(yes) in [0, 1]. */
  noul: number;
};

export type ClefChoiceAnswer = {
  type: 'choice';
  /** Argmax option id (one of the `criteria` keys). */
  choice: string;
  /** Probability per option; values sum to ~1. */
  probabilities: Record<string, number>;
  confidence: number;
};

export type ClefScoreAnswer = {
  type: 'score';
  /** Probability-weighted level (0 = first criterion). */
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};

export type ClefAnswer = ClefNoulAnswer | ClefChoiceAnswer | ClefScoreAnswer;

export type ClefRequest = {
  model: ClefModelName;
  /**
   * Evidence the model should decide from. May be a string or any JSON-serializable
   * structure (we send a compact object describing nearby POIs).
   */
  state: unknown;
  /** 1–64 questions keyed by stable ids; answers come back under the same ids. */
  questions: Record<string, ClefQuestion>;
};

export type ClefResponse = {
  model: string;
  answers: Record<string, ClefAnswer>;
  usage?: { input_tokens: number; output_tokens: number };
};

/** Cloudflare account API wraps the model payload in `{ success, result }`. */
type CloudflareAiEnvelope = {
  success?: boolean;
  result?: ClefResponse;
  errors?: Array<{ message?: string }>;
} & Partial<ClefResponse>;

export function isClefConfigured(): boolean {
  return Boolean(
    config.clefEnabled &&
      config.cloudflareAccountId &&
      config.cloudflareApiToken,
  );
}

/**
 * Run one Clef decision request.
 *
 * Throws on missing credentials, HTTP errors, or a response without `answers`.
 * Callers that want soft degradation should catch and fall back (see
 * `rankWithDecision.ts`).
 */
export async function runClef(input: {
  state: unknown;
  questions: Record<string, ClefQuestion>;
  model?: ClefModelName;
}): Promise<ClefResponse> {
  if (!isClefConfigured()) {
    throw new Error('clef_not_configured');
  }

  const accountId = config.cloudflareAccountId;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/clef`;

  const body: ClefRequest = {
    model: input.model ?? 'clef',
    state: input.state,
    questions: input.questions,
  };

  const payload = await fetchJson<CloudflareAiEnvelope>(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.cloudflareApiToken}`,
      },
      body: JSON.stringify(body),
    },
    15_000,
  );

  // Some Workers AI responses are bare `{ model, answers }`;
  // the account REST endpoint usually wraps them as `{ success, result }`.
  const result: ClefResponse | undefined =
    payload.result ??
    (payload.answers
      ? {
          model: payload.model ?? body.model,
          answers: payload.answers,
          usage: payload.usage,
        }
      : undefined);

  if (!result?.answers || Object.keys(result.answers).length === 0) {
    const detail = payload.errors?.[0]?.message ?? 'empty_clef_answers';
    throw new Error(detail);
  }

  return result;
}

/** Type guard: narrow an answer to the `choice` variant. */
export function asChoiceAnswer(
  answer: ClefAnswer | undefined,
): ClefChoiceAnswer | null {
  if (!answer || answer.type !== 'choice') {
    return null;
  }
  return answer;
}
