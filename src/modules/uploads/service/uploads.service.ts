import { put, del, head } from '@vercel/blob';
import { randomBytes } from 'node:crypto';
import { AppError } from '../../../shared/errors/AppError.js';

export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

// Only raster web formats. SVG is deliberately excluded — it can embed
// scripts, and serving user-supplied SVG from a CDN is a stored-XSS vector.
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function assertBlobTokenConfigured(): void {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new AppError(
      'Image storage is not configured (missing BLOB_READ_WRITE_TOKEN). Set it in the environment and try again.',
      503,
    );
  }
}

class UploadsService {
  /**
   * Store a company logo in Vercel Blob and return its permanent public CDN
   * URL. The URL is meant to be persisted in `companies.logoUrl` — either by
   * the caller passing it into the create/update payload, or directly by the
   * admin logo endpoint on the companies module.
   */
  async uploadLogo(file: Express.Multer.File): Promise<{ url: string; pathname: string; size: number }> {
    const extension = ALLOWED_MIME_TYPES[file.mimetype];
    if (!extension) {
      throw new AppError(
        `Unsupported image type "${file.mimetype}". Allowed types: PNG, JPEG, WebP.`,
        400,
      );
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      throw new AppError('Image is too large. Maximum size is 2 MB.', 413);
    }

    assertBlobTokenConfigured();

    const pathname = `logos/${Date.now()}-${randomBytes(8).toString('hex')}.${extension}`;

    const blob = await put(pathname, file.buffer, {
      access: 'private',
      contentType: file.mimetype,
      addRandomSuffix: false,
    });

    return { url: blob.url, pathname: blob.pathname, size: file.size };
  }

  /**
   * Best-effort deletion of a previously stored logo. Never throws — an old
   * blob that fails to delete must not block updating the company record.
   */
  async deleteLogoQuietly(url: string | null | undefined): Promise<void> {
    if (!url) return;
    // Accept both raw pathnames and full blob URLs.
    const pathname = url.includes('blob.vercel-storage.com')
      ? url.split('blob.vercel-storage.com/')[1]
      : url;
    if (!pathname) return;
    try {
      await del(pathname);
    } catch {
      // Ignore — orphaned blobs are harmless and can be cleaned up later.
    }
  }

  /**
   * Resolve a stored pathname (or legacy full URL) into a fresh signed URL
   * that the browser can fetch.  Returns null for empty/invalid inputs.
   */
  async resolveLogoUrl(logoUrl: string | null): Promise<string | null> {
    if (!logoUrl) return null;

    // Legacy full URLs stored before the private-store migration — return as-is.
    if (logoUrl.startsWith('http')) return logoUrl;

    // It's a pathname — fetch fresh metadata from the private store.
    try {
      const blob = await head(logoUrl);
      return blob.url;
    } catch {
      return null;
    }
  }

  /**
   * Batch-resolve multiple logo pathnames.  Returns a Map of pathname → signed URL.
   */
  async resolveLogoUrls(pathnames: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(pathnames.filter((p): p is string => !!p && !p.startsWith('http')))];
    const result = new Map<string, string>();
    await Promise.all(
      unique.map(async (pathname) => {
        const url = await this.resolveLogoUrl(pathname);
        if (url) result.set(pathname, url);
      }),
    );
    return result;
  }
}

export const uploadsService = new UploadsService();
