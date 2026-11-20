import test from 'node:test';
import assert from 'node:assert/strict';
import { AuraCellService } from './crmService';
import { buildValidIMEI } from '../utils/imei';
import { DEFAULT_CHECKLIST_TEMPLATE } from '../data/mockData';
import {
  BUILTIN_TEMPLATE_PRESET_CARDS,
  getBlankScratchPreset,
  getContextualFeatureMeta,
  getSegmentScratchPreset,
  hasDedicatedSegmentPreset,
  isPhoneOrElectronicsSegment,
} from '../data/templates';

test('createSmartphone rejects invalid Luhn IMEI and accepts valid IMEI with audit and ledger', () => {
  const svc = new AuraCellService();

  assert.throws(
    () =>
      svc.createSmartphone({
        modelId: 'iphone-15',
        brand: 'Apple',
        model: 'iPhone 15',
        storage: '128GB',
        color: 'Preto',
        condition: 'Novo Lacrado',
        batteryHealth: 100,
        origin: 'Fornecedor',
        imei1: '354829104821049', // bad Luhn check digit
        serialNumber: 'TEST1234',
        costPrice: 3900,
        salePrice: 4890,
        checklist: DEFAULT_CHECKLIST_TEMPLATE,
      }),
    /Luhn|inválido/i
  );

  const validImei = buildValidIMEI('35998877665544');
  const beforeCount = svc.listSmartphones().length;
  const beforeLedger = svc.getStockLedger().length;

  const created = svc.createSmartphone({
    modelId: 'iphone-15',
    brand: 'Apple',
    model: 'iPhone 15',
    storage: '128GB',
    ram: '6GB',
    color: 'Preto',
    condition: 'Novo Lacrado',
    batteryHealth: 100,
    batteryCycles: 2,
    origin: 'Fornecedor',
    imei1: validImei,
    serialNumber: 'NEW998877',
    costPrice: 3900,
    salePrice: 4890,
    checklist: DEFAULT_CHECKLIST_TEMPLATE,
    actorName: 'Thiago Vasconcelos',
    actorRole: 'ADMIN',
  });

  assert.equal(svc.listSmartphones().length, beforeCount + 1);
  assert.equal(created.imei1, validImei);
  assert.equal(created.status, 'Disponível');
  assert.equal(created.ram, '6GB');
  assert.equal(created.batteryCycles, 2);
  assert.equal(svc.getStockLedger().length, beforeLedger + 1);
  assert.equal(svc.getStockLedger()[0].reason, 'Entrada');
  assert.equal(svc.getStockLedger()[0].delta, 1);
});

test('createSmartphone handles Trade-in origin linked to CRM customer and Em Avaliação status', () => {
  const svc = new AuraCellService();
  const validImei = buildValidIMEI('35112233445566');

  const created = svc.createSmartphone({
    modelId: 'iphone-14-pro',
    brand: 'Apple',
    model: 'iPhone 14 Pro',
    storage: '256GB',
    color: 'Roxo Profundo',
    condition: 'Em Avaliação / Trade-in',
    batteryHealth: 86,
    batteryCycles: 410,
    origin: 'Troca de Cliente (Trade-in)',
    tradeInCustomerId: 'cu-01',
    initialStatus: 'Em Avaliação',
    imei1: validImei,
    serialNumber: 'TRD445566',
    costPrice: 3100,
    salePrice: 4190,
    checklist: DEFAULT_CHECKLIST_TEMPLATE,
    actorName: 'Camila Rocha',
    actorRole: 'VENDEDOR',
  });

  assert.equal(created.status, 'Em Avaliação');
  assert.equal(created.tradeInCustomerId, 'cu-01');
  assert.equal(svc.getStockLedger()[0].reason, 'Trade-in');
  assert.match(svc.getStockLedger()[0].note ?? '', /Helena Vasconcelos/);
  assert.equal(svc.getAuditLogs()[0].actionType, 'CREATE_SMARTPHONE');
});

test('dynamic session catalog allows creating custom brands, accessory categories, and models', () => {
  const svc = new AuraCellService();

  const addedCat = svc.addCatalogOption('accessoryCategories', 'Lente Externa Clip-on');
  assert.equal(addedCat, 'Lente Externa Clip-on');
  assert.ok(svc.getCatalog().accessoryCategories.includes('Lente Externa Clip-on'));

  // Deduplicates case-insensitively
  const dupCat = svc.addCatalogOption('accessoryCategories', 'lente externa clip-on');
  assert.equal(dupCat, 'Lente Externa Clip-on');

  const newModel = svc.addDeviceModel({ name: 'Nothing Phone (3)', brand: 'Nothing' });
  assert.equal(newModel.brand, 'Nothing');
  assert.ok(svc.listDeviceModels().some((m) => m.id === newModel.id));
  assert.ok(svc.getCatalog().brands.includes('Nothing'));
});

test('getCompatibleAccessoriesForCustomer returns only in-stock accessories matching customer models', () => {
  const svc = new AuraCellService();
  // Helena Vasconcelos (cu-01) owns iphone-15-pro
  const matches = svc.getCompatibleAccessoriesForCustomer('cu-01');
  assert.ok(matches.length > 0);
  for (const acc of matches) {
    assert.ok(acc.stock > 0, `Expected stock > 0 for ${acc.sku}`);
    assert.ok(acc.compatibleModelIds.includes('iphone-15-pro'));
  }

  // Mariana Cordeiro (cu-05) owns redmi-note-13-pro; CAP-SLIM-RN13P has stock 0 and must NOT appear
  const marianaMatches = svc.getCompatibleAccessoriesForCustomer('cu-05');
  assert.equal(
    marianaMatches.some((a) => a.sku === 'CAP-SLIM-RN13P'),
    false
  );
});

test('createOrder marks smartphone as Vendido, decrements accessory stock, writes ledger, and exposes safe public warranty', () => {
  const svc = new AuraCellService();
  const phone = svc.listSmartphones().find((s) => s.status === 'Disponível')!;
  const acc = svc.listAccessories().find((a) => a.id === 'ac-04')!;
  const initialAccStock = acc.stock;
  const initialOrders = svc.listOrders().length;

  const order = svc.createOrder({
    customerId: 'cu-04',
    smartphoneId: phone.id,
    accessoryItems: [{ accessoryId: acc.id, quantity: 2 }],
    warrantyDays: 180,
    paymentMethod: 'PIX',
    sellerName: 'Camila Rocha',
    actorRole: 'VENDEDOR',
  });

  assert.equal(svc.listOrders().length, initialOrders + 1);
  assert.equal(order.totalAmount, phone.salePrice + acc.price * 2);
  assert.equal(order.warrantyDays, 180);
  assert.ok(order.publicToken.length >= 20);

  const updatedPhone = svc.listSmartphones().find((s) => s.id === phone.id)!;
  assert.equal(updatedPhone.status, 'Vendido');

  const updatedAcc = svc.listAccessories().find((a) => a.id === acc.id)!;
  assert.equal(updatedAcc.stock, initialAccStock - 2);

  // Stock ledger recorded both accessory (-2) and smartphone (-1)
  const latestLedger = svc.getStockLedger().slice(0, 2);
  assert.ok(latestLedger.some((l) => l.delta === -1 && l.reason === 'Saída / Venda'));
  assert.ok(latestLedger.some((l) => l.delta === -2 && l.reason === 'Saída / Venda'));

  // Public warranty lookup must expose ONLY safe technical fields (no CPF, phone, email, costPrice)
  const pub = svc.getPublicWarrantyByToken(order.publicToken);
  assert.ok(pub);
  assert.equal(pub.imeiLast4, phone.imei1.slice(-4));
  assert.equal(pub.warrantyDays, 180);
  assert.equal('cpf' in pub, false);
  assert.equal('phone' in pub, false);
  assert.equal('costPrice' in pub, false);
});

test('updateSmartphonePrice and logSensitiveAccess prepend audit entries', () => {
  const svc = new AuraCellService();
  const beforeAudit = svc.getAuditLogs().length;

  svc.logSensitiveAccess('CPF', 'cu-01', 'Helena Vasconcelos', 'Camila Rocha', 'VENDEDOR');
  assert.equal(svc.getAuditLogs().length, beforeAudit + 1);
  assert.equal(svc.getAuditLogs()[0].resourceType, 'CPF');
  assert.equal(svc.getAuditLogs()[0].actor, 'Camila Rocha');

  const phone = svc.listSmartphones()[0];
  svc.updateSmartphonePrice(phone.id, phone.salePrice + 100, 'Thiago Vasconcelos', 'ADMIN');
  assert.equal(svc.getAuditLogs()[0].actionType, 'UPDATE_PRICE');
});

test('createCustomer, updateCustomer, and tags update customerCounts, audit logs, and activity timeline', () => {
  const svc = new AuraCellService();
  const beforeCounts = svc.getDashboardSummary().customerCounts;

  const created = svc.createCustomer({
    name: 'Marina Alencar',
    email: 'marina.alencar@estudio.com.br',
    phone: '(11) 99210-4455',
    cpf: '412.883.190-21',
    city: 'São Paulo, SP',
    status: 'LEAD',
    segment: 'VIP',
    tags: ['iPhone', 'Trade-in'],
    ownedModelIds: ['iphone-15-pro'],
    actorName: 'Thiago Vasconcelos',
    actorRole: 'ADMIN',
  });

  assert.equal(created.initials, 'MA');
  assert.equal(created.status, 'LEAD');
  assert.equal(svc.getDashboardSummary().customerCounts.total, beforeCounts.total + 1);
  assert.equal(svc.getDashboardSummary().customerCounts.lead, beforeCounts.lead + 1);
  assert.equal(svc.getAuditLogs()[0].actionType, 'CREATE_CUSTOMER');

  // Inline tag addition & removal
  svc.addCustomerTag(created.id, 'Prefere Película Privacidade', 'Camila Rocha');
  let fetched = svc.listCustomers().find((c) => c.id === created.id)!;
  assert.ok(fetched.tags.includes('Prefere Película Privacidade'));

  svc.removeCustomerTag(created.id, 'Trade-in');
  fetched = svc.listCustomers().find((c) => c.id === created.id)!;
  assert.equal(fetched.tags.includes('Trade-in'), false);

  // Update customer status LEAD -> ATIVO & audit log
  const updated = svc.updateCustomer(created.id, {
    name: 'Marina Alencar Silva',
    email: 'marina.alencar@estudio.com.br',
    phone: '(11) 99210-4455',
    cpf: '412.883.190-21',
    city: 'São Paulo, SP',
    status: 'ATIVO',
    segment: 'VIP',
    tags: fetched.tags,
    ownedModelIds: ['iphone-15-pro'],
    actorName: 'Thiago Vasconcelos',
    actorRole: 'ADMIN',
  });

  assert.equal(updated.status, 'ATIVO');
  assert.equal(updated.initials, 'MS');
  assert.equal(svc.getAuditLogs()[0].actionType, 'UPDATE_CUSTOMER');
  assert.equal(svc.getDashboardSummary().customerCounts.active, beforeCounts.active + 1);
  assert.equal(svc.getDashboardSummary().customerCounts.lead, beforeCounts.lead);

  // Sensitive data reveal adds audited entry to customer's activity feed
  const activitiesBefore = updated.activities.length;
  svc.logSensitiveAccess('CPF', created.id, updated.name, 'Camila Rocha', 'VENDEDOR');
  const afterReveal = svc.listCustomers().find((c) => c.id === created.id)!;
  assert.equal(afterReveal.activities.length, activitiesBefore + 1);
  assert.equal(afterReveal.activities[0].type, 'audit');
});

test('multi-tenant store switching strictly isolates data across AuraCell, Sabor & Brasa, and Atelier Linho', () => {
  const svc = new AuraCellService();
  assert.equal(svc.getActiveStoreId(), 'store-auracell');
  assert.equal(svc.listStores().length, 3);

  const auraCustomersBefore = svc.listCustomers().length;
  const auraItemsBefore = svc.listSmartphones().length;

  // Switch to Sabor & Brasa (Lanchonete — non-serialized, hasExpirationDate, no warranty QR)
  svc.switchStore('store-sabor-brasa');
  assert.equal(svc.getActiveTemplate().storeName, 'Sabor & Brasa');
  assert.equal(svc.getActiveTemplate().features.hasSerializedItems, false);
  assert.equal(svc.getActiveTemplate().features.hasWarrantyQr, false);
  assert.equal(svc.getActiveTemplate().features.hasExpirationDate, true);

  const saborSummary = svc.getDashboardSummary();
  assert.ok(saborSummary.expiringBatchesCount > 0, 'Expected expiring batches in Sabor & Brasa seed');

  // Create non-serialized menu item with customAttributes & expiresAt (no Luhn IMEI required)
  const newBurger = svc.createSmartphone({
    modelId: 'smash-trufado',
    brand: 'Sabor & Brasa',
    model: 'Smash Trufado Duplo',
    storage: 'Médio',
    color: '—',
    condition: 'Artesanal',
    batteryHealth: 100,
    origin: 'Fornecedor',
    imei1: '',
    serialNumber: 'SB-NEW-01',
    costPrice: 17,
    salePrice: 44,
    checklist: [],
    expiresAt: '2026-11-23',
    customAttributes: {
      ponto_carne: 'Ao Ponto',
      alergenicos: ['Glúten', 'Lactose'],
      pronto_entrega: true,
    },
    actorName: 'Thiago Vasconcelos',
    actorRole: 'ADMIN',
  });
  assert.equal(newBurger.expiresAt, '2026-11-23');
  assert.equal(newBurger.customAttributes?.ponto_carne, 'Ao Ponto');

  // Ordering in non-serialized store keeps menu item Disponível for repeat orders
  const saborCustomer = svc.listCustomers()[0];
  const saborOrder = svc.createOrder({
    customerId: saborCustomer.id,
    smartphoneId: newBurger.id,
    accessoryItems: [],
    warrantyDays: 90,
    paymentMethod: 'PIX',
  });
  assert.ok(saborOrder.code.startsWith('SA-') || saborOrder.code.startsWith('SB-'));
  const afterOrderBurger = svc.listSmartphones().find((s) => s.id === newBurger.id)!;
  assert.equal(afterOrderBurger.status, 'Disponível');

  // Switch to Atelier Linho and back to AuraCell — AuraCell collections must be completely untouched
  svc.switchStore('store-atelier-linho');
  assert.equal(svc.getActiveTemplate().storeName, 'Atelier Linho');
  assert.equal(svc.getActiveTemplate().features.hasWarrantyQr, true);

  svc.switchStore('store-auracell');
  assert.equal(svc.listCustomers().length, auraCustomersBefore);
  assert.equal(svc.listSmartphones().length, auraItemsBefore);
});

test('createStoreFromTemplate creates a fresh isolated workspace and switches to it', () => {
  const svc = new AuraCellService();
  const auraCount = svc.listSmartphones().length;

  const created = svc.createStoreFromTemplate(
    {
      id: 'draft-pet',
      storeName: 'Casa Pata Pet Shop',
      segment: 'Pet Shop',
      description: 'Boutique de nutrição e acessórios para pets.',
      labels: {
        primaryTabName: 'Rações & Nutrição',
        secondaryTabName: 'Brinquedos & Guias',
        primaryItemSingular: 'Ração',
        secondaryItemSingular: 'Acessório Pet',
        orderActionLabel: 'Nova Venda',
        crossSellTitle: 'Sugestões para o Pet',
      },
      features: {
        hasSerializedItems: false,
        hasWarrantyQr: false,
        hasExpirationDate: true,
        hasEntryChecklist: false,
        hasCompatibilityCrossSell: false,
        hasTradeIn: false,
      },
      primaryFields: [
        {
          id: 'pf-porte',
          key: 'porte_pet',
          label: 'Porte do Pet',
          type: 'select',
          required: true,
          options: ['Pequeno', 'Médio', 'Grande'],
        },
        {
          id: 'pf-validade',
          key: 'validade_lote',
          label: 'Validade do Lote',
          type: 'date',
          required: false,
        },
      ],
      secondaryFields: [],
      defaultChecklist: [],
    },
    'Thiago Vasconcelos'
  );

  assert.equal(svc.getActiveStoreId(), created.storeId);
  assert.equal(svc.listStores().length, 4);
  assert.equal(svc.listSmartphones().length, 0);
  assert.equal(svc.listCustomers().length, 0);
  assert.equal(svc.getAuditLogs()[0].actionType, 'CREATE_STORE');

  // Switch back to AuraCell and verify isolation
  svc.switchStore('store-auracell');
  assert.equal(svc.listSmartphones().length, auraCount);
});

test('wizard preset cards, contextual modules, and non-phone serialized stores avoid IMEI/Luhn lock-in', () => {
  // 1. Preset cards use segment titles + 4th Varejo Genérico card, never demo store names
  assert.deepEqual(
    BUILTIN_TEMPLATE_PRESET_CARDS.map((c) => c.title),
    [
      'Loja de Celulares & Assistência',
      'Lanchonete & Hamburgueria',
      'Loja de Roupas & Moda',
      'Varejo Genérico (Base Limpa)',
    ]
  );

  // 1b. Dedicated segment presets vs blank/custom segments
  assert.equal(hasDedicatedSegmentPreset('Papelaria & Presentes'), true);
  assert.equal(hasDedicatedSegmentPreset('Ótica & Joalheria'), true);
  assert.equal(hasDedicatedSegmentPreset('Floricultura'), false);
  assert.equal(getBlankScratchPreset().primaryFields.length, 0);

  // 2. Contextual module labels adapt cleanly to segment
  assert.equal(isPhoneOrElectronicsSegment('Celulares & Assistência'), true);
  assert.equal(isPhoneOrElectronicsSegment('Ótica & Joalheria'), false);
  assert.equal(isPhoneOrElectronicsSegment('Floricultura'), false);

  const phoneModules = getContextualFeatureMeta('Celulares & Assistência');
  assert.equal(
    phoneModules.find((m) => m.key === 'hasSerializedItems')?.label,
    'Controle por Número de Série / IMEI'
  );
  assert.equal(
    phoneModules.find((m) => m.key === 'hasTradeIn')?.label,
    'Troca de Cliente (Trade-in)'
  );

  const jewelryModules = getContextualFeatureMeta('Ótica & Joalheria');
  assert.equal(
    jewelryModules.find((m) => m.key === 'hasSerializedItems')?.label,
    'Controle por Código Único / Peça Exclusiva'
  );
  assert.equal(
    jewelryModules.find((m) => m.key === 'hasTradeIn')?.label,
    'Recebimento de Usados / Troca na Compra'
  );
  assert.equal(
    jewelryModules.find((m) => m.key === 'hasWarrantyQr')?.label,
    'Emissão de Garantia / Certificado com QR Code'
  );
  for (const mod of jewelryModules) {
    assert.equal(/imei|luhn|trade-in/i.test(`${mod.label} ${mod.desc}`), false);
  }

  // 3. Scratch preset for Joalheria provides coherent jewelry labels & fields and disables Luhn IMEI validation
  const joiaPreset = getSegmentScratchPreset('Ótica & Joalheria');
  assert.equal(joiaPreset.labels.primaryTabName, 'Joias & Peças');
  assert.equal(joiaPreset.labels.secondaryTabName, 'Acessórios & Embalagens');
  assert.ok(joiaPreset.primaryFields.some((f) => f.label === 'Material / Metal'));
  assert.ok(joiaPreset.primaryFields.some((f) => f.label === 'Quilate / Pedra'));
  assert.ok(joiaPreset.primaryFields.some((f) => f.label === 'Tamanho / Aro'));
  assert.ok(joiaPreset.primaryFields.some((f) => f.label === 'Certificado'));
  assert.equal(
    joiaPreset.primaryFields.some((f) => f.validator === 'imei_luhn'),
    false
  );

  // 4. Creating a serialized Jewelry store allows registering a unique piece without Luhn IMEI validation
  const svc = new AuraCellService();
  svc.createStoreFromTemplate(
    {
      id: 'draft-joalheria',
      storeName: 'Atelier Ouro Fino',
      segment: 'Ótica & Joalheria',
      description: 'Joalheria autoral',
      labels: joiaPreset.labels,
      features: joiaPreset.features,
      primaryFields: joiaPreset.primaryFields,
      secondaryFields: [],
      defaultChecklist: ['Cravação revisada', 'Certificado conferido'],
    },
    'Thiago Vasconcelos'
  );

  const piece = svc.createSmartphone({
    modelId: 'anel-solitario',
    brand: 'Coleção Aurum',
    model: 'Anel Solitário Ouro 18k',
    storage: 'Ouro 18k',
    color: 'Dourado',
    condition: 'Peça Exclusiva',
    batteryHealth: 100,
    origin: 'Fornecedor',
    imei1: '',
    serialNumber: 'GIA-2026-0841',
    costPrice: 2400,
    salePrice: 4990,
    checklist: [],
    customAttributes: {
      material_metal: 'Ouro 18k',
      quilate_pedra: 'Diamante 0.5ct',
      tamanho_aro: 'Aro 16',
      certificado: 'GIA-2026-0841',
    },
  });

  assert.equal(piece.serialNumber, 'GIA-2026-0841');
  assert.equal(piece.imei1, '');
  assert.equal(piece.customAttributes?.material_metal, 'Ouro 18k');
});

test('non-serialized primary stockQty, quick restockSmartphones, and frictionless secondary creation work end-to-end', () => {
  const svc = new AuraCellService();
  const bakeryPreset = getSegmentScratchPreset('Cafeteria & Padaria');

  svc.createStoreFromTemplate(
    {
      id: 'draft-casa-pao',
      storeName: 'Casa de Pão',
      segment: 'Cafeteria & Padaria',
      description: 'Padaria artesanal e café.',
      labels: bakeryPreset.labels,
      features: bakeryPreset.features,
      primaryFields: bakeryPreset.primaryFields,
      secondaryFields: [],
      defaultChecklist: [],
    },
    'Thiago Vasconcelos'
  );

  // 1. Secondary item registration works smoothly even on a brand-new empty store (hasCompatibilityCrossSell: true)
  const insumo = svc.createAccessory({
    sku: 'FAR-TRIGO-5KG',
    name: 'Farinha Italiana Tipo 00',
    category: 'Insumos',
    compatibleModelIds: [],
    stock: 12,
    minStock: 4,
    costPrice: 22,
    price: 38,
    actorName: 'Thiago Vasconcelos',
    actorRole: 'ADMIN',
  });
  assert.equal(insumo.stock, 12);
  assert.deepEqual(insumo.compatibleModelIds, ['usb-c-universal']);

  // Bulk restock on secondary item
  svc.restockAccessories([insumo.id], 25, 'Thiago Vasconcelos', 'ADMIN');
  const afterAccRestock = svc.listAccessories().find((a) => a.id === insumo.id)!;
  assert.equal(afterAccRestock.stock, 37);
  assert.equal(svc.getStockLedger()[0].delta, 25);
  assert.equal(svc.getStockLedger()[0].note, '+25 Reposição no Balcão');
  assert.equal(svc.getAuditLogs()[0].actionType, 'RESTOCK');

  // 2. Primary item defaults to stockQty: 1, stockUnit: 'un.', status: 'Disponível'
  const defaultBread = svc.createSmartphone({
    modelId: 'baguete-rustica',
    brand: 'Casa de Pão',
    model: 'Baguete Rústica',
    storage: '300g',
    color: '—',
    condition: 'Padrão',
    batteryHealth: 100,
    origin: 'Fornecedor',
    imei1: '',
    serialNumber: 'CP-01',
    costPrice: 5,
    salePrice: 14,
    checklist: [],
  });
  assert.equal(defaultBread.stockQty, 1);
  assert.equal(defaultBread.stockUnit, 'un.');
  assert.equal(defaultBread.status, 'Disponível');

  // 3. Primary item with explicit stockQty, unit ('kg'), and custom status ('Reservado')
  const sourdough = svc.createSmartphone({
    modelId: 'pao-fermentacao-natural',
    brand: 'Casa de Pão',
    model: 'Pão de Fermentação Natural',
    storage: '1 kg',
    color: '—',
    condition: 'Fornada Especial',
    batteryHealth: 100,
    origin: 'Fornecedor',
    initialStatus: 'Reservado',
    imei1: '',
    serialNumber: 'CP-02',
    costPrice: 12,
    salePrice: 32,
    stockQty: 2,
    stockUnit: 'kg',
    checklist: [],
  });
  assert.equal(sourdough.stockQty, 2);
  assert.equal(sourdough.stockUnit, 'kg');
  assert.equal(sourdough.status, 'Reservado');

  // 4. Quick restockSmartphones adds delta, transitions status to Disponível, and writes Stock Ledger + Audit Log
  svc.restockSmartphones([sourdough.id], 10, {
    setAvailable: true,
    actorName: 'Camila Rocha',
    actorRole: 'VENDEDOR',
  });
  const restocked = svc.listSmartphones().find((s) => s.id === sourdough.id)!;
  assert.equal(restocked.stockQty, 12);
  assert.equal(restocked.stockUnit, 'kg');
  assert.equal(restocked.status, 'Disponível');

  const latestLedger = svc.getStockLedger()[0];
  assert.equal(latestLedger.itemId, sourdough.id);
  assert.equal(latestLedger.delta, 10);
  assert.equal(latestLedger.resultingStock, 12);
  assert.equal(latestLedger.reason, 'Reposição');
  assert.equal(latestLedger.note, '+10 Reposição no Balcão');

  const latestAudit = svc.getAuditLogs()[0];
  assert.equal(latestAudit.actionType, 'RESTOCK');
  assert.equal(latestAudit.actor, 'Camila Rocha');
  assert.ok(latestAudit.detail?.includes('+10 kg'));
  assert.ok(latestAudit.detail?.includes('Disponível'));
});



