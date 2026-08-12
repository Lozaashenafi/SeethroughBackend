import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Script/style blocks are removed WITH their content (a tag-only regex would
// leave the script body behind). Case-insensitive and tolerant of attributes.
// The closing tag is matched via a literal alternation instead of a \1
// backreference because JS backreferences are case-sensitive even with the
// 'i' flag — a mixed-case `</SCRIPT>` closer must still close the block.
const SCRIPT_STYLE_BLOCK_RE = /<(script|style)[^>]*>[\s\S]*?<\/(?:script|style)\s*>/gi;
// HTML comments may hide markup from the tag regex.
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const HTML_TAG_RE = /<[^>]*>/g;
const STRAY_ANGLE_BRACKET_RE = /[<>]/g;
const COLLAPSE_WS_RE = /\s+/g;

export function stripHtml(input: string): string {
  let result = input
    .replace(SCRIPT_STYLE_BLOCK_RE, ' ')
    .replace(HTML_COMMENT_RE, ' ');

  // A single pass misses obfuscated/overlapping markup such as
  // "<scr<script>ipt>alert(1)</scr</script>ipt>". Loop until stable — every
  // pass only removes characters, so this always terminates.
  let cleaned: string;
  do {
    cleaned = result;
    result = cleaned.replace(HTML_TAG_RE, ' ');
  } while (result !== cleaned);

  // Deliberately drop any angle brackets left over in plain text (e.g. a bare
  // "<" or ">"). Safety takes precedence over preserving comparison operators
  // like "salary > market" — brackets are never needed for valid review prose.
  result = result.replace(STRAY_ANGLE_BRACKET_RE, ' ');

  return result.replace(COLLAPSE_WS_RE, ' ').trim();
}

export function sanitizedString(minLength?: number, maxLength?: number) {
  // Strip HTML and trim BEFORE validating length. Validating the raw input
  // first allowed tag/whitespace-padded strings (e.g. "<b></b>") to pass the
  // min-length check and then collapse to an empty value.
  const sanitized = z.string().transform((val) => stripHtml(val.trim()));
  let lengthValidated: z.ZodString = z.string();
  if (minLength !== undefined) lengthValidated = lengthValidated.min(minLength);
  if (maxLength !== undefined) lengthValidated = lengthValidated.max(maxLength);
  return sanitized.pipe(lengthValidated);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export { generateNickname } from './nickname.js';
export {
  contentFingerprint,
  textSimilarity,
  NEAR_DUPLICATE_THRESHOLD,
} from './duplicateDetection.js';
