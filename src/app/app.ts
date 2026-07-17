import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { corsConfig } from '../config/cors.js';
import { logger } from '../config/logger.js';
import { router } from '../routes/index.js';
import { errorHandler } from '../middlewares/error.middleware.js';
import { notFoundHandler } from '../middlewares/notFound.middleware.js';

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors(corsConfig));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url, ip: req.ip }, 'Incoming request');
  next();
});

app.use(router);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
