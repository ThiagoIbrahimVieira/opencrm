import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../../db/prisma.js';
import { authenticateToken } from '../../middlewares/authMiddleware.js';
import { encryptPii, decryptPii, blindIndex, cleanDigits, maskCpf, maskPhone } from '../../utils/crypto.js';

export async function customerRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticateToken);

  function formatCustomerResponse(c: any) {
    return {
      id: c.id,
      name: c.fullName,
      email: c.email || '',
      phone: c.phoneLast4 ? `(••) •••••-${c.phoneLast4}` : '',
      cpf: c.cpfLast4 ? `•••.•••.•••-${c.cpfLast4}` : '',
      phoneLast4: c.phoneLast4,
      cpfLast4: c.cpfLast4,
      status: c.status,
      segment: c.segment || 'Varejo',
      tags: c.tags || [],
      city: c.city || '',
      preferredContact: c.preferredContact || 'WhatsApp',
      notes: c.notesJson || [],
      createdAt: c.createdAt,
    };
  }

  // GET /api/customers
  app.get('/', async (req, reply) => {
    const customers = await withTenant(req.user!.storeId, async (tx) => {
      return await tx.customer.findMany({
        where: { storeId: req.user!.storeId },
        orderBy: { createdAt: 'desc' },
      });
    });

    return reply.send(customers.map(formatCustomerResponse));
  });

  // GET /api/customers/search?cpf=...&phone=...
  app.get('/search', async (req, reply) => {
    const querySchema = z.object({
      cpf: z.string().optional(),
      phone: z.string().optional(),
    });

    const query = querySchema.parse(req.query);

    if (!query.cpf && !query.phone) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Informe ao menos CPF ou telefone para busca.',
      });
    }

    const conditions: any[] = [];
    let cleanCpf = '';

    if (query.cpf) {
      cleanCpf = cleanDigits(query.cpf);
      if (cleanCpf) {
        conditions.push({ cpfHmac: blindIndex(cleanCpf) });
      }
    }

    if (query.phone) {
      const cleanPhone = cleanDigits(query.phone);
      if (cleanPhone) {
        conditions.push({ phoneHmac: blindIndex(cleanPhone) });
      }
    }

    if (conditions.length === 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Critério de busca inválido.',
      });
    }

    const customer = await withTenant(req.user!.storeId, async (tx) => {
      return await tx.customer.findFirst({
        where: {
          storeId: req.user!.storeId,
          OR: conditions,
        },
      });
    });

    if (!customer) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Cliente não encontrado.',
      });
    }

    let plainPhone = '';
    if (customer.phoneEncrypted) {
      try {
        plainPhone = decryptPii(customer.phoneEncrypted);
      } catch {
        plainPhone = customer.phoneLast4 ? `(••) •••••-${customer.phoneLast4}` : '';
      }
    }

    let plainCpf = cleanCpf;
    if (!plainCpf && customer.cpfEncrypted) {
      try {
        plainCpf = cleanDigits(decryptPii(customer.cpfEncrypted));
      } catch {
        plainCpf = customer.cpfLast4 || '';
      }
    }

    return reply.send({
      id: customer.id,
      name: customer.fullName,
      phone: plainPhone,
      cpfLast4: '***.***.***-' + plainCpf.slice(-2),
    });
  });

  // POST /api/customers
  app.post('/', async (req, reply) => {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email().optional().nullable(),
      phone: z.string().min(8),
      cpf: z.string().min(11),
      city: z.string().optional().nullable(),
      status: z.enum(['ATIVO', 'LEAD', 'INATIVO']).default('ATIVO'),
      segment: z.string().default('Varejo'),
      tags: z.array(z.string()).default([]),
      preferredContact: z.string().default('WhatsApp'),
    });

    const body = schema.parse(req.body);

    const rawCpf = cleanDigits(body.cpf);
    const rawPhone = cleanDigits(body.phone);
    const cpfLast4 = rawCpf.slice(-4);
    const phoneLast4 = rawPhone.slice(-4);

    const cpfHmac = blindIndex(rawCpf);
    const phoneHmac = blindIndex(rawPhone);

    const created = await withTenant(req.user!.storeId, async (tx) => {
      // Checa duplicidade dentro da loja usando Blind Index HMAC
      const existing = await tx.customer.findFirst({
        where: {
          storeId: req.user!.storeId,
          OR: [{ cpfHmac }, { phoneHmac }],
        },
      });

      if (existing) {
        throw new Error('Já existe um cliente cadastrado nesta loja com este CPF ou Telefone.');
      }

      const customer = await tx.customer.create({
        data: {
          storeId: req.user!.storeId,
          fullName: body.name.trim(),
          email: body.email?.trim().toLowerCase() || null,
          status: body.status,
          segment: body.segment,
          tags: body.tags,
          city: body.city || null,
          preferredContact: body.preferredContact,
          cpfEncrypted: encryptPii(body.cpf),
          cpfLast4,
          cpfHmac,
          phoneEncrypted: encryptPii(body.phone),
          phoneLast4,
          phoneHmac,
          notesJson: [],
        },
      });

      await tx.auditLog.create({
        data: {
          storeId: req.user!.storeId,
          actorUserId: req.user!.userId,
          actorName: req.user!.name,
          actorRole: req.user!.role,
          action: 'CREATE_CUSTOMER',
          entityType: 'CUSTOMER',
          entityId: customer.id,
          targetLabel: customer.fullName,
          detail: `Cadastrado cliente ${customer.fullName} com CPF final ${cpfLast4}`,
        },
      });

      return customer;
    });

    return reply.status(201).send(formatCustomerResponse(created));
  });

  // PATCH /api/customers/:id
  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      name: z.string().optional(),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional(),
      cpf: z.string().optional(),
      city: z.string().optional().nullable(),
      status: z.enum(['ATIVO', 'LEAD', 'INATIVO']).optional(),
      segment: z.string().optional(),
      tags: z.array(z.string()).optional(),
      preferredContact: z.string().optional(),
      notes: z.array(z.any()).optional(),
    });

    const body = schema.parse(req.body);

    const updateData: any = {};
    if (body.name) updateData.fullName = body.name.trim();
    if (body.email !== undefined) updateData.email = body.email ? body.email.trim().toLowerCase() : null;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.status) updateData.status = body.status;
    if (body.segment) updateData.segment = body.segment;
    if (body.tags) updateData.tags = body.tags;
    if (body.preferredContact) updateData.preferredContact = body.preferredContact;
    if (body.notes) updateData.notesJson = body.notes;

    if (body.cpf) {
      const raw = cleanDigits(body.cpf);
      updateData.cpfEncrypted = encryptPii(body.cpf);
      updateData.cpfLast4 = raw.slice(-4);
      updateData.cpfHmac = blindIndex(raw);
    }

    if (body.phone) {
      const raw = cleanDigits(body.phone);
      updateData.phoneEncrypted = encryptPii(body.phone);
      updateData.phoneLast4 = raw.slice(-4);
      updateData.phoneHmac = blindIndex(raw);
    }

    const updated = await withTenant(req.user!.storeId, async (tx) => {
      const customer = await tx.customer.update({
        where: { id },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          storeId: req.user!.storeId,
          actorUserId: req.user!.userId,
          actorName: req.user!.name,
          actorRole: req.user!.role,
          action: 'UPDATE_CUSTOMER',
          entityType: 'CUSTOMER',
          entityId: id,
          targetLabel: customer.fullName,
          detail: `Dados cadastrais do cliente atualizados`,
        },
      });

      return customer;
    });

    return reply.send(formatCustomerResponse(updated));
  });
}
