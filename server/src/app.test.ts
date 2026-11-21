import { describe, it, expect, beforeAll, vi } from 'vitest';
import { buildApp } from './app.js';
import { AuthService } from './modules/auth/authService.js';
import { buildValidIMEI } from './utils/luhn.js';
import { hashPassword, encryptPii, decryptPii, blindIndex, maskCpf, maskPhone } from './utils/crypto.js';
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

  describe('6. Fase 2 & Fase 4 — Vendedor, Sessões, Convites e Busca LGPD (Bruce Banner)', () => {
    it('should return 404 with friendly message when email is not registered on POST /api/auth/login', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'naoexiste@auracell.com.br',
          password: 'Password123!',
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toBe('Essa conta não existe.');
    });

    it('should return 401 with "Senha incorreta." when password does not match on POST /api/auth/login', async () => {
      const realHash = await hashPassword('CorrectPassword123!');
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'u-user-01',
        email: 'thiago@auracell.com.br',
        passwordHash: realHash,
        googleSub: null,
        name: 'Thiago Vasconcelos',
        avatarUrl: null,
        createdAt: new Date(),
        memberships: [{ storeId: '11111111-1111-1111-1111-111111111111', role: 'ADMIN', isActive: true }],
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'thiago@auracell.com.br',
          password: 'WrongPassword999!',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe('Senha incorreta.');
    });

    it('should return 401 informing Google login when user has googleSub and no password', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'u-google-01',
        email: 'googleuser@auracell.com.br',
        passwordHash: null,
        googleSub: 'google-sub-999',
        name: 'Google User',
        avatarUrl: null,
        createdAt: new Date(),
        memberships: [],
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'googleuser@auracell.com.br',
          password: 'Password123!',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe('Esta conta usa acesso pelo Google.');
    });

    it('should return 401 informing store invite when user has memberships and no password', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'u-invited-01',
        email: 'convidado@auracell.com.br',
        passwordHash: null,
        googleSub: null,
        name: 'Convidado Teste',
        avatarUrl: null,
        createdAt: new Date(),
        memberships: [{ storeId: '11111111-1111-1111-1111-111111111111', role: 'VENDEDOR', isActive: true }],
      } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'convidado@auracell.com.br',
          password: 'Password123!',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toContain('Você já tem um convite de loja!');
    });

    it('should register a new seller on POST /api/auth/register-seller', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          user: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'u-new-seller',
              name: 'Novo Vendedor',
              email: 'novovendedor@auracell.com.br',
              passwordHash: '$argon2id$...',
              avatarUrl: null,
              memberships: [],
            }),
            update: vi.fn(),
          },
          storeMembership: {
            updateMany: vi.fn(),
          },
          refreshToken: {
            create: vi.fn().mockResolvedValue({ id: 'rt-1' }),
          },
        });
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register-seller',
        payload: {
          name: 'Novo Vendedor',
          email: 'novovendedor@auracell.com.br',
          password: 'Password123!',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.user.email).toBe('novovendedor@auracell.com.br');
      expect(json.needsStoreAccess).toBe(true);
      expect(json.accessToken).toBeDefined();
    });

    it('should revoke other sessions on POST /api/auth/revoke-sessions', async () => {
      vi.spyOn(prisma.refreshToken, 'updateMany').mockResolvedValue({ count: 2 });

      const token = AuthService.signAccessToken({
        userId: 'u-user-01',
        activeStoreId: '11111111-1111-1111-1111-111111111111',
        storeId: '11111111-1111-1111-1111-111111111111',
        role: 'VENDEDOR',
        email: 'user@auracell.com.br',
        name: 'User Teste',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/revoke-sessions',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          refreshToken: 'dummy-refresh-token',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().ok).toBe(true);
      expect(res.json().revokedCount).toBe(2);
    });

    it('should reject invalidated refresh token on POST /api/auth/refresh with 401 and trigger family reuse revocation', async () => {
      const familyId = crypto.randomUUID();
      const revokedRefreshToken = AuthService.signRefreshToken(
        {
          userId: 'u-user-01',
          activeStoreId: '11111111-1111-1111-1111-111111111111',
          storeId: '11111111-1111-1111-1111-111111111111',
          role: 'VENDEDOR',
          email: 'user@auracell.com.br',
          name: 'User Teste',
        },
        familyId
      );

      vi.spyOn(prisma.refreshToken, 'findFirst').mockResolvedValue({
        id: 'rt-revoked-01',
        userId: 'u-user-01',
        storeId: '11111111-1111-1111-1111-111111111111',
        familyId,
        tokenHash: 'some-hash',
        revokedAt: new Date(), // Marcado como revogado
        expiresAt: new Date(Date.now() + 60000),
      } as any);

      const updateManySpy = vi.spyOn(prisma.refreshToken, 'updateMany').mockResolvedValue({ count: 1 });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken: revokedRefreshToken,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toContain('Tentativa de reuso de token detectada');
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { familyId },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        })
      );
    });

    it('should search customer by CPF blind index on GET /api/customers/search', async () => {
      const mockPhone = '11999998888';
      const mockCpf = '12345678909';
      const phoneEncrypted = encryptPii(mockPhone);
      const cpfEncrypted = encryptPii(mockCpf);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          $executeRawUnsafe: vi.fn(),
          $executeRaw: vi.fn(),
          customer: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'cust-search-01',
              storeId: '11111111-1111-1111-1111-111111111111',
              fullName: 'Cliente Busca VIP',
              phoneEncrypted,
              phoneLast4: '8888',
              phoneHmac: blindIndex(mockPhone),
              cpfEncrypted,
              cpfLast4: '8909',
              cpfHmac: blindIndex(mockCpf),
            }),
          },
        });
      });

      const token = AuthService.signAccessToken({
        userId: 'u-user-01',
        activeStoreId: '11111111-1111-1111-1111-111111111111',
        storeId: '11111111-1111-1111-1111-111111111111',
        role: 'VENDEDOR',
        email: 'user@auracell.com.br',
        name: 'User Teste',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/customers/search?cpf=123.456.789-09',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.id).toBe('cust-search-01');
      expect(json.name).toBe('Cliente Busca VIP');
      expect(json.phone).toBe(mockPhone);
      expect(json.cpfLast4).toBe('***.***.***-09');
    });

    it('should create team member with PENDING status and inviteLink when password is not provided', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          $executeRawUnsafe: vi.fn(),
          $executeRaw: vi.fn(),
          user: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'u-invited-pending',
              name: 'Vendedor Convidado',
              email: 'convite@auracell.com.br',
              passwordHash: null,
              avatarUrl: null,
            }),
          },
          storeMembership: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'm-pending-01',
              userId: 'u-invited-pending',
              storeId: '11111111-1111-1111-1111-111111111111',
              role: 'VENDEDOR',
              isActive: true,
              createdAt: new Date(),
              user: {
                id: 'u-invited-pending',
                name: 'Vendedor Convidado',
                email: 'convite@auracell.com.br',
                passwordHash: null,
                avatarUrl: null,
              },
            }),
          },
        });
      });

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
        url: '/api/team',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Vendedor Convidado',
          email: 'convite@auracell.com.br',
          role: 'VENDEDOR',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.status).toBe('PENDING');
      expect(json.inviteLink).toContain('https://opencrm-ashy.vercel.app/?modo=cadastro&perfil=vendedor&email=convite%40auracell.com.br');
    });
  });
});
