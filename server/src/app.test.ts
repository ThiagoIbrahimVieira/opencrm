import { describe, it, expect, beforeAll, vi } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { buildApp } from './app.js';
import { AuthService } from './modules/auth/authService.js';
import { buildValidIMEI } from './utils/luhn.js';
import { hashPassword, encryptPii, decryptPii, blindIndex, maskCpf, maskPhone } from './utils/crypto.js';
import { prisma } from './db/prisma.js';
import { env } from './config/env.js';

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

  describe('7. Subagente 1 — Integridade de Papéis, AccountType e Persistência de Lojas', () => {
    it('should register store on POST /api/auth/register-store with accountType = ADMIN and store created', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          store: {
            findUnique: vi.fn().mockResolvedValue(null),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 's-ecc-01',
              name: 'Loja ECC Tech',
              slug: 'loja-ecc-tech',
              segment: 'celulares-assistencia',
              templateConfig: { features: { hasTradeIn: true } },
            }),
          },
          user: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'u-store-admin-01',
              name: 'Dono da Loja',
              email: 'dono@ecctech.com.br',
              accountType: 'ADMIN',
              avatarUrl: null,
            }),
            update: vi.fn(),
          },
          storeMembership: {
            findFirst: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({
              id: 'm-ecc-admin',
              userId: 'u-store-admin-01',
              storeId: 's-ecc-01',
              role: 'ADMIN',
              isActive: true,
            }),
          },
          refreshToken: {
            create: vi.fn().mockResolvedValue({ id: 'rt-store-admin' }),
          },
        });
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register-store',
        payload: {
          storeName: 'Loja ECC Tech',
          segment: 'celulares-assistencia',
          templateConfig: { features: { hasTradeIn: true } },
          adminName: 'Dono da Loja',
          adminEmail: 'dono@ecctech.com.br',
          adminPassword: 'Password123!',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.user.accountType).toBe('ADMIN');
      expect(json.user.role).toBe('ADMIN');
      expect(json.store.name).toBe('Loja ECC Tech');
      expect(json.accessToken).toBeDefined();
    });

    it('should register seller on POST /api/auth/register-seller with accountType = VENDEDOR and role = null when no store membership', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          user: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'u-seller-no-store-01',
              name: 'Vendedor Sem Loja',
              email: 'vendedor.solto@ecctech.com.br',
              accountType: 'VENDEDOR',
              avatarUrl: null,
              memberships: [],
            }),
          },
          storeMembership: {
            updateMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          refreshToken: {
            create: vi.fn().mockResolvedValue({ id: 'rt-seller-solto' }),
          },
        });
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register-seller',
        payload: {
          name: 'Vendedor Sem Loja',
          email: 'vendedor.solto@ecctech.com.br',
          password: 'Password123!',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.user.accountType).toBe('VENDEDOR');
      expect(json.user.role).toBeNull();
      expect(json.needsStoreAccess).toBe(true);
      expect(json.memberships).toEqual([]);
      expect(json.accessToken).toBeDefined();
    });

    it('should update accountType on authenticated PATCH /api/auth/account-type', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'u-ecc-patch-01',
        name: 'User Patch',
        email: 'patch@ecctech.com.br',
        accountType: 'UNSET',
      } as any);

      vi.spyOn(prisma.user, 'update').mockResolvedValue({
        id: 'u-ecc-patch-01',
        name: 'User Patch',
        email: 'patch@ecctech.com.br',
        accountType: 'ADMIN',
        avatarUrl: null,
        memberships: [],
      } as any);

      vi.spyOn(prisma.refreshToken, 'create').mockResolvedValue({ id: 'rt-patch-01' } as any);

      const userToken = AuthService.signAccessToken({
        userId: 'u-ecc-patch-01',
        activeStoreId: null,
        storeId: '',
        role: null,
        accountType: 'UNSET',
        email: 'patch@ecctech.com.br',
        name: 'User Patch',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/account-type',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          accountType: 'ADMIN',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.user.accountType).toBe('ADMIN');
      expect(json.accessToken).toBeDefined();
    });

    it('should reject invalid accountType on PATCH /api/auth/account-type with 400 Bad Request', async () => {
      const userToken = AuthService.signAccessToken({
        userId: 'u-ecc-patch-01',
        activeStoreId: null,
        storeId: '',
        role: null,
        accountType: 'UNSET',
        email: 'patch@ecctech.com.br',
        name: 'User Patch',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/account-type',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          accountType: 'INVALID_ROLE',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should handle Google OAuth first access with accountType = UNSET and needsRoleChoice = true', async () => {
      const originalClientId = env.GOOGLE_CLIENT_ID;
      (env as any).GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

      vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({
          email: 'google.primeiro@exemplo.com',
          email_verified: true,
          sub: 'gsub-ecc-111',
          name: 'Google Primeiro Acesso',
          picture: 'https://avatar.google.com/pic.jpg',
        }),
      } as any);

      vi.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.user, 'create').mockResolvedValue({
        id: 'u-google-first-01',
        name: 'Google Primeiro Acesso',
        email: 'google.primeiro@exemplo.com',
        googleSub: 'gsub-ecc-111',
        avatarUrl: 'https://avatar.google.com/pic.jpg',
        accountType: 'UNSET',
        passwordHash: null,
        memberships: [],
      } as any);

      vi.spyOn(prisma.storeMembership, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.refreshToken, 'create').mockResolvedValue({ id: 'rt-g-1' } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: {
          idToken: 'valid-mocked-google-id-token-xyz-1234567890',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.needsRoleChoice).toBe(true);
      expect(json.needsOnboarding).toBe(true);
      expect(json.user.accountType).toBe('UNSET');
      expect(json.user.role).toBeNull();

      (env as any).GOOGLE_CLIENT_ID = originalClientId;
    });

    it('should automatically link Google user as VENDEDOR when pending team membership exists', async () => {
      const originalClientId = env.GOOGLE_CLIENT_ID;
      (env as any).GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

      vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
        getPayload: () => ({
          email: 'convidado.google@auracell.com.br',
          email_verified: true,
          sub: 'gsub-ecc-222',
          name: 'Convidado Google',
          picture: null,
        }),
      } as any);

      vi.spyOn(prisma.user, 'findFirst').mockResolvedValue({
        id: 'u-google-invited-01',
        name: 'Convidado Google',
        email: 'convidado.google@auracell.com.br',
        googleSub: null,
        accountType: 'UNSET',
        avatarUrl: null,
        passwordHash: null,
        memberships: [
          {
            id: 'm-inv-01',
            storeId: '11111111-1111-1111-1111-111111111111',
            role: 'VENDEDOR',
            isActive: false,
          },
        ],
      } as any);

      vi.spyOn(prisma.storeMembership, 'updateMany').mockResolvedValue({ count: 1 });
      vi.spyOn(prisma.user, 'update').mockResolvedValue({
        id: 'u-google-invited-01',
        name: 'Convidado Google',
        email: 'convidado.google@auracell.com.br',
        googleSub: 'gsub-ecc-222',
        accountType: 'VENDEDOR',
        avatarUrl: null,
        passwordHash: null,
        memberships: [],
      } as any);

      vi.spyOn(prisma.storeMembership, 'findMany').mockResolvedValue([
        {
          id: 'm-inv-01',
          userId: 'u-google-invited-01',
          storeId: '11111111-1111-1111-1111-111111111111',
          role: 'VENDEDOR',
          isActive: true,
          store: {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'AuraCell Jardins',
            slug: 'auracell-jardins',
            segment: 'celulares',
          },
        } as any,
      ]);

      vi.spyOn(prisma.refreshToken, 'create').mockResolvedValue({ id: 'rt-g-2' } as any);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: {
          idToken: 'valid-mocked-google-id-token-xyz-1234567890',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.needsRoleChoice).toBe(false);
      expect(json.needsOnboarding).toBe(false);
      expect(json.user.accountType).toBe('VENDEDOR');
      expect(json.user.role).toBe('VENDEDOR');
      expect(json.store.id).toBe('11111111-1111-1111-1111-111111111111');

      (env as any).GOOGLE_CLIENT_ID = originalClientId;
    });

    it('should return role = null and accountType on GET /api/auth/me when user has no store memberships', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'u-unset-me-01',
        name: 'User Sem Loja',
        email: 'semloja@auracell.com.br',
        accountType: 'UNSET',
        avatarUrl: null,
      } as any);

      vi.spyOn(prisma.storeMembership, 'findMany').mockResolvedValue([]);

      const userToken = AuthService.signAccessToken({
        userId: 'u-unset-me-01',
        activeStoreId: null,
        storeId: '',
        role: null,
        accountType: 'UNSET',
        email: 'semloja@auracell.com.br',
        name: 'User Sem Loja',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.user.role).toBeNull();
      expect(json.user.accountType).toBe('UNSET');
      expect(json.needsOnboarding).toBe(true);
      expect(json.needsRoleChoice).toBe(true);
      expect(json.stores).toEqual([]);
      expect(json.memberships).toEqual([]);
    });

    it('should persist store with templateConfig (JSONB) and link ADMIN on POST /api/stores', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          store: {
            findUnique: vi.fn().mockResolvedValue(null),
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 's-wizard-persisted-01',
              name: 'Loja Wizard Persistida',
              slug: 'loja-wizard-persistida',
              segment: 'other',
              templateConfig: {
                id: 'tpl-custom-01',
                storeName: 'Loja Wizard Persistida',
                segment: 'other',
                features: { hasTradeIn: false, hasWarrantyQr: true },
              },
            }),
          },
          user: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'u-creator-01',
              name: 'Criador da Loja',
              email: 'criador@exemplo.com.br',
              accountType: 'UNSET',
            }),
            update: vi.fn().mockResolvedValue({
              id: 'u-creator-01',
              name: 'Criador da Loja',
              email: 'criador@exemplo.com.br',
              accountType: 'ADMIN',
            }),
          },
          storeMembership: {
            findFirst: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({
              id: 'm-wizard-admin',
              userId: 'u-creator-01',
              storeId: 's-wizard-persisted-01',
              role: 'ADMIN',
              isActive: true,
            }),
          },
          refreshToken: {
            create: vi.fn().mockResolvedValue({ id: 'rt-wizard-admin' }),
          },
        });
      });

      const creatorToken = AuthService.signAccessToken({
        userId: 'u-creator-01',
        activeStoreId: null,
        storeId: '',
        role: null,
        accountType: 'UNSET',
        email: 'criador@exemplo.com.br',
        name: 'Criador da Loja',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/stores',
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: {
          name: 'Loja Wizard Persistida',
          segment: 'other',
          templateConfig: {
            id: 'tpl-custom-01',
            storeName: 'Loja Wizard Persistida',
            segment: 'other',
            features: { hasTradeIn: false, hasWarrantyQr: true },
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.role).toBe('ADMIN');
      expect(json.store.name).toBe('Loja Wizard Persistida');
      expect(json.store.templateConfig.features.hasWarrantyQr).toBe(true);
      expect(json.accessToken).toBeDefined();
    });
  });
});
