import { Router } from 'express';
import { healthRoutes } from '../modules/health/routes/health.routes.js';
import { anonymousRoutes } from '../modules/anonymous/routes/anonymous.routes.js';
import { companiesRoutes } from '../modules/companies/routes/companies.routes.js';
import { reviewsRoutes } from '../modules/reviews/routes/reviews.routes.js';
import { commentsRoutes } from '../modules/comments/routes/comments.routes.js';
import { votesRoutes } from '../modules/votes/routes/votes.routes.js';
import { reportsRoutes } from '../modules/reports/routes/reports.routes.js';
import { industriesRoutes } from '../modules/industries/routes/industries.routes.js';
import { tagsRoutes } from '../modules/tags/routes/tags.routes.js';
import { authRoutes } from '../modules/auth/routes/auth.routes.js';
import { uploadsRoutes } from '../modules/uploads/routes/uploads.routes.js';
import { API_PREFIX } from '../shared/constants/index.js';

const router = Router();

router.use(`${API_PREFIX}/health`, healthRoutes);
router.use(`${API_PREFIX}/anonymous`, anonymousRoutes);
router.use(`${API_PREFIX}/companies`, companiesRoutes);
router.use(`${API_PREFIX}/reviews`, reviewsRoutes);
router.use(`${API_PREFIX}/comments`, commentsRoutes);
router.use(`${API_PREFIX}/votes`, votesRoutes);
router.use(`${API_PREFIX}/reports`, reportsRoutes);
router.use(`${API_PREFIX}/industries`, industriesRoutes);
router.use(`${API_PREFIX}/tags`, tagsRoutes);
router.use(`${API_PREFIX}/auth`, authRoutes);
router.use(`${API_PREFIX}/uploads`, uploadsRoutes);

export { router };
