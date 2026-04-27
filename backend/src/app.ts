/**
 * Purpose: Express application factory.
 * Usage:   Wires global middleware (helmet, cors, compression, morgan, rate limit, auth-route rate limit) and mounts the /api/v1 router. Imported by index.ts.
 * Goal:    Keep transport / cross-cutting concerns separate from the bootstrap so the same `app` object can be re-used by supertest in unit tests.
 * ToDo:    Tighten Helmet HSTS (max-age >= 63072000, includeSubDomains, preload).
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import routes from './routes/index';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));
app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(cookieParser());

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
}));

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/v1/auth/login', authRateLimit);
app.use('/api/v1/auth/register', authRateLimit);
app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
