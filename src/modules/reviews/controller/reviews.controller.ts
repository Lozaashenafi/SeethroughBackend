import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { reviewsService } from '../service/reviews.service.js';
import { toReviewResponse } from '../types/reviews.types.js';

class ReviewsController {
  async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const review = await reviewsService.create({
      ...req.body,
      anonymousId: req.anonymous!.id,
    });
    sendSuccess(res, toReviewResponse(review), 'Review created', 201);
  }

  async getByPublicId(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const review = await reviewsService.getByPublicId(publicId);
    sendSuccess(res, toReviewResponse(review), 'Review retrieved');
  }

  async listByCompany(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { companySlug, sortBy } = req.query as Record<string, string | undefined>;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    if (companySlug) {
      const result = await reviewsService.listByCompanySlug(companySlug, page, limit);
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
      const result = await reviewsService.listAll(page, limit, sortBy);
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
    const { sortBy } = req.query as Record<string, string | undefined>;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const result = await reviewsService.listAll(page, limit, sortBy);
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
}

export const reviewsController = new ReviewsController();
