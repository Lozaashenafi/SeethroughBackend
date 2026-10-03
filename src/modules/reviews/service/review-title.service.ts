import { AppError } from '../../../shared/errors/AppError.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

/**
 * Suggested titles are kept well under the 200-character DB limit — short,
 * punchy headlines read far better than a full sentence squeezed in.
 */
const MAX_SUGGESTED_LENGTH = 64;
/** Longest a single pros/cons clause may get before it is trimmed. */
const MAX_CLAUSE = 28;
/** How many opening words of a pros/cons clause make it into the title. */
const MAX_CLAUSE_WORDS = 3;
/** Hard cap on upstream latency — fail fast into the fallback. */
const REQUEST_TIMEOUT_MS = 12_000;
/**
 * After this many consecutive upstream failures the AI is skipped for a
 * while and the local fallback is used directly, so every draft doesn't pay
 * the cost (and latency) of a request that is known to fail.
 */
const AI_COOLDOWN_MS = 5 * 60_000;
const AI_FAILURE_THRESHOLD = 2;
/**
 * Small, fast chat model on SambaNova — a title needs no reasoning power.
 * Kept in one place so it is easy to swap.
 */
const MODEL = 'Meta-Llama-3.1-8B-Instruct';

const SYSTEM_PROMPT = [
  'You write short, neutral titles for anonymous workplace reviews.',
  'Rules:',
  '- Output ONLY the title text, with no quotes and no trailing period.',
  '- Maximum 50 characters — a punchy 4-8 word headline, never a sentence.',
  '- Summarize the overall experience honestly, weighing both pros and cons.',
  '- Plain professional English; never mention that you are an AI.',
].join('\n');

function buildUserPrompt(pros: string | undefined, cons: string | undefined, jobTitle?: string): string {
  const parts: string[] = [];
  if (jobTitle) parts.push(`Job title: ${jobTitle}`);
  if (pros) parts.push(`Pros: ${pros}`);
  if (cons) parts.push(`Cons: ${cons}`);
  parts.push('Write one review title.');
  return parts.join('\n');
}

/** Capitalize a clause the way a sentence would start, for mid-title use. */
const lcFirst = (text: string): string => (text ? text.charAt(0).toLowerCase() + text.slice(1) : text);

/** Words that read as broken when a trimmed title is cut off right before one. */
const DANGLING_WORDS = new Set([
  'and', 'or', 'but', 'of', 'the', 'a', 'an', 'with', 'to', 'in', 'on', 'for',
  'at', 'by', 'from', 'that', 'which', 'who', 'is', 'are', 'was', 'were',
  'without', 'into', 'over', 'under', 'as', 'if', 'than', 'then',
]);

/** Cut text at a word boundary so a title never ends mid-word or on punctuation. */
function clampWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max + 1);
  const space = slice.lastIndexOf(' ');
  const cut = space > max * 0.5 ? slice.slice(0, space) : text.slice(0, max);
  return stripDangling(cut.split(' ')).join(' ').replace(/[\s,;:.–—-]+$/, '').trim();
}

/** Drop function words left dangling by a cut ("…decisions without"). */
function stripDangling(words: string[]): string[] {
  const out = [...words];
  for (let i = 0; i < 3 && out.length > 1; i++) {
    const last = out[out.length - 1]?.toLowerCase().replace(/[^a-z']/g, '');
    if (last && DANGLING_WORDS.has(last)) out.pop();
    else break;
  }
  return out;
}

/**
 * Take the first clause of a text and keep its opening words — a headline
 * reads far better than half of someone's first sentence.
 */
function summarizeClause(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const firstClause = cleaned
    .split(/[.;\n]/)[0]!
    .replace(/[!?,:;]+$/, '')
    .trim();
  const words = stripDangling(firstClause.split(' ').slice(0, MAX_CLAUSE_WORDS));
  const shortened = clampWords(words.join(' '), MAX_CLAUSE);
  return shortened.charAt(0).toUpperCase() + shortened.slice(1);
}

/**
 * Rotates through the fallback templates so pressing "Write it for me" again
 * returns a different draft instead of the exact same string.
 */
let fallbackRotation = 0;

/**
 * Local fallback used when the AI key is not configured or the upstream call
 * fails. Anchors on whichever side of the review carries more signal, so the
 * suggested title is still useful without any network call.
 */
export function generateFallbackTitle(
  pros: string | undefined,
  cons: string | undefined,
): string {
  const prosSummary = pros ? summarizeClause(pros) : '';
  const consSummary = cons ? summarizeClause(cons) : '';
  const prosLower = lcFirst(prosSummary);
  const consLower = lcFirst(consSummary);

  let templates: string[];
  if (prosSummary && consSummary) {
    // Short connectors, paired with both orders — only the combinations that
    // fit on one short line are offered for rotation.
    const connectors = [', but ', ', yet ', ' — but ', ' — though '];
    const orders: Array<[string, string]> = [
      [prosSummary, consLower],
      [consSummary, prosLower],
    ];
    const fitting = connectors.flatMap((connector) =>
      orders
        .filter(([left, right]) => left.length + connector.length + right.length <= MAX_SUGGESTED_LENGTH)
        .map(([left, right]) => `${left}${connector}${right}`),
    );
    templates =
      fitting.length > 0
        ? fitting
        : [
            // Both sides are too long for a single line — one complete clause
            // reads better than two that are cut in half.
            `The good: ${prosSummary}`,
            `The downside: ${consLower}`,
            prosSummary,
            consSummary,
          ];
  } else if (prosSummary) {
    templates = [
      `The good: ${prosSummary}`,
      `What I liked: ${prosLower}`,
      `The upside: ${prosLower}`,
    ];
  } else if (consSummary) {
    templates = [
      `The rough edges: ${consSummary}`,
      `What didn't work: ${consLower}`,
      `The downside: ${consLower}`,
    ];
  } else {
    templates = [
      'My experience working here',
      'How it actually went',
      'The honest version of my time here',
    ];
  }

  const pick = templates[fallbackRotation % templates.length]!;
  fallbackRotation = (fallbackRotation + 1) % 1_000_000;

  // Review titles must be at least 10 characters — very short inputs would
  // otherwise produce a title the form rejects — and must start capitalized.
  const title = clampWords(pick, MAX_SUGGESTED_LENGTH);
  const polished = title ? title.charAt(0).toUpperCase() + title.slice(1) : title;
  return polished.length >= 10 ? polished : 'My experience working here';
}

interface SuggestTitleInput {
  pros?: string;
  cons?: string;
  jobTitle?: string;
  /** `auto` = form draft while typing, `manual` = explicit button click. */
  trigger?: 'auto' | 'manual';
}

class ReviewTitleService {
  private consecutiveFailures = 0;
  private aiDownUntil = 0;

  /**
   * Generate a review title from the review's pros/cons. Uses SambaNova when
   * SAMBANOVA_API_KEY is configured; otherwise (or on any upstream failure)
   * it returns the deterministic local fallback so the UI flow never breaks.
   */
  async suggestTitle(input: SuggestTitleInput): Promise<{ title: string; source: 'ai' | 'fallback' }> {
    const pros = input.pros?.trim() || undefined;
    const cons = input.cons?.trim() || undefined;

    if (!pros && !cons) {
      throw new AppError('Add some pros or cons first so there is something to summarize.', 400);
    }

    const fallback = () => ({ title: generateFallbackTitle(pros, cons), source: 'fallback' as const });

    if (!env.SAMBANOVA_API_KEY) return fallback();
    // Automatic drafts skip the AI while it is known to be down; an explicit
    // "Write it for me" click always gets another chance (the user may have
    // just topped up the account).
    if (input.trigger === 'auto' && Date.now() < this.aiDownUntil) return fallback();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch('https://api.sambanova.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.SAMBANOVA_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(pros, cons, input.jobTitle?.trim() || undefined) },
          ],
          max_tokens: 60,
          // Manual re-rolls want variety; quiet auto drafts stay conservative.
          temperature: input.trigger === 'manual' ? 0.9 : 0.4,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        logger.warn({ status: response.status, body: body.slice(0, 300) }, 'SambaNova title generation failed');
        this.noteFailure();
        return fallback();
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = data.choices?.[0]?.message?.content?.trim();
      if (!raw) {
        logger.warn('SambaNova title generation returned an empty result');
        this.noteFailure();
        return fallback();
      }

      this.consecutiveFailures = 0;
      this.aiDownUntil = 0;

      // Strip wrapping quotes the model sometimes adds, then keep it short —
      // models sometimes ignore the length rule in the prompt.
      const title = clampWords(
        raw.replace(/^["'\u201c\u201d]+|["'\u201c\u201d]+$/g, '').trim(),
        MAX_SUGGESTED_LENGTH,
      );

      if (title.length < 10) {
        // Below the minimum review-title length — a fallback is more useful.
        return fallback();
      }

      return { title, source: 'ai' };
    } catch (error) {
      logger.warn({ err: error }, 'SambaNova title generation error — using fallback');
      this.noteFailure();
      return fallback();
    }
  }

  private noteFailure() {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= AI_FAILURE_THRESHOLD) {
      this.aiDownUntil = Date.now() + AI_COOLDOWN_MS;
      logger.warn({ cooldownMs: AI_COOLDOWN_MS }, 'SambaNova failing — using local title fallback for a while');
    }
  }
}

export const reviewTitleService = new ReviewTitleService();
