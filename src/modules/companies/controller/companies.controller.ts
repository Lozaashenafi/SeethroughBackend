import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { companiesService } from '../service/companies.service.js';
import { companyScraperService } from '../services/company-scraper.service.js';
import { uploadsService } from '../../uploads/service/uploads.service.js';
import { toCompanyResponse } from '../types/companies.types.js';

class CompaniesController {
  async scrape(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { website } = req.body;
    const result = await companyScraperService.scrapeWebsite(website);
    sendSuccess(res, result, 'Website scraped successfully');
  }

  async checkDuplicates(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { website, name } = req.query as Record<string, string | undefined>;

    const result = await companiesService.checkDuplicates({ website, name });

    sendSuccess(
      res,
      {
        websiteMatches: result.websiteMatches.map(toCompanyResponse),
        nameMatches: result.nameMatches.map((m) => ({
          company: toCompanyResponse(m.company),
          similarity: m.similarity,
        })),
      },
      'Duplicate check completed',
    );
  }

  async list(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { search, industry, country, city, page, limit } = req.query as Record<string, string | undefined>;

    const result = await companiesService.list({
      search,
      industry,
      country,
      city,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });

    sendSuccess(
      res,
      {
        companies: result.data.map(toCompanyResponse),
        pagination: {
          total: result.total,
          page: Number(page) || 1,
          limit: Number(limit) || 20,
          totalPages: Math.ceil(result.total / (Number(limit) || 20)),
        },
      },
      'Companies retrieved',
    );
  }

  async getBySlug(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { slug } = req.params;
    const company = await companiesService.getBySlug(slug);
    sendSuccess(res, toCompanyResponse(company), 'Company retrieved');
  }

  async create(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const company = await companiesService.create(req.body);
    sendSuccess(res, toCompanyResponse(company), 'Company created', 201);
  }

  async update(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { slug } = req.params;
    const company = await companiesService.update(slug, req.body);
    sendSuccess(res, toCompanyResponse(company), 'Company updated');
  }

  async delete(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { slug } = req.params;
    await companiesService.delete(slug);
    sendSuccess(res, null, 'Company deleted');
  }

  /**
   * Admin shortcut: upload a new logo file and persist its URL on the company
   * in a single request (the previous blob is cleaned up automatically).
   */
  async uploadLogo(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { slug } = req.params;
    if (!req.file) {
      throw new AppError('No file provided. Send multipart/form-data with a "file" field.', 400);
    }

    const { url } = await uploadsService.uploadLogo(req.file);
    const company = await companiesService.update(slug, { logoUrl: url });

    sendSuccess(res, toCompanyResponse(company), 'Company logo updated');
  }
}

export const companiesController = new CompaniesController();
