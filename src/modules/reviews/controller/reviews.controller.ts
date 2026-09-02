import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { reviewsService } from '../service/reviews.service.js';
import { toReviewResponse } from '../types/reviews.types.js';

class ReviewsController {
  async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const review = await reviewsService.create({
      ...req.body,
      anonymousId: req.anonymous!.id,
      userId: req.user?.userId ?? null,
    });
    sendSuccess(res, toReviewResponse(review), 'Review created', 201);
  }

  async update(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const review = await reviewsService.update(publicId, req.anonymous!.id, req.body, req.user?.userId);
    sendSuccess(res, toReviewResponse(review), 'Review updated');
  }

  async getByPublicId(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const review = await reviewsService.getByPublicId(publicId);
    sendSuccess(res, toReviewResponse(review), 'Review retrieved');
  }

  async getTags(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const tagIds = await reviewsService.getTags(publicId, req.anonymous!.id);
    sendSuccess(res, { tagIds }, 'Review tags retrieved');
  }

  async adminGetByPublicId(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const review = await reviewsService.adminGetByPublicId(publicId);
    sendSuccess(res, toReviewResponse(review), 'Review retrieved');
  }

  async listByCompany(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { companySlug, sortBy } = req.query as Record<string, string | undefined>;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    if (companySlug) {
      const result = await reviewsService.listByCompanySlug(companySlug, page, limit, sortBy);
      sendSuccess(
        res,
        {
          reviews: result.data.map(toReviewResponse),
          pagination: {
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
          },
        },
        'Reviews retrieved',
      );
    } else {
      // Return all reviews when no company filter is provided
      const result = await reviewsService.listAll({ page, limit, sortBy });
      sendSuccess(
        res,
        {
          reviews: result.data.map(toReviewResponse),
          pagination: {
            total: result.total,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
          },
        },
        'All reviews retrieved',
      );
    }
  }

  async listAll(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { sortBy, status } = req.query as Record<string, string | undefined>;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const result = await reviewsService.listAll({ page, limit, sortBy, status });
    sendSuccess(
      res,
      {
        reviews: result.data.map(toReviewResponse),
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      },
      'All reviews retrieved',
    );
  }

  async delete(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    await reviewsService.deleteByPublicId(publicId);
    sendSuccess(res, null, 'Review deleted');
  }

  async moderate(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const { status } = req.body as { status: 'published' | 'rejected' };
    const review = await reviewsService.moderate(publicId, status);
    sendSuccess(res, toReviewResponse(review), `Review ${status === 'published' ? 'approved' : 'rejected'}`);
  }
}

export const reviewsController = new ReviewsController();
