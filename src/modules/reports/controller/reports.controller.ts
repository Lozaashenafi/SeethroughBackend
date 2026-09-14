import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { reportsService } from '../service/reports.service.js';
import { toReportResponse, type ReportStatus } from '../types/reports.types.js';

class ReportsController {
  async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const report = await reportsService.create({
      ...req.body,
      userId: req.user!.userId,
    });
    sendSuccess(res, toReportResponse(report), 'Report submitted', 201);
  }

  async list(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { status } = req.query as { status?: ReportStatus | 'all' };
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const result = await reportsService.list({
      status: status === 'all' ? undefined : status,
      page,
      limit,
    });

    sendSuccess(
      res,
      {
        reports: result.data.map(toReportResponse),
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      },
      'Reports retrieved',
    );
  }

  async updateStatus(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { publicId } = req.params;
    const { status } = req.body;

    const report = await reportsService.updateStatus(publicId, status);
    sendSuccess(res, toReportResponse(report), `Report ${status}`);
  }
}

export const reportsController = new ReportsController();
