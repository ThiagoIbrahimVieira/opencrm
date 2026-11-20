import { describe, it, expect, beforeAll, vi } from 'vitest';
import { buildApp } from './app.js';
import { AuthService } from './modules/auth/authService.js';
import { buildValidIMEI } from './utils/luhn.js';
import { encryptPii, decryptPii, blindIndex, maskCpf, maskPhone } from './utils/crypto.js';
import { prisma } from './db/prisma.js';

describe('OpenCRM AppSec, RBAC & API Integration Suite', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  describe('1. RBAC & DTO Anti-Vazamento (Natasha Romanoff)', () => {
    it('should return 401 when accessing protected endpoints without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/stores/current',
      });

      expect(res.statusCode).toBe(401);
      const json = res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 403 Forbidden when VENDEDOR accesses /api/team', async () => {
      const sellerToken = AuthService.signAccessToken({
        userId: 'u-seller-01',
        activeStoreId: '11111111-1111-1111-1111-111111111111',
        storeId: '11111111-1111-1111-1111-111111111111',
        role: 'VENDEDOR',
        email: 'vendedor@auracell.com.br',
        name: 'Vendedor Teste',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/team',
        headers: {
          authorization: `Bearer ${sellerToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toContain('restrito ao perfil de Administrador');
    });

    it('should return 403 Forbidden when VENDEDOR accesses /api/audit/logs', async () => {
      const sellerToken = AuthService.signAccessToken({
        userId: 'u-seller-01',
        activeStoreId: '11111111-1111-1111-1111-111111111111',
        storeId: '11111111-1111-1111-1111-111111111111',
        role: 'VENDEDOR',
        email: 'vendedor@auracell.com.br',
        name: 'Vendedor Teste',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/audit/logs',
        headers: {
          authorization: `Bearer ${sellerToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 403 Forbidden when VENDEDOR accesses /api/audit/stock-ledger', async () => {
      const sellerToken = AuthService.signAccessToken({
        userId: 'u-seller-01',
        activeStoreId: '11111111-1111-1111-1111-111111111111',
        storeId: '11111111-1111-1111-1111-111111111111',
        role: 'VENDEDOR',
        email: 'vendedor@auracell.com.br',
        name: 'Vendedor Teste',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/audit/stock-ledger',
        headers: {
          authorization: `Bearer ${sellerToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('2. Validação Luhn & Zod Dinâmico (Bruce Banner)', () => {
    it('should reject invalid IMEI in primary item creation with 400 Bad Request', async () => {
      const adminToken = AuthService.signAccessToken({
        userId: 'u-admin-01',
        activeStoreId: '11111111-1111-1111-1111-111111111111',
        storeId: '11111111-1111-1111-1111-111111111111',
        role: 'ADMIN',
        email: 'admin@auracell.com.br',
        name: 'Admin Teste',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/inventory/primary',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          title: 'iPhone 15 Pro 128GB',
          skuCode: 'IP15P-128',
          isSerialized: true,
          imei1: '123456789012345', // Inválido no algoritmo de Luhn
          costPrice: 4000,
          salePrice: 5500,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('Luhn');
    });

    it('should calculate valid check digit and accept valid Luhn IMEI prefix', () => {
      const valid = buildValidIMEI('35482910482104');
      expect(valid).toHaveLength(15);
      expect(valid.endsWith('0')).toBe(true);
    });
  });

  describe('3. LGPD & Whitelist de Garantia Pública (Jennifer Walters)', () => {
    it('should return 404 for nonexistent public warranty token without leaking DB internals', async () => {
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue(null);
      const fakeToken = '00000000-0000-0000-0000-000000000000';
      const res = await app.inject({
        method: 'GET',
        url: `/api/public/warranty/${fakeToken}`,
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toContain('Termo de garantia não localizado');
    });

    it('should encrypt PII with AES-256-GCM and never store plaintext CPF', () => {
      const cpf = '394.821.508-42';
      const encrypted = encryptPii(cpf);

      expect(encrypted).not.toBe(cpf);
      expect(encrypted.includes(cpf)).toBe(false);

      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3); // iv : authTag : ciphertext

      const decrypted = decryptPii(encrypted);
      expect(decrypted).toBe(cpf);
    });

    it('should compute deterministic blind index for exact search without decryption', () => {
      const phone1 = '(11) 98412-3390';
      const phone2 = '11984123390';
      expect(blindIndex(phone1)).toBe(blindIndex(phone2));
    });

    it('should mask CPF and phone cleanly', () => {
      expect(maskCpf('39482150842')).toBe('•••.821.508-••');
      expect(maskPhone('11984123390')).toBe('(11) 9••••-3390');
    });
  });

  describe('4. Health Check da API', () => {
    it('should respond with healthy status on /api/health', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.status).toBe('ok');
      expect(json.service).toBe('opencrm-api');
    });
  });

  describe('5. Multi-Store Workspace & Google OAuth (Onda 5)', () => {
    it('should reject /api/auth/google when idToken is missing or too short', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: { idToken: 'short' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject /api/auth/google with 401 or 503 when token cannot be verified', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: { idToken: 'invalid-fake-google-id-token-xyz-1234567890' },
      });
      expect([401, 503]).toContain(res.statusCode);
    });

    it('should return 403 Forbidden when user attempts to switch to an unauthorized store', async () => {
      vi.spyOn(prisma.storeMembership, 'findUnique').mockResolvedValue(null);

      const userToken = AuthService.signAccessToken({
        userId: 'u-user-isolated-01',
        activeStoreId: '11111111-1111-1111-1111-111111111111',
        role: 'VENDEDOR',
        email: 'user@isolado.com.br',
        name: 'Usuário Isolado',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/stores/switch',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          storeId: '99999999-9999-9999-9999-999999999999',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toContain('autorização');
    });

    it('should return list of stores on GET /api/stores/mine for authenticated user', async () => {
      vi.spyOn(prisma.storeMembership, 'findMany').mockResolvedValue([
        {
          id: 'm-01',
          userId: 'u-admin-01',
          storeId: '11111111-1111-1111-1111-111111111111',
          role: 'ADMIN',
          isActive: true,
          createdAt: new Date(),
          store: {
            id: '11111111-1111-1111-1111-111111111111',
            slug: 'auracell-jardins',
            name: 'AuraCell — Loja Jardins',
            segment: 'Celulares & Assistência',
            templateConfig: {},
            catalogOptions: {},
            createdAt: new Date(),
          },
        } as any,
      ]);

      const adminToken = AuthService.signAccessToken({
        userId: 'u-admin-01',
        activeStoreId: '11111111-1111-1111-1111-111111111111',
        role: 'ADMIN',
        email: 'admin@auracell.com.br',
        name: 'Admin Teste',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/stores/mine',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json[0].store.name).toBe('AuraCell — Loja Jardins');
    });
  });
});
