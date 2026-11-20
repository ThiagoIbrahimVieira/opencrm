import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type UserRole = 'ADMIN' | 'VENDEDOR';

export interface AuthTokenPayload {
  userId: string;
  activeStoreId: string | null;
  storeId: string;
  role: UserRole | null;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthTokenPayload;
  }
}

export async function authenticateToken(req: FastifyRequest, reply: FastifyReply) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies?.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Token de autenticação não fornecido ou sessão expirada.',
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthTokenPayload;
    if (!decoded.storeId && decoded.activeStoreId) {
      decoded.storeId = decoded.activeStoreId;
    } else if (!decoded.storeId) {
      decoded.storeId = '';
    }
    req.user = decoded;
  } catch {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Token de acesso inválido ou expirado.',
    });
  }
}

export function requireActiveStore(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user?.activeStoreId) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Nenhuma loja ativa selecionada. Conclua o onboarding ou selecione uma loja.',
      needsOnboarding: true,
    });
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Autenticação necessária.',
      });
    }

    if (!req.user.activeStoreId || !req.user.role) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Acesso restrito: selecione uma loja ativa.',
        needsOnboarding: true,
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Acesso restrito ao perfil de Administrador.',
      });
    }
  };
}
