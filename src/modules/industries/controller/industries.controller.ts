import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../shared/responses/index.js';
import { industriesService } from '../service/industries.service.js';
import { toIndustryResponse } from '../types/industries.types.js';

class IndustriesController {
  async list(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    const industries = await industriesService.listAll();
    sendSuccess(res, industries.map(toIndustryResponse), 'Industries retrieved');
  }
}

export const industriesController = new IndustriesController();
