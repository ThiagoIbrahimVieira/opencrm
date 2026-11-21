import test from 'node:test';
import assert from 'node:assert/strict';
import { AuraCellService } from './crmService';
import { AuthService } from './authService';
import { buildDefaultTemplateForStore, CUSTOM_SCRATCH_SEGMENT, getBlankScratchPreset } from '../data/templates';

test('Zero-Mock Isolation: Real accounts start strictly empty with zero mock stores or inventory', () => {
  const realSvc = new AuraCellService(undefined, false);

  assert.equal(realSvc.getIsDemoMode(), false, 'Real account must NOT be in demo mode');
  assert.equal(realSvc.listStores().length, 0, 'Real account must have 0 stores on start');
  assert.equal(realSvc.getActiveStoreId(), '', 'Active store ID must be empty string');
  assert.equal(realSvc.listSmartphones().length, 0, 'Real account must have 0 smartphones');
  assert.equal(realSvc.listAccessories().length, 0, 'Real account must have 0 accessories');
  assert.equal(realSvc.listCustomers().length, 0, 'Real account must have 0 customers');
  assert.equal(realSvc.listOrders().length, 0, 'Real account must have 0 orders');
  assert.equal(realSvc.getStockLedger().length, 0, 'Real account must have 0 ledger entries');

  const summary = realSvc.getDashboardSummary();
  assert.equal(summary.availableSmartphones, 0);
  assert.equal(summary.reservedSmartphones, 0);
  assert.equal(summary.evaluatingSmartphones, 0);
  assert.equal(summary.lowStockAccessories, 0);
  assert.equal(summary.totalAccessoryUnits, 0);
  assert.equal(summary.customerCounts.total, 0);
  assert.equal(summary.customerCounts.active, 0);
  assert.equal(summary.customerCounts.lead, 0);
});

test('Zero-Mock Isolation: Hydrating empty list keeps stores strictly empty (zero leak of demo stores)', () => {
  const realSvc = new AuraCellService(undefined, false);
  realSvc.hydrateStoresFromApi([]);

  assert.equal(realSvc.listStores().length, 0);
  assert.equal(realSvc.listSmartphones().length, 0);
  assert.equal(realSvc.listAccessories().length, 0);
  assert.equal(realSvc.listCustomers().length, 0);
});

test('AccountType Intent & Validation: ADMIN, VENDEDOR and UNSET handling in AuthService', async () => {
  const auth = new AuthService(null);

  // 1. Unauthenticated state
  assert.equal(auth.getCurrentUser(), null);
  assert.equal(auth.isDemoMode(), false);

  // 2. Admin Registration sets accountType = 'ADMIN'
  const admin = await auth.registerStore({
    adminName: 'Eduardo Fonseca',
    adminEmail: 'eduardo@realbrasil.com.br',
    adminPassword: 'Password123!',
    storeName: 'Fonseca Imports',
    segment: 'Varejo',
  });
  assert.equal(admin.accountType, 'ADMIN');
  assert.equal(admin.role, 'ADMIN');
  assert.equal(auth.getCurrentUser()?.accountType, 'ADMIN');
  assert.equal(auth.isDemoMode(), false);

  // 3. Seller Registration sets accountType = 'VENDEDOR' and waiting storeUnit
  auth.logout();
  const seller = await auth.registerSeller({
    name: 'Mariana Lima',
    email: 'mariana@vendas.com.br',
    password: 'Password123!',
  });
  assert.equal(seller.accountType, 'VENDEDOR');
  assert.equal(seller.role, 'VENDEDOR');
  assert.equal(seller.storeUnit, 'Aguardando vínculo');
  assert.equal(auth.getCurrentUser()?.accountType, 'VENDEDOR');
  assert.equal(auth.isDemoMode(), false);

  // 4. Updating accountType persists and updates role
  const changed = await auth.setAccountType('ADMIN');
  assert.equal(changed.accountType, 'ADMIN');
  assert.equal(changed.role, 'ADMIN');
  assert.equal(auth.getCurrentUser()?.accountType, 'ADMIN');
});

test('Wizard Persistence & F5 Reload: Custom Scratch / Outros creates clean real store without mock contamination', () => {
  const realSvc = new AuraCellService(undefined, false);

  // Admin creates store via Wizard using Custom Scratch segment
  const templateInput = buildDefaultTemplateForStore('Minha Loja de Roupas', 'Outros');
  const created = realSvc.createStoreFromTemplate(templateInput, 'Eduardo Fonseca');

  assert.equal(created.template.storeName, 'Minha Loja de Roupas');
  assert.equal(created.template.segment, 'Outros');
  assert.equal(realSvc.listStores().length, 1);
  assert.equal(realSvc.getActiveStoreId(), created.storeId);

  // Scratch / Outros must NOT inject AuraCell smartphones or accessories
  assert.equal(realSvc.listSmartphones().length, 0, 'Scratch store must have 0 smartphones');
  assert.equal(realSvc.listAccessories().length, 0, 'Scratch store must have 0 accessories');
  assert.equal(realSvc.listCustomers().length, 0, 'Scratch store must have 0 customers');

  // Simulate F5 page reload: store hydrated from backend /api/stores/mine
  const backendStoresPayload = [
    {
      storeId: created.storeId,
      role: 'ADMIN',
      store: {
        id: created.storeId,
        name: created.template.storeName,
        slug: 'minha-loja-de-roupas',
        segment: 'Outros',
        templateConfig: realSvc.getActiveTemplate(),
      },
    },
  ];

  const reloadedSvc = new AuraCellService(undefined, false);
  reloadedSvc.hydrateStoresFromApi(backendStoresPayload);

  assert.equal(reloadedSvc.listStores().length, 1);
  assert.equal(reloadedSvc.getActiveStoreId(), created.storeId);
  assert.equal(reloadedSvc.getActiveTemplate().storeName, 'Minha Loja de Roupas');
  assert.equal(reloadedSvc.listSmartphones().length, 0, 'Zero phones after reload');
  assert.equal(reloadedSvc.listAccessories().length, 0, 'Zero accessories after reload');
});

test('Persistent Blocking: Unlinked Seller remains blocked in AwaitingStoreAccessView after F5 simulation', async () => {
  const auth = new AuthService(null);
  const realSvc = new AuraCellService(undefined, false);

  // Register seller without store link
  const seller = await auth.registerSeller({
    name: 'Vendedor Sem Loja',
    email: 'vendedor.semloja@gmail.com',
    password: 'Password123!',
  });

  assert.equal(seller.accountType, 'VENDEDOR');
  assert.equal(seller.role, 'VENDEDOR');
  assert.equal(seller.storeUnit, 'Aguardando vínculo');

  // Backend returns 0 stores for this seller
  realSvc.hydrateStoresFromApi([]);
  assert.equal(realSvc.listStores().length, 0);

  // Verification condition for AwaitingStoreAccessView:
  const shouldShowAwaitingScreen =
    seller.role === 'VENDEDOR' &&
    (realSvc.listStores().length === 0 || seller.storeUnit === 'Aguardando vínculo');

  assert.equal(shouldShowAwaitingScreen, true, 'Unlinked seller MUST show AwaitingStoreAccessView');

  // Simulate F5: reload session from auth API
  // Refresh returns 0 stores
  const refreshResult = await auth.refreshUserAndStores();
  assert.equal(refreshResult.storesCount, 0, 'Seller still has 0 stores on refresh');
  assert.equal(auth.getCurrentUser()?.role, 'VENDEDOR', 'Seller must NEVER become ADMIN after refresh');
  assert.equal(auth.isAdmin(), false);
});

test('Demo Mode Isolation: Demo mode stays completely isolated with mockData and does not leak into real sessions', () => {
  const svc = new AuraCellService();

  // Demo mode loads 3 mock stores
  svc.setDemoMode(true);
  assert.equal(svc.getIsDemoMode(), true);
  assert.equal(svc.listStores().length, 3);
  assert.ok(svc.listSmartphones().length > 0);
  assert.ok(svc.listAccessories().length > 0);

  // Switch to another demo store
  svc.switchStore('store-sabor-brasa');
  assert.equal(svc.getActiveStoreId(), 'store-sabor-brasa');
  assert.equal(svc.getActiveTemplate().storeName, 'Sabor & Brasa');

  // Resetting for real account purges all mock data cleanly
  svc.resetForRealAccount();
  assert.equal(svc.getIsDemoMode(), false);
  assert.equal(svc.listStores().length, 0);
  assert.equal(svc.getActiveStoreId(), '');
  assert.equal(svc.listSmartphones().length, 0);
  assert.equal(svc.listAccessories().length, 0);
  assert.equal(svc.listCustomers().length, 0);
});

test('Role Choice & Navigation: setNeedsRoleChoice toggles role choice modal state', () => {
  const auth = new AuthService(null);
  assert.equal(auth.getSnapshot().needsRoleChoice, false);

  auth.setNeedsRoleChoice(true);
  assert.equal(auth.getSnapshot().needsRoleChoice, true);

  auth.setNeedsRoleChoice(false);
  assert.equal(auth.getSnapshot().needsRoleChoice, false);
});

test('Clean Template Builder Defaults: CUSTOM_SCRATCH_SEGMENT starts with 0 primary fields and never leaks Pet Shop fields', () => {
  assert.equal(CUSTOM_SCRATCH_SEGMENT, 'Personalizado (Do zero)');

  const blankPreset = getBlankScratchPreset();
  assert.equal(blankPreset.primaryFields.length, 0, 'Blank scratch preset must have 0 custom fields');
  assert.equal(blankPreset.features.hasSerializedItems, false);
  assert.equal(blankPreset.features.hasWarrantyQr, false);
  assert.equal(blankPreset.features.hasTradeIn, false);
  assert.equal(blankPreset.labels.primaryItemSingular, 'Produto');

  // Verify none of the fields or labels mention pet, raca, microchip, etc.
  const serialized = JSON.stringify(blankPreset).toLowerCase();
  assert.ok(!serialized.includes('pet'), 'Must not include pet references by default');
  assert.ok(!serialized.includes('raca'), 'Must not include raca references by default');
  assert.ok(!serialized.includes('microchip'), 'Must not include microchip references by default');
});

test('Demo Mode: Custom stores created in demo mode are registered, switchable and isolated', () => {
  const svc = new AuraCellService();
  svc.setDemoMode(true);
  const initialCount = svc.listStores().length;

  const newStore = svc.createStoreFromTemplate({
    id: 'store-oficina-pro',
    storeName: 'Oficina Pro Auto Peças',
    segment: 'Oficina Mecânica',
    description: 'Workspace de autopeças',
    labels: {
      primaryTabName: 'Peças & Componentes',
      secondaryTabName: 'Óleos & Lubrificantes',
      primaryItemSingular: 'Peça',
      secondaryItemSingular: 'Óleo',
      orderActionLabel: 'Balcão & O.S.',
      crossSellTitle: 'Itens Recomendados',
    },
    features: {
      hasSerializedItems: false,
      hasWarrantyQr: true,
      hasTradeIn: false,
      hasEntryChecklist: true,
      hasCompatibilityCrossSell: true,
      hasExpirationDate: false,
    },
    primaryFields: [
      { id: 'f1', key: 'veiculo', label: 'Veículo', type: 'text', required: true, validator: 'none' },
    ],
    secondaryFields: [],
    defaultChecklist: ['Peça inspecionada'],
  });

  assert.equal(svc.listStores().length, initialCount + 1);
  assert.equal(svc.getActiveStoreId(), newStore.storeId);
  assert.equal(svc.getActiveTemplate().storeName, 'Oficina Pro Auto Peças');
  assert.equal(svc.getActiveTemplate().labels.primaryTabName, 'Peças & Componentes');
  assert.equal(svc.listSmartphones().length, 0, 'New custom store must start completely empty');

  // Switch back to AuraCell
  svc.switchStore('store-auracell');
  assert.equal(svc.getActiveStoreId(), 'store-auracell');
  assert.equal(svc.getActiveTemplate().storeName, 'AuraCell');

  // Switch back to Oficina Pro
  svc.switchStore(newStore.storeId);
  assert.equal(svc.getActiveStoreId(), newStore.storeId);
});

test('AuthService: switchStore in demo mode does not call backend /api/stores/switch', async () => {
  const auth = new AuthService(null);
  auth.loginDemo('ADMIN');
  assert.equal(auth.isDemoMode(), true);

  // Calling switchStore with non-UUID demo ID must succeed cleanly without network exception
  await assert.doesNotReject(async () => {
    await auth.switchStore('template-food');
  });
});
