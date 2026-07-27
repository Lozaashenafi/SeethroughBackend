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

const router = Router();

router.use('/api/v1/health', healthRoutes);
router.use('/api/v1/anonymous', anonymousRoutes);
router.use('/api/v1/companies', companiesRoutes);
router.use('/api/v1/reviews', reviewsRoutes);
router.use('/api/v1/comments', commentsRoutes);
router.use('/api/v1/votes', votesRoutes);
router.use('/api/v1/reports', reportsRoutes);
router.use('/api/v1/industries', industriesRoutes);
router.use('/api/v1/tags', tagsRoutes);
router.use('/api/v1/auth', authRoutes);

export { router };
