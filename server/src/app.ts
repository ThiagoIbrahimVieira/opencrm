import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/authRoutes.js';
import { storeRoutes } from './modules/stores/storeRoutes.js';
import { teamRoutes } from './modules/team/teamRoutes.js';
import { inventoryRoutes } from './modules/inventory/inventoryRoutes.js';
import { customerRoutes } from './modules/customers/customerRoutes.js';
import { orderRoutes } from './modules/orders/orderRoutes.js';
import { auditRoutes } from './modules/audit/auditRoutes.js';
import { dashboardRoutes } from './modules/dashboard/dashboardRoutes.js';
import { publicRoutes } from './modules/public/publicRoutes.js';

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development',
    trustProxy: true,
  });

  // AppSec HTTP Headers
  app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  const allowedOrigins = [
    ...env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);

  // CORS restrito com suporte a cookies credentials
  app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });

  // Cookies seguros para refresh token rotativo
  app.register(cookie, {
    secret: env.JWT_ACCESS_SECRET,
  });

  // Rate Limiting anti-bruteforce
  app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  // Global Error Handler (Blindado contra vazamento de stacktrace ou dados brutos do DB)
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Falha na validaÃ§Ã£o dos campos da requisiÃ§Ã£o.',
        details: error.format(),
      });
    }

    const statusCode = error.statusCode || 500;
    const isClientError = statusCode >= 400 && statusCode < 500;

    return reply.status(statusCode).send({
      statusCode,
      error: isClientError ? error.name || 'Client Error' : 'Internal Server Error',
      message: isClientError ? error.message : 'Ocorreu um erro interno no servidor.',
    });
  });

  // Rotas da API sob o prefixo /api
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(storeRoutes, { prefix: '/api/stores' });
  app.register(teamRoutes, { prefix: '/api/team' });
  app.register(inventoryRoutes, { prefix: '/api/inventory' });
  app.register(customerRoutes, { prefix: '/api/customers' });
  app.register(orderRoutes, { prefix: '/api/orders' });
  app.register(auditRoutes, { prefix: '/api/audit' });
  app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  app.register(publicRoutes, { prefix: '/api/public' });

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', service: 'opencrm-api' }));

  return app;
}
