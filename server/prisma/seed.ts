import { PrismaClient, Role, PrimaryItemStatus, CustomerStatus } from '@prisma/client';
import { hashPassword, encryptPii, blindIndex } from '../src/utils/crypto.js';
import { buildValidIMEI } from '../src/utils/luhn.js';

const prisma = new PrismaClient();

const STORE_AURACELL_ID = '11111111-1111-1111-1111-111111111111';
const STORE_SABOR_BRASA_ID = '22222222-2222-2222-2222-222222222222';
const STORE_ATELIER_LINHO_ID = '33333333-3333-3333-3333-333333333333';

export async function runSeed() {
  console.log('🌱 Iniciando seed do OpenCRM...');

  const passwordHashAdmin = await hashPassword('admin123');
  const passwordHashSeller = await hashPassword('vendedor123');

  // ==========================================
  // 1. LOJA 1: AuraCell — Loja Jardins
  // ==========================================
  const auracellTemplate = {
    id: 'store-auracell',
    storeName: 'AuraCell — Loja Jardins',
    segment: 'Celulares & Assistência',
    description: 'Loja física de smartphones seminovos e lacrados com controle serializado por IMEI (Luhn), trade-in e termo de garantia com QR Code.',
    labels: {
      primaryTabName: 'Aparelhos',
      secondaryTabName: 'Acessórios',
      primaryItemSingular: 'Aparelho',
      secondaryItemSingular: 'Acessório',
      orderActionLabel: 'Saída & Garantia',
      crossSellTitle: 'Acessórios Compatíveis',
    },
    features: {
      hasSerializedItems: true,
      hasWarrantyQr: true,
      hasExpirationDate: false,
      hasEntryChecklist: true,
      hasCompatibilityCrossSell: true,
      hasTradeIn: true,
    },
    primaryFields: [
      { id: 'ac-f-brand', key: 'brand', label: 'Marca', type: 'select', required: true, options: ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Google'] },
      { id: 'ac-f-storage', key: 'storage', label: 'Armazenamento', type: 'select', required: true, options: ['64GB', '128GB', '256GB', '512GB', '1TB'] },
      { id: 'ac-f-imei', key: 'imei1', label: 'IMEI 1 (Luhn)', type: 'text', required: true, placeholder: '15 dígitos numéricos', validator: 'imei_luhn' },
    ],
    secondaryFields: [
      { id: 'ac-s-cat', key: 'category', label: 'Categoria', type: 'select', required: true, options: ['Capinha', 'Película de Tela', 'Carregador', 'Cabo', 'Fone de Ouvido'] },
    ],
    defaultChecklist: [
      'Caixa original',
      'Cabo incluso',
      'FaceID / Biometria OK',
      'Sem marcas na tela',
      'Câmeras e Flash OK',
      'Conector de carga OK',
      'Áudio e microfone OK',
      'iCloud / Conta Google desvinculada',
      'Nota / Origem conferida',
    ],
  };

  const storeAuraCell = await prisma.store.upsert({
    where: { slug: 'auracell-jardins' },
    update: {
      name: 'AuraCell — Loja Jardins',
      segment: 'Celulares & Assistência',
      templateConfig: auracellTemplate,
    },
    create: {
      id: STORE_AURACELL_ID,
      slug: 'auracell-jardins',
      name: 'AuraCell — Loja Jardins',
      segment: 'Celulares & Assistência',
      templateConfig: auracellTemplate,
      catalogOptions: {
        brands: ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Google'],
        storages: ['64GB', '128GB', '256GB', '512GB', '1TB'],
        colors: ['Titânio Natural', 'Preto', 'Branco', 'Azul', 'Meia-Noite'],
      },
    },
  });

  // Usuários AuraCell
  const userAdminAura = await prisma.user.upsert({
    where: { email: 'thiago@auracell.com.br' },
    update: { name: 'Thiago Vasconcelos', passwordHash: passwordHashAdmin },
    create: {
      name: 'Thiago Vasconcelos',
      email: 'thiago@auracell.com.br',
      passwordHash: passwordHashAdmin,
    },
  });

  await prisma.storeMembership.upsert({
    where: { userId_storeId: { userId: userAdminAura.id, storeId: storeAuraCell.id } },
    update: { role: Role.ADMIN, isActive: true },
    create: {
      userId: userAdminAura.id,
      storeId: storeAuraCell.id,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const userSellerAura = await prisma.user.upsert({
    where: { email: 'camila@auracell.com.br' },
    update: { name: 'Camila Rocha', passwordHash: passwordHashSeller },
    create: {
      name: 'Camila Rocha',
      email: 'camila@auracell.com.br',
      passwordHash: passwordHashSeller,
    },
  });

  await prisma.storeMembership.upsert({
    where: { userId_storeId: { userId: userSellerAura.id, storeId: storeAuraCell.id } },
    update: { role: Role.VENDEDOR, isActive: true },
    create: {
      userId: userSellerAura.id,
      storeId: storeAuraCell.id,
      role: Role.VENDEDOR,
      isActive: true,
    },
  });

  // Modelos de Aparelho
  const modelIphone16ProMax = await prisma.deviceModel.upsert({
    where: { id: 'd0000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'd0000000-0000-0000-0000-000000000001',
      storeId: storeAuraCell.id,
      brand: 'Apple',
      modelName: 'iPhone 16 Pro Max',
      releaseYear: 2024,
    },
  });

  const modelIphone15 = await prisma.deviceModel.upsert({
    where: { id: 'd0000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: 'd0000000-0000-0000-0000-000000000002',
      storeId: storeAuraCell.id,
      brand: 'Apple',
      modelName: 'iPhone 15',
      releaseYear: 2023,
    },
  });

  // Clientes AuraCell
  const customer1Cpf = '394.821.508-42';
  const customer1Phone = '(11) 98412-3390';
  const customerAura = await prisma.customer.upsert({
    where: { id: 'c0000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'c0000000-0000-0000-0000-000000000001',
      storeId: storeAuraCell.id,
      fullName: 'Carolina Alencar',
      email: 'carolina.alencar@email.com',
      status: CustomerStatus.ATIVO,
      segment: 'VIP',
      tags: ['Cliente Recorrente', 'Apple Fan'],
      cpfEncrypted: encryptPii(customer1Cpf),
      cpfLast4: '0842',
      cpfHmac: blindIndex(customer1Cpf),
      phoneEncrypted: encryptPii(customer1Phone),
      phoneLast4: '3390',
      phoneHmac: blindIndex(customer1Phone),
      city: 'São Paulo',
      preferredContact: 'WhatsApp',
    },
  });

  // Aparelhos AuraCell (com IMEIs válidos no algoritmo de Luhn)
  const imei1Aura = buildValidIMEI('35482910482104'); // Validação de Luhn garantida
  const primaryItem1 = await prisma.primaryItem.upsert({
    where: { id: 'a1000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'a1000000-0000-0000-0000-000000000001',
      storeId: storeAuraCell.id,
      modelId: modelIphone16ProMax.id,
      title: 'iPhone 16 Pro Max 256GB Titânio Natural',
      skuCode: 'IP16PM-256-NAT',
      isSerialized: true,
      stockQty: 1,
      imei1: imei1Aura,
      serialNumber: 'F2LXK990M4',
      storageGb: '256GB',
      ramGb: '8GB',
      color: 'Titânio Natural',
      condition: 'Novo Lacrado',
      batteryHealth: 100,
      batteryCycles: 0,
      originType: 'Fornecedor',
      costPriceCents: 680000,
      salePriceCents: 849900,
      status: PrimaryItemStatus.DISPONIVEL,
      checklistJson: [
        { id: 'box', label: 'Caixa original', checked: true },
        { id: 'cable', label: 'Cabo incluso', checked: true },
      ],
      customAttributes: { brand: 'Apple', storage: '256GB', imei1: imei1Aura },
    },
  });

  // Acessórios AuraCell
  const secondaryItem1 = await prisma.secondaryItem.upsert({
    where: { storeId_sku: { storeId: storeAuraCell.id, sku: 'CAPA-IP16PM-MAG' } },
    update: {},
    create: {
      id: 'a2000000-0000-0000-0000-000000000001',
      storeId: storeAuraCell.id,
      sku: 'CAPA-IP16PM-MAG',
      name: 'Capa MagSafe Transparente iPhone 16 Pro Max',
      brand: 'AuraGuard',
      category: 'Capinha',
      stockQty: 18,
      minStockAlert: 5,
      costPriceCents: 4500,
      salePriceCents: 14990,
      customAttributes: { material: 'Policarbonato', magsafe: true },
    },
  });

  // Compatibilidade
  await prisma.itemCompatibility.upsert({
    where: { id: 'a3000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'a3000000-0000-0000-0000-000000000001',
      storeId: storeAuraCell.id,
      secondaryItemId: secondaryItem1.id,
      deviceModelId: modelIphone16ProMax.id,
      compatibleTag: 'iPhone 16 Pro Max',
    },
  });

  // ==========================================
  // 2. LOJA 2: Sabor & Brasa (Lanches & Validade)
  // ==========================================
  const saborBrasaTemplate = {
    id: 'store-sabor-brasa',
    storeName: 'Sabor & Brasa',
    segment: 'Lanchonete & Hamburgueria',
    description: 'Hamburgueria artesanal com controle de validade de lotes e combos sugeridos.',
    labels: {
      primaryTabName: 'Cardápio / Lanches',
      secondaryTabName: 'Bebidas & Insumos',
      primaryItemSingular: 'Lanche',
      secondaryItemSingular: 'Bebida / Insumo',
      orderActionLabel: 'Novo Pedido',
      crossSellTitle: 'Combos & Adicionais Sugeridos',
    },
    features: {
      hasSerializedItems: false,
      hasWarrantyQr: false,
      hasExpirationDate: true,
      hasEntryChecklist: false,
      hasCompatibilityCrossSell: true,
      hasTradeIn: false,
    },
    primaryFields: [
      { id: 'sb-f-prep', key: 'tempo_preparo_min', label: 'Tempo de Preparo (min)', type: 'number', required: true },
      { id: 'sb-f-exp', key: 'validade_lote', label: 'Validade do Lote', type: 'date', required: true },
    ],
    secondaryFields: [
      { id: 'sb-s-temp', key: 'temperatura', label: 'Temperatura', type: 'select', required: false, options: ['Gelado', 'Quente', 'Ambiente'] },
    ],
    defaultChecklist: [],
  };

  const storeSaborBrasa = await prisma.store.upsert({
    where: { slug: 'sabor-e-brasa' },
    update: { templateConfig: saborBrasaTemplate },
    create: {
      id: STORE_SABOR_BRASA_ID,
      slug: 'sabor-e-brasa',
      name: 'Sabor & Brasa',
      segment: 'Lanchonete & Hamburgueria',
      templateConfig: saborBrasaTemplate,
    },
  });

  const userAdminSabor = await prisma.user.upsert({
    where: { email: 'chef@saborbrasa.com.br' },
    update: { name: 'Chef Rodolfo', passwordHash: passwordHashAdmin },
    create: {
      name: 'Chef Rodolfo',
      email: 'chef@saborbrasa.com.br',
      passwordHash: passwordHashAdmin,
    },
  });

  await prisma.storeMembership.upsert({
    where: { userId_storeId: { userId: userAdminSabor.id, storeId: storeSaborBrasa.id } },
    update: { role: Role.ADMIN, isActive: true },
    create: {
      userId: userAdminSabor.id,
      storeId: storeSaborBrasa.id,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  // Thiago também tem acesso à Sabor & Brasa para alternância multi-loja
  await prisma.storeMembership.upsert({
    where: { userId_storeId: { userId: userAdminAura.id, storeId: storeSaborBrasa.id } },
    update: { role: Role.ADMIN, isActive: true },
    create: {
      userId: userAdminAura.id,
      storeId: storeSaborBrasa.id,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  await prisma.primaryItem.upsert({
    where: { id: 'b1000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: 'b1000000-0000-0000-0000-000000000002',
      storeId: storeSaborBrasa.id,
      title: 'Smash Burger Duplo Defumado',
      skuCode: 'LANCHE-SMASH-02',
      isSerialized: false,
      stockQty: 45,
      costPriceCents: 1250,
      salePriceCents: 3890,
      status: PrimaryItemStatus.DISPONIVEL,
      expiresAt: new Date('2026-11-25T00:00:00Z'),
      customAttributes: { tempo_preparo_min: 12, validade_lote: '2026-11-25' },
    },
  });

  // ==========================================
  // 3. LOJA 3: Atelier Linho (Moda & Tamanhos)
  // ==========================================
  const atelierLinhoTemplate = {
    id: 'store-atelier-linho',
    storeName: 'Atelier Linho',
    segment: 'Loja de Roupas & Moda',
    description: 'Boutique de vestuário autoral com grade de tamanhos e garantia de troca em 30 dias via QR Code.',
    labels: {
      primaryTabName: 'Peças Principais',
      secondaryTabName: 'Acessórios & Calçados',
      primaryItemSingular: 'Peça',
      secondaryItemSingular: 'Acessório',
      orderActionLabel: 'Venda & Troca 30d',
      crossSellTitle: 'Recomendações de Look',
    },
    features: {
      hasSerializedItems: false,
      hasWarrantyQr: true,
      hasExpirationDate: false,
      hasEntryChecklist: false,
      hasCompatibilityCrossSell: true,
      hasTradeIn: false,
    },
    primaryFields: [
      { id: 'al-f-size', key: 'tamanho', label: 'Tamanho', type: 'select', required: true, options: ['PP', 'P', 'M', 'G', 'GG'] },
    ],
    secondaryFields: [
      { id: 'al-s-material', key: 'material', label: 'Material', type: 'text', required: false },
    ],
    defaultChecklist: [],
  };

  const storeAtelierLinho = await prisma.store.upsert({
    where: { slug: 'atelier-linho' },
    update: { templateConfig: atelierLinhoTemplate },
    create: {
      id: STORE_ATELIER_LINHO_ID,
      slug: 'atelier-linho',
      name: 'Atelier Linho',
      segment: 'Loja de Roupas & Moda',
      templateConfig: atelierLinhoTemplate,
    },
  });

  const userAdminAtelier = await prisma.user.upsert({
    where: { email: 'estilo@atelierlinho.com.br' },
    update: { name: 'Helena Duarte', passwordHash: passwordHashAdmin },
    create: {
      name: 'Helena Duarte',
      email: 'estilo@atelierlinho.com.br',
      passwordHash: passwordHashAdmin,
    },
  });

  await prisma.storeMembership.upsert({
    where: { userId_storeId: { userId: userAdminAtelier.id, storeId: storeAtelierLinho.id } },
    update: { role: Role.ADMIN, isActive: true },
    create: {
      userId: userAdminAtelier.id,
      storeId: storeAtelierLinho.id,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  // Thiago também tem acesso ao Atelier Linho para alternância multi-loja
  await prisma.storeMembership.upsert({
    where: { userId_storeId: { userId: userAdminAura.id, storeId: storeAtelierLinho.id } },
    update: { role: Role.ADMIN, isActive: true },
    create: {
      userId: userAdminAura.id,
      storeId: storeAtelierLinho.id,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  await prisma.primaryItem.upsert({
    where: { id: 'c1000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: 'c1000000-0000-0000-0000-000000000003',
      storeId: storeAtelierLinho.id,
      title: 'Camisa Linho Puro Areia - Tam M',
      skuCode: 'MODA-CAM-LINHO-M',
      isSerialized: false,
      stockQty: 8,
      costPriceCents: 8500,
      salePriceCents: 24900,
      status: PrimaryItemStatus.DISPONIVEL,
      customAttributes: { tamanho: 'M', cor: 'Areia' },
    },
  });

  console.log('✅ Seed finalizada com sucesso! 3 Lojas Demo configuradas.');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .catch((err) => {
      console.error('❌ Erro durante a execução da seed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
