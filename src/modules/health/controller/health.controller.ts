import { Request, Response } from 'express';
import { db } from '../../../database/db.js';
import { env } from '../../../config/env.js';
import { sendSuccess } from '../../../shared/responses/index.js';
import { sql } from 'drizzle-orm';
import packageJson from '../../../../package.json' with { type: 'json' };

class HealthController {
  async check(_req: Request, res: Response): Promise<void> {
    let dbConnected = false;
    try {
      await db.execute(sql`SELECT 1`);
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    sendSuccess(res, {
      status: dbConnected ? 'healthy' : 'degraded',
      environment: env.NODE_ENV,
      database: {
        connected: dbConnected,
      },
      uptime: process.uptime(),
      version: packageJson.version,
      timestamp: new Date().toISOString(),
    });
  }
}

export const healthController = new HealthController();
