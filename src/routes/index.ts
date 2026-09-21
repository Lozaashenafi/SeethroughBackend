import { Router } from 'express';
import { healthRoutes } from '../modules/health/routes/health.routes.js';
import { companiesRoutes } from '../modules/companies/routes/companies.routes.js';
import { reviewsRoutes } from '../modules/reviews/routes/reviews.routes.js';
import { commentsRoutes } from '../modules/comments/routes/comments.routes.js';
import { votesRoutes } from '../modules/votes/routes/votes.routes.js';
import { reportsRoutes } from '../modules/reports/routes/reports.routes.js';
import { industriesRoutes } from '../modules/industries/routes/industries.routes.js';
import { tagsRoutes } from '../modules/tags/routes/tags.routes.js';
import { userAuthRoutes } from '../modules/user-auth/routes/userAuth.routes.js';
import { adminUsersRoutes } from '../modules/user-auth/routes/adminUsers.routes.js';
import { uploadsRoutes } from '../modules/uploads/routes/uploads.routes.js';
import { notificationsRoutes } from '../modules/notifications/routes/notifications.routes.js';
import { API_PREFIX } from '../shared/constants/index.js';

const router = Router();

// Convenience root response — without it, GET / on the backend domain 404s
// (uptime monitors and casual browser checks hit / first and the 404 makes
// the API look down even when it is healthy).
router.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'See Through API',
    data: { health: `${API_PREFIX}/health`, version: '0.1.0' },
  });
});

// Alias /health to the same handler so both /health and /api/v1/health work.
router.use('/health', healthRoutes);
router.use(`${API_PREFIX}/health`, healthRoutes);
router.use(`${API_PREFIX}/companies`, companiesRoutes);
router.use(`${API_PREFIX}/reviews`, reviewsRoutes);
router.use(`${API_PREFIX}/comments`, commentsRoutes);
router.use(`${API_PREFIX}/votes`, votesRoutes);
router.use(`${API_PREFIX}/reports`, reportsRoutes);
router.use(`${API_PREFIX}/industries`, industriesRoutes);
router.use(`${API_PREFIX}/tags`, tagsRoutes);
router.use(`${API_PREFIX}/notifications`, notificationsRoutes);
// Admin user management is mounted before /user so it never falls through to
// the auth router.
router.use(`${API_PREFIX}/user/admin/users`, adminUsersRoutes);
router.use(`${API_PREFIX}/user`, userAuthRoutes);
router.use(`${API_PREFIX}/uploads`, uploadsRoutes);

export { router };
