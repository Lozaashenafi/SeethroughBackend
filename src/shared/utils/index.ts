import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const HTML_TAG_RE = /<[^>]*>/g;

export function stripHtml(input: string): string {
  return input.replace(HTML_TAG_RE, '');
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
