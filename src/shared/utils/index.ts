import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const HTML_TAG_RE = /<[^>]*>/g;

export function stripHtml(input: string): string {
  return input.replace(HTML_TAG_RE, '');
}

export function sanitizedString(minLength?: number, maxLength?: number) {
  let schema: z.ZodString = z.string();
  if (minLength !== undefined) schema = schema.min(minLength);
  if (maxLength !== undefined) schema = schema.max(maxLength);
  return schema.transform((val) => stripHtml(val.trim()));
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
