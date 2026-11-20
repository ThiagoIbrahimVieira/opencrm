import { REFERENCE_TODAY } from '../data/mockData';
import {
  ATELIER_LINHO_TEMPLATE,
  AURACELL_TEMPLATE,
  SABOR_BRASA_TEMPLATE,
  StoreSeedDataset,
  buildAtelierLinhoSeed,
  buildAuraCellSeed,
  buildEmptyStoreSeed,
  buildSaborBrasaSeed,
  templateRequiresImeiLuhn,
} from '../data/templates';
import { UserRole } from '../types/auth';
import {
  Accessory,
  AuditActionType,
  AuditLogEntry,
  CreateAccessoryInput,
  CreateCustomerInput,
  CreateOrderInput,
  CreateSmartphoneInput,
  Customer,
  CustomerActivity,
  DeviceModel,
  DynamicCatalog,
  Order,
  OrderAccessoryLine,
  PublicWarrantyViewData,
  Smartphone,
  SmartphoneStatus,
  StockLedgerEntry,
  StockLedgerReason,
  UpdateCustomerInput,
  WeeklyMovementPoint,
} from '../types/crm';
import { StoreSummaryItem, StoreTemplate } from '../types/template';
import {
  addDaysISO,
  cleanDigits,
  formatCurrencyBRL,
  getDaysRemaining,
  getWarrantyPercentRemaining,
  validateIMEI,
} from '../utils/imei';
import { generateWarrantyUuid } from '../utils/qrAndWhatsapp';
import { apiRequest } from './apiClient';

export interface CrmStoreState extends StoreSeedDataset {
  activeStoreId: string;
  activeTemplate: StoreTemplate;
  stores: StoreSummaryItem[];
}

export interface DashboardSummary {
  availableSmartphones: number;
  reservedSmartphones: number;
  evaluatingSmartphones: number;
  lowStockAccessories: number;
  totalAccessoryUnits: number;
  activeWarranties: number;
  expiringWarrantiesCount: number;
  expiringBatchesCount: number;
  weeklyOutputs: number;
  weeklyRevenue: number;
  customerCounts: {
    total: number;
    active: number;
    lead: number;
    inactive: number;
  };
}

interface StoreWorkspace {
  storeId: string;
  template: StoreTemplate;
  data: StoreSeedDataset;
}

type Listener = () => void;

function buildCustomerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function cloneTemplate(template: StoreTemplate): StoreTemplate {
  return {
    ...template,
    labels: { ...template.labels },
    features: { ...template.features },
    primaryFields: template.primaryFields.map((f) => ({
      ...f,
      options: f.options ? [...f.options] : undefined,
    })),
    secondaryFields: template.secondaryFields.map((f) => ({
      ...f,
      options: f.options ? [...f.options] : undefined,
    })),
    defaultChecklist: [...template.defaultChecklist],
  };
}

function slugifyId(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildStoreOrderPrefix(storeName: string): string {
  const clean = storeName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  if (clean.length >= 2) return clean.slice(0, 2);
  return 'OC';
}

function buildInitialWorkspaces(customAuraSeed?: StoreSeedDataset): Map<string, StoreWorkspace> {
  const map = new Map<string, StoreWorkspace>();
  map.set(AURACELL_TEMPLATE.id, {
    storeId: AURACELL_TEMPLATE.id,
    template: cloneTemplate(AURACELL_TEMPLATE),
    data: customAuraSeed ?? buildAuraCellSeed(),
  });
  map.set(SABOR_BRASA_TEMPLATE.id, {
    storeId: SABOR_BRASA_TEMPLATE.id,
    template: cloneTemplate(SABOR_BRASA_TEMPLATE),
    data: buildSaborBrasaSeed(),
  });
  map.set(ATELIER_LINHO_TEMPLATE.id, {
    storeId: ATELIER_LINHO_TEMPLATE.id,
    template: cloneTemplate(ATELIER_LINHO_TEMPLATE),
    data: buildAtelierLinhoSeed(),
  });
  return map;
}

/**
 * Multi-tenant data-access service layer ready to map 1:1 to PostgreSQL (`store_id` + `JSONB`).
 * Isolates all domain collections per `storeId` while preserving AuraCell's IMEI Luhn check,
 * Trade-in workflow, immutable Stock Ledger, Audit Log, and public QR warranty lookup.
 */
export class AuraCellService {
  private stores: Map<string, StoreWorkspace>;
  private activeStoreId: string;
  private cachedSnapshot!: CrmStoreState;
  private listeners: Set<Listener> = new Set();

  constructor(initialState?: StoreSeedDataset) {
    this.stores = buildInitialWorkspaces(initialState);
    this.activeStoreId = AURACELL_TEMPLATE.id;
    this.rebuildSnapshot();
  }

  private get activeWorkspace(): StoreWorkspace {
    return (
      this.stores.get(this.activeStoreId) ??
      Array.from(this.stores.values())[0]
    );
  }

  private get state(): StoreSeedDataset {
    return this.activeWorkspace.data;
  }

  private set state(next: StoreSeedDataset) {
    this.activeWorkspace.data = next;
  }

  private rebuildSnapshot(): void {
    const ws = this.activeWorkspace;
    const storeList: StoreSummaryItem[] = Array.from(this.stores.values()).map((item) => ({
      storeId: item.storeId,
      template: item.template,
    }));
    this.cachedSnapshot = {
      ...ws.data,
      activeStoreId: ws.storeId,
      activeTemplate: ws.template,
      stores: storeList,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.rebuildSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  reset(): void {
    this.stores = buildInitialWorkspaces();
    this.activeStoreId = AURACELL_TEMPLATE.id;
    this.notify();
  }

  getSnapshot(): CrmStoreState {
    return this.cachedSnapshot;
  }

  // --- Multi-Tenant Store & Template API ---

  listStores(): StoreSummaryItem[] {
    return this.cachedSnapshot.stores;
  }

  getActiveStoreId(): string {
    return this.activeStoreId;
  }

  getActiveTemplate(): StoreTemplate {
    return this.activeWorkspace.template;
  }

  switchStore(storeId: string): StoreSummaryItem {
    const target = this.stores.get(storeId);
    if (!target) {
      throw new Error('Loja não encontrada no workspace.');
    }
    this.activeStoreId = target.storeId;
    this.notify();
    return { storeId: target.storeId, template: target.template };
  }

  createStoreFromTemplate(
    templateInput: StoreTemplate,
    actorName = 'Thiago Vasconcelos'
  ): StoreSummaryItem {
    const cleanName = templateInput.storeName.trim();
    if (!cleanName) {
      throw new Error('Informe o nome da nova loja.');
    }

    const baseSlug = slugifyId(cleanName) || 'loja';
    let candidateId = `store-${baseSlug}`;
    if (this.stores.has(candidateId)) {
      candidateId = `store-${baseSlug}-${Date.now().toString().slice(-4)}`;
    }

    const normalizedTemplate: StoreTemplate = {
      ...cloneTemplate(templateInput),
      id: candidateId,
      storeName: cleanName,
      segment: templateInput.segment.trim() || 'Varejo Geral',
    };

    const seed = buildEmptyStoreSeed(normalizedTemplate);
    seed.auditLogs[0].actor = actorName;

    this.stores.set(candidateId, {
      storeId: candidateId,
      template: normalizedTemplate,
      data: seed,
    });
    this.activeStoreId = candidateId;
    this.notify();

    return { storeId: candidateId, template: normalizedTemplate };
  }

  // --- Store-Scoped Read Helpers ---

  listDeviceModels(): DeviceModel[] {
    return this.state.deviceModels;
  }

  getCatalog(): DynamicCatalog {
    return this.state.catalog;
  }

  getModelLabel(modelId: string): string {
    return this.state.deviceModels.find((m) => m.id === modelId)?.tagLabel ?? modelId;
  }

  listSmartphones(): Smartphone[] {
    return this.state.smartphones;
  }

  listAccessories(): Accessory[] {
    return this.state.accessories;
  }

  listCustomers(): Customer[] {
    return this.state.customers;
  }

  listOrders(): Order[] {
    return this.state.orders;
  }

  getOrdersForCustomer(customerId: string): Order[] {
    return this.state.orders
      .filter((o) => o.customerId === customerId)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }

  getAuditLogs(): AuditLogEntry[] {
    return this.state.auditLogs;
  }

  getStockLedger(): StockLedgerEntry[] {
    return this.state.stockLedger;
  }

  getWeeklyMovement(): WeeklyMovementPoint[] {
    return this.state.weeklyMovement;
  }

  // --- Dynamic Session Catalog Mutators (for CreatableSelect) ---

  addCatalogOption(field: keyof DynamicCatalog, rawLabel: string): string {
    const clean = rawLabel.trim();
    if (!clean) return clean;
    const existing = this.state.catalog[field].find(
      (item) => item.toLowerCase() === clean.toLowerCase()
    );
    if (existing) return existing;

    this.state = {
      ...this.state,
      catalog: {
        ...this.state.catalog,
        [field]: [...this.state.catalog[field], clean],
      },
    };
    this.notify();
    return clean;
  }

  addDeviceModel(params: { name: string; brand?: string }): DeviceModel {
    const cleanName = params.name.trim();
    const cleanBrand = params.brand?.trim() || 'Outros';
    const existing = this.state.deviceModels.find(
      (m) => m.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) return existing;

    const baseId = slugifyId(cleanName) || `model-${Date.now()}`;
    const uniqueId = this.state.deviceModels.some((m) => m.id === baseId)
      ? `${baseId}-${Date.now().toString().slice(-3)}`
      : baseId;

    const created: DeviceModel = {
      id: uniqueId,
      brand: cleanBrand,
      name: cleanName,
      tagLabel: cleanName,
      storages: [...this.state.catalog.storages],
      colors: [...this.state.catalog.colors],
    };

    const nextBrands = this.state.catalog.brands.some(
      (b) => b.toLowerCase() === cleanBrand.toLowerCase()
    )
      ? this.state.catalog.brands
      : [...this.state.catalog.brands, cleanBrand];

    this.state = {
      ...this.state,
      deviceModels: [created, ...this.state.deviceModels],
      catalog: {
        ...this.state.catalog,
        brands: nextBrands,
      },
    };
    this.notify();
    return created;
  }

  // --- Audit & Immutable Stock Ledger Helpers ---

  private appendAudit(params: {
    actor: string;
    actorRole: UserRole;
    actionType: AuditActionType;
    actionLabel: string;
    targetLabel: string;
    detail?: string;
    resourceType?: AuditLogEntry['resourceType'];
    resourceId?: string;
  }): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...params,
    };
    this.state = {
      ...this.state,
      auditLogs: [entry, ...this.state.auditLogs],
    };
    return entry;
  }

  private appendLedger(params: {
    actor: string;
    itemType: 'Aparelho' | 'Acessório';
    itemId: string;
    itemLabel: string;
    sku: string;
    delta: number;
    resultingStock: number;
    reason: StockLedgerReason;
    note?: string;
  }): StockLedgerEntry {
    const entry: StockLedgerEntry = {
      id: `ldg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...params,
    };
    this.state = {
      ...this.state,
      stockLedger: [entry, ...this.state.stockLedger],
    };
    return entry;
  }

  logAuditEvent(params: {
    actor: string;
    actorRole: UserRole;
    actionType: AuditActionType;
    actionLabel: string;
    targetLabel: string;
    detail?: string;
    resourceType?: AuditLogEntry['resourceType'];
    resourceId?: string;
  }): AuditLogEntry {
    const entry = this.appendAudit(params);
    this.notify();
    return entry;
  }

  /**
   * Records an audited reveal event for sensitive PII or IMEI access.
   */
  logSensitiveAccess(
    resourceType: 'IMEI' | 'CPF' | 'PHONE',
    resourceId: string,
    resourceLabel: string,
    actor = 'Thiago Vasconcelos',
    actorRole: UserRole = 'ADMIN'
  ): AuditLogEntry {
    const isImei = resourceType === 'IMEI';
    const entry = this.appendAudit({
      actor,
      actorRole,
      actionType: isImei ? 'REVEAL_IMEI' : 'REVEAL_PII',
      actionLabel: isImei ? 'Revelar IMEI' : 'Revelar CPF / Telefone',
      targetLabel: resourceLabel,
      detail: isImei
        ? 'Visualização de IMEI completo na sessão'
        : 'Visualização de dados sensíveis do cliente',
      resourceType,
      resourceId,
    });

    if (!isImei) {
      this.appendCustomerActivity(resourceId, {
        type: 'audit',
        title: 'Dados sensíveis consultados (auditado)',
        detail: `CPF e telefone visualizados por ${actor}`,
        actor,
      });
    }

    this.notify();

    if (typeof window !== 'undefined') {
      apiRequest('/api/audit/reveal', {
        method: 'POST',
        body: JSON.stringify({ resourceType, resourceId }),
      }).catch(() => {});
    }

    return entry;
  }

  private appendCustomerActivity(
    customerId: string,
    activity: Omit<CustomerActivity, 'id' | 'timestamp'>
  ): void {
    const newActivity: CustomerActivity = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...activity,
    };
    this.state = {
      ...this.state,
      customers: this.state.customers.map((c) =>
        c.id === customerId
          ? { ...c, activities: [newActivity, ...c.activities] }
          : c
      ),
    };
  }

  /**
   * Registers a new CRM customer with validation and Audit Log entry.
   */
  createCustomer(input: CreateCustomerInput): Customer {
    const cleanName = input.name.trim();
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanPhone = input.phone.trim();
    const cleanCpf = input.cpf.trim();

    if (!cleanName) throw new Error('Informe o nome completo do cliente.');
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Informe um e-mail válido para o cliente.');
    }
    if (cleanDigits(cleanPhone).length < 10) {
      throw new Error('Informe um telefone/WhatsApp válido com DDD.');
    }
    if (cleanDigits(cleanCpf).length !== 11) {
      throw new Error('Informe um CPF válido com 11 dígitos.');
    }
    if (this.state.customers.some((c) => c.email.toLowerCase() === cleanEmail)) {
      throw new Error('Já existe um cliente cadastrado com este e-mail.');
    }

    const actor = input.actorName ?? 'Thiago Vasconcelos';
    const actorRole = input.actorRole ?? 'ADMIN';
    const cleanTags = Array.from(
      new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))
    );

    const created: Customer = {
      id: `cu-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      initials: buildCustomerInitials(cleanName),
      email: cleanEmail,
      phone: cleanPhone,
      cpf: cleanCpf,
      city: input.city?.trim() || 'São Paulo, SP',
      status: input.status,
      segment: input.segment,
      tags: cleanTags,
      since: REFERENCE_TODAY,
      createdAt: REFERENCE_TODAY,
      preferredContact: input.preferredContact ?? 'WhatsApp',
      ownedModelIds: [...(input.ownedModelIds ?? [])],
      notes: [],
      activities: [
        {
          id: `act-${Date.now()}`,
          type: 'profile',
          title: 'Cliente cadastrado no CRM',
          detail: `Segmento ${input.segment} · Status ${input.status}`,
          timestamp: new Date().toISOString(),
          actor,
        },
      ],
    };

    this.state = {
      ...this.state,
      customers: [created, ...this.state.customers],
    };

    this.appendAudit({
      actor,
      actorRole,
      actionType: 'CREATE_CUSTOMER',
      actionLabel: 'Cadastro de cliente',
      targetLabel: created.name,
      detail: `${created.segment} · Status: ${created.status}`,
      resourceType: 'CUSTOMER',
      resourceId: created.id,
    });

    this.notify();
    return created;
  }

  /**
   * Updates an existing CRM customer profile and logs the edit to Audit Log.
   */
  updateCustomer(customerId: string, input: UpdateCustomerInput): Customer {
    const existing = this.state.customers.find((c) => c.id === customerId);
    if (!existing) throw new Error('Cliente não encontrado.');

    const cleanName = input.name.trim();
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanPhone = input.phone.trim();
    const cleanCpf = input.cpf.trim();

    if (!cleanName) throw new Error('Informe o nome completo do cliente.');
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Informe um e-mail válido para o cliente.');
    }
    if (cleanDigits(cleanPhone).length < 10) {
      throw new Error('Informe um telefone/WhatsApp válido com DDD.');
    }
    if (cleanDigits(cleanCpf).length !== 11) {
      throw new Error('Informe um CPF válido com 11 dígitos.');
    }
    if (
      this.state.customers.some(
        (c) => c.id !== customerId && c.email.toLowerCase() === cleanEmail
      )
    ) {
      throw new Error('Outro cliente já utiliza este e-mail.');
    }

    const actor = input.actorName ?? 'Thiago Vasconcelos';
    const actorRole = input.actorRole ?? 'ADMIN';
    const cleanTags = Array.from(
      new Set((input.tags ?? existing.tags).map((t) => t.trim()).filter(Boolean))
    );

    const updated: Customer = {
      ...existing,
      name: cleanName,
      initials: buildCustomerInitials(cleanName),
      email: cleanEmail,
      phone: cleanPhone,
      cpf: cleanCpf,
      city: input.city?.trim() || existing.city,
      status: input.status,
      segment: input.segment,
      preferredContact: input.preferredContact ?? existing.preferredContact,
      tags: cleanTags,
      ownedModelIds: input.ownedModelIds ?? existing.ownedModelIds,
    };

    this.state = {
      ...this.state,
      customers: this.state.customers.map((c) => (c.id === customerId ? updated : c)),
    };

    this.appendCustomerActivity(customerId, {
      type: 'profile',
      title: 'Cadastro do cliente atualizado',
      detail: `${updated.segment} · Status ${updated.status}`,
      actor,
    });

    this.appendAudit({
      actor,
      actorRole,
      actionType: 'UPDATE_CUSTOMER',
      actionLabel: 'Edição de cliente',
      targetLabel: updated.name,
      detail: `${updated.segment} · Status: ${updated.status}`,
      resourceType: 'CUSTOMER',
      resourceId: updated.id,
    });

    this.notify();
    return this.state.customers.find((c) => c.id === customerId) ?? updated;
  }

  addCustomerTag(customerId: string, rawTag: string, actor = 'Thiago Vasconcelos'): void {
    const clean = rawTag.trim();
    if (!clean) return;
    const customer = this.state.customers.find((c) => c.id === customerId);
    if (!customer) return;
    if (customer.tags.some((t) => t.toLowerCase() === clean.toLowerCase())) return;

    this.state = {
      ...this.state,
      customers: this.state.customers.map((c) =>
        c.id === customerId ? { ...c, tags: [...c.tags, clean] } : c
      ),
    };

    this.appendCustomerActivity(customerId, {
      type: 'profile',
      title: `Tag "${clean}" adicionada`,
      actor,
    });

    this.notify();
  }

  removeCustomerTag(customerId: string, tagToRemove: string): void {
    this.state = {
      ...this.state,
      customers: this.state.customers.map((c) =>
        c.id === customerId
          ? { ...c, tags: c.tags.filter((t) => t !== tagToRemove) }
          : c
      ),
    };
    this.notify();
  }

  /**
   * Cross-references a customer's owned models + purchased items with in-stock secondary items.
   */
  getCompatibleAccessoriesForCustomer(customerId: string): Accessory[] {
    const customer = this.state.customers.find((c) => c.id === customerId);
    if (!customer) return [];

    const modelIds = new Set<string>(customer.ownedModelIds);
    const orders = this.getOrdersForCustomer(customerId);
    orders.forEach((order) => {
      if (order.smartphoneId) {
        const phone = this.state.smartphones.find((s) => s.id === order.smartphoneId);
        if (phone) modelIds.add(phone.modelId);
      }
    });

    return this.state.accessories.filter(
      (acc) => acc.stock > 0 && acc.compatibleModelIds.some((id) => modelIds.has(id))
    );
  }

  /**
   * Safe public warranty lookup for QR Code customer page.
   * Strictly omits CPF, phone, email, and cost price.
   */
  getPublicWarrantyByToken(publicToken: string): PublicWarrantyViewData | null {
    const order = this.state.orders.find((o) => o.publicToken === publicToken);
    if (!order) return null;

    const template = this.getActiveTemplate();
    const daysRemaining = Math.max(
      0,
      getDaysRemaining(order.warrantyExpiresAt, REFERENCE_TODAY)
    );
    const percentRemaining = getWarrantyPercentRemaining(
      order.warrantyDays,
      order.warrantyExpiresAt,
      REFERENCE_TODAY
    );

    const snap = order.smartphoneSnapshot;
    const imeiDigits = snap ? cleanDigits(snap.imei1) : '';

    return {
      publicToken: order.publicToken,
      orderCode: order.code,
      deviceBrand: snap?.brand ?? template.storeName,
      deviceModel: snap?.model ?? `${template.labels.secondaryTabName} ${template.storeName}`,
      deviceStorage: snap?.storage ?? '',
      deviceColor: snap?.color ?? '',
      deviceCondition: snap?.condition ?? template.labels.secondaryTabName,
      imeiLast4: imeiDigits.length >= 4 ? imeiDigits.slice(-4) : '—',
      issuedAt: order.issuedAt,
      warrantyExpiresAt: order.warrantyExpiresAt,
      warrantyDays: order.warrantyDays,
      daysRemaining,
      percentRemaining,
      checklist: snap ? snap.checklist.map((c) => ({ ...c })) : [],
      accessoriesSummary: order.accessories.map((a) => `${a.quantity}× ${a.name}`),
    };
  }

  /**
   * Registers a new primary catalog item.
   * Enforces Luhn IMEI validation when `template.features.hasSerializedItems` is active;
   * supports dynamic JSONB `customAttributes` & `expiresAt` for all other store templates.
   */
  createSmartphone(input: CreateSmartphoneInput): Smartphone {
    const template = this.getActiveTemplate();
    const requiresImei =
      templateRequiresImeiLuhn(template) ||
      (typeof input.imei1 === 'string' && cleanDigits(input.imei1).length > 0);

    let cleanedImei1 = '';
    let cleanedImei2: string | undefined;

    if (requiresImei) {
      const imei1Check = validateIMEI(input.imei1);
      if (!imei1Check.valid) {
        throw new Error(imei1Check.reason ?? 'IMEI 1 inválido.');
      }
      cleanedImei1 = imei1Check.cleaned;

      if (input.imei2 && cleanDigits(input.imei2).length > 0) {
        const imei2Check = validateIMEI(input.imei2);
        if (!imei2Check.valid) {
          throw new Error(`IMEI 2: ${imei2Check.reason ?? 'inválido.'}`);
        }
        cleanedImei2 = imei2Check.cleaned;
      }

      const duplicate = this.state.smartphones.some((s) => s.imei1 === cleanedImei1);
      if (duplicate) {
        throw new Error('Já existe um aparelho cadastrado com este IMEI 1.');
      }
    }

    if (!input.model.trim()) {
      throw new Error(`Informe o nome do ${template.labels.primaryItemSingular.toLowerCase()}.`);
    }

    const id = `sp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const prefix = (input.brand || template.storeName || 'IT').slice(0, 3).toUpperCase();
    const modelCode = input.model
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase();
    const suffix = input.storage.trim()
      ? input.storage.replace(/\s+/g, '').slice(0, 6).toUpperCase()
      : String(Date.now()).slice(-3);
    const sku = `${prefix}-${modelCode || 'ITEM'}-${suffix}`;

    const resolvedStatus: SmartphoneStatus =
      input.initialStatus ??
      (input.origin === 'Troca de Cliente (Trade-in)' &&
      input.condition.toLowerCase().includes('avaliação')
        ? 'Em Avaliação'
        : 'Disponível');

    const resolvedModelId = input.modelId?.trim() || slugifyId(input.model) || id;

    // Ensure non-serialized items also exist in deviceModels for cross-sell matching
    if (!this.state.deviceModels.some((m) => m.id === resolvedModelId)) {
      this.state = {
        ...this.state,
        deviceModels: [
          {
            id: resolvedModelId,
            brand: input.brand.trim() || template.storeName,
            name: input.model.trim(),
            tagLabel: input.model.trim(),
            storages: input.storage ? [input.storage.trim()] : [],
            colors: input.color ? [input.color.trim()] : [],
          },
          ...this.state.deviceModels,
        ],
      };
    }

    const supportsStockQty = !template.features.hasSerializedItems;
    const resolvedStockQty = supportsStockQty
      ? typeof input.stockQty === 'number' && !Number.isNaN(input.stockQty)
        ? Math.max(0, Number(input.stockQty.toFixed(2)))
        : 1
      : undefined;
    const resolvedStockUnit = supportsStockQty
      ? input.stockUnit?.trim() || 'un.'
      : undefined;

    const created: Smartphone = {
      id,
      sku,
      modelId: resolvedModelId,
      brand: input.brand.trim() || template.storeName,
      model: input.model.trim(),
      storage: input.storage.trim(),
      ram: input.ram?.trim() || undefined,
      color: input.color.trim(),
      condition: input.condition.trim() || 'Ativo',
      batteryHealth: Math.min(100, Math.max(50, Math.round(input.batteryHealth || 100))),
      batteryCycles:
        typeof input.batteryCycles === 'number' && !Number.isNaN(input.batteryCycles)
          ? Math.max(0, Math.round(input.batteryCycles))
          : undefined,
      origin: input.origin,
      tradeInCustomerId:
        input.origin === 'Troca de Cliente (Trade-in)'
          ? input.tradeInCustomerId
          : undefined,
      imei1: cleanedImei1,
      imei2: cleanedImei2,
      serialNumber:
        input.serialNumber.trim().toUpperCase() ||
        `LOT-${String(Date.now()).slice(-5)}`,
      costPrice: Number(input.costPrice) || 0,
      salePrice: Number(input.salePrice),
      stockQty: resolvedStockQty,
      stockUnit: resolvedStockUnit,
      status: resolvedStatus,
      checklist: input.checklist.map((item) => ({ ...item })),
      acquiredAt: REFERENCE_TODAY,
      expiresAt: input.expiresAt?.trim() || undefined,
      customAttributes: input.customAttributes ? { ...input.customAttributes } : undefined,
      notes: input.notes?.trim() || undefined,
    };

    const actor = input.actorName ?? 'Thiago Vasconcelos';
    const actorRole = input.actorRole ?? 'ADMIN';
    const tradeInCustomer = created.tradeInCustomerId
      ? this.state.customers.find((c) => c.id === created.tradeInCustomerId)
      : undefined;

    this.state = {
      ...this.state,
      smartphones: [created, ...this.state.smartphones],
    };

    const initialQty = created.stockQty ?? 1;
    const unitLabel = created.stockUnit ?? 'un.';

    this.appendAudit({
      actor,
      actorRole,
      actionType: 'CREATE_SMARTPHONE',
      actionLabel:
        created.origin === 'Troca de Cliente (Trade-in)'
          ? 'Entrada via Trade-in'
          : `Cadastro de ${template.labels.primaryItemSingular.toLowerCase()}`,
      targetLabel: `${created.brand} ${created.model}${created.storage ? ` · ${created.storage}` : ''}`,
      detail: supportsStockQty
        ? `${created.sku} · ${initialQty} ${unitLabel} · ${formatCurrencyBRL(created.salePrice)} · Status: ${created.status}`
        : `${created.sku} · ${formatCurrencyBRL(created.salePrice)} · Status: ${created.status}`,
      resourceType: 'SMARTPHONE',
      resourceId: created.id,
    });

    if (initialQty > 0) {
      this.appendLedger({
        actor,
        itemType: 'Aparelho',
        itemId: created.id,
        itemLabel: `${created.brand} ${created.model}${created.storage ? ` · ${created.storage}` : ''}`,
        sku: created.sku,
        delta: initialQty,
        resultingStock: initialQty,
        reason: created.origin === 'Troca de Cliente (Trade-in)' ? 'Trade-in' : 'Entrada',
        note: tradeInCustomer
          ? `Troca vinculada ao cliente ${tradeInCustomer.name}`
          : supportsStockQty
            ? `Saldo inicial (${initialQty} ${unitLabel})`
            : `Origem: ${created.origin}`,
      });
    }

    if (tradeInCustomer) {
      this.appendCustomerActivity(tradeInCustomer.id, {
        type: 'tradein',
        title: `Trade-in recebido: ${created.brand} ${created.model}`,
        detail: `${created.storage} · Status: ${created.status}`,
        actor,
      });
    }

    this.notify();
    return created;
  }

  /**
   * Registers a new batch/SKU secondary item with Audit & Stock Ledger entries.
   */
  createAccessory(input: CreateAccessoryInput): Accessory {
    const template = this.getActiveTemplate();
    const cleanSku = input.sku.trim().toUpperCase();
    if (!cleanSku) throw new Error('Informe o código SKU do item.');
    if (!input.name.trim()) throw new Error('Informe o nome do produto.');

    const requiresStrictCompat =
      template.features.hasCompatibilityCrossSell &&
      templateRequiresImeiLuhn(template) &&
      this.state.deviceModels.length > 0;

    const compatIds =
      input.compatibleModelIds.length > 0
        ? [...input.compatibleModelIds]
        : requiresStrictCompat
          ? []
          : ['usb-c-universal'];

    if (compatIds.length === 0) {
      throw new Error('Selecione ao menos um item compatível.');
    }
    if (this.state.accessories.some((a) => a.sku.toUpperCase() === cleanSku)) {
      throw new Error(`O SKU ${cleanSku} já está cadastrado no estoque.`);
    }

    const created: Accessory = {
      id: `ac-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sku: cleanSku,
      name: input.name.trim(),
      brand: input.brand?.trim() || undefined,
      ean: input.ean?.trim() || undefined,
      category: input.category.trim(),
      compatibleModelIds: compatIds,
      stock: Math.max(0, Math.round(input.stock)),
      minStock: Math.max(1, Math.round(input.minStock)),
      costPrice: Number(input.costPrice) || 0,
      price: Number(input.price),
      soldThisMonth: 0,
      expiresAt: input.expiresAt?.trim() || undefined,
      customAttributes: input.customAttributes ? { ...input.customAttributes } : undefined,
    };

    const actor = input.actorName ?? 'Thiago Vasconcelos';
    const actorRole = input.actorRole ?? 'ADMIN';

    this.state = {
      ...this.state,
      accessories: [created, ...this.state.accessories],
    };

    this.appendAudit({
      actor,
      actorRole,
      actionType: 'CREATE_ACCESSORY',
      actionLabel: `Cadastro de ${template.labels.secondaryItemSingular.toLowerCase()}`,
      targetLabel: `${created.name} (${created.sku})`,
      detail: `${created.category} · ${created.stock} un. · ${formatCurrencyBRL(created.price)}`,
      resourceType: 'ACCESSORY',
      resourceId: created.id,
    });

    if (created.stock > 0) {
      this.appendLedger({
        actor,
        itemType: 'Acessório',
        itemId: created.id,
        itemLabel: created.name,
        sku: created.sku,
        delta: created.stock,
        resultingStock: created.stock,
        reason: 'Entrada',
        note: 'Saldo inicial de cadastro',
      });
    }

    this.notify();
    return created;
  }

  updateSmartphonePrice(
    smartphoneId: string,
    newSalePrice: number,
    actor = 'Thiago Vasconcelos',
    actorRole: UserRole = 'ADMIN'
  ): void {
    const target = this.state.smartphones.find((s) => s.id === smartphoneId);
    if (!target || newSalePrice <= 0) return;
    const oldPrice = target.salePrice;
    if (oldPrice === newSalePrice) return;

    this.state = {
      ...this.state,
      smartphones: this.state.smartphones.map((sp) =>
        sp.id === smartphoneId ? { ...sp, salePrice: newSalePrice } : sp
      ),
    };

    this.appendAudit({
      actor,
      actorRole,
      actionType: 'UPDATE_PRICE',
      actionLabel: 'Alteração de preço',
      targetLabel: `${target.model} (${target.sku})`,
      detail: `${formatCurrencyBRL(oldPrice)} → ${formatCurrencyBRL(newSalePrice)}`,
      resourceType: 'SMARTPHONE',
      resourceId: smartphoneId,
    });

    this.notify();
  }

  updateSmartphonesStatus(
    ids: string[],
    status: SmartphoneStatus,
    actor = 'Thiago Vasconcelos',
    actorRole: UserRole = 'ADMIN'
  ): void {
    const idSet = new Set(ids);
    const affected = this.state.smartphones.filter((s) => idSet.has(s.id));
    this.state = {
      ...this.state,
      smartphones: this.state.smartphones.map((sp) =>
        idSet.has(sp.id) ? { ...sp, status } : sp
      ),
    };

    if (affected.length > 0) {
      this.appendAudit({
        actor,
        actorRole,
        actionType: 'UPDATE_STATUS',
        actionLabel: 'Alteração de status em lote',
        targetLabel:
          affected.length === 1
            ? `${affected[0].model} (${affected[0].sku})`
            : `${affected.length} itens`,
        detail: `Novo status: ${status}`,
        resourceType: 'SMARTPHONE',
        resourceId: affected[0].id,
      });
    }

    this.notify();
  }

  updateSmartphoneChecklistItem(
    smartphoneId: string,
    itemId: string,
    checked: boolean
  ): void {
    this.state = {
      ...this.state,
      smartphones: this.state.smartphones.map((sp) =>
        sp.id === smartphoneId
          ? {
              ...sp,
              checklist: sp.checklist.map((c) =>
                c.id === itemId ? { ...c, checked } : c
              ),
            }
          : sp
      ),
    };
    this.notify();
  }

  /**
   * Replenishes stock quantity for one or more non-serialized primary catalog items,
   * optionally setting their status to 'Disponível', and logs entries in both
   * the Stock Ledger and Audit Log.
   */
  restockSmartphones(
    ids: string[],
    delta: number,
    opts?: {
      setAvailable?: boolean;
      actorName?: string;
      actorRole?: UserRole;
    }
  ): void {
    const cleanDelta = Number(Number(delta).toFixed(2));
    if (!Number.isFinite(cleanDelta) || cleanDelta <= 0 || ids.length === 0) {
      return;
    }

    const idSet = new Set(ids);
    const affected = this.state.smartphones.filter((s) => idSet.has(s.id));
    if (affected.length === 0) return;

    const setAvailable = opts?.setAvailable ?? false;
    const actor = opts?.actorName ?? 'Thiago Vasconcelos';
    const actorRole = opts?.actorRole ?? 'ADMIN';

    const updatedMap = new Map<string, Smartphone>();
    this.state = {
      ...this.state,
      smartphones: this.state.smartphones.map((sp) => {
        if (!idSet.has(sp.id)) return sp;
        const currentQty = typeof sp.stockQty === 'number' ? sp.stockQty : 1;
        const nextQty = Number((currentQty + cleanDelta).toFixed(2));
        const nextSp: Smartphone = {
          ...sp,
          stockQty: nextQty,
          stockUnit: sp.stockUnit || 'un.',
          status: setAvailable ? 'Disponível' : sp.status,
        };
        updatedMap.set(sp.id, nextSp);
        return nextSp;
      }),
    };

    for (const sp of affected) {
      const updated = updatedMap.get(sp.id);
      if (!updated) continue;
      const unit = updated.stockUnit || 'un.';
      const resultingStock = updated.stockQty ?? 1;

      this.appendLedger({
        actor,
        itemType: 'Aparelho',
        itemId: updated.id,
        itemLabel: `${updated.brand} ${updated.model}${updated.storage && updated.storage !== '—' ? ` · ${updated.storage}` : ''}`,
        sku: updated.sku,
        delta: cleanDelta,
        resultingStock,
        reason: 'Reposição',
        note: `+${cleanDelta} Reposição no Balcão`,
      });

      this.appendAudit({
        actor,
        actorRole,
        actionType: 'RESTOCK',
        actionLabel: 'Reposição de estoque',
        targetLabel: `${updated.model} (${updated.sku})`,
        detail: `+${cleanDelta} ${unit} (Reposição no Balcão) · Saldo: ${resultingStock} ${unit}${
          setAvailable ? ' · Status: Disponível' : ''
        }`,
        resourceType: 'SMARTPHONE',
        resourceId: updated.id,
      });
    }

    this.notify();
  }

  restockAccessory(
    accessoryId: string,
    delta: number,
    actor = 'Thiago Vasconcelos',
    actorRole: UserRole = 'ADMIN'
  ): void {
    const target = this.state.accessories.find((a) => a.id === accessoryId);
    if (!target || delta === 0) return;

    const resultingStock = Math.max(0, target.stock + delta);
    this.state = {
      ...this.state,
      accessories: this.state.accessories.map((acc) =>
        acc.id === accessoryId ? { ...acc, stock: resultingStock } : acc
      ),
    };

    this.appendAudit({
      actor,
      actorRole,
      actionType: 'RESTOCK',
      actionLabel: delta > 0 ? 'Reposição de estoque' : 'Ajuste de estoque',
      targetLabel: `${target.name} (${target.sku})`,
      detail: `${delta > 0 ? `+${delta}` : delta} un. (Reposição no Balcão · saldo: ${resultingStock} un.)`,
      resourceType: 'ACCESSORY',
      resourceId: accessoryId,
    });

    this.appendLedger({
      actor,
      itemType: 'Acessório',
      itemId: target.id,
      itemLabel: target.name,
      sku: target.sku,
      delta,
      resultingStock,
      reason: delta > 0 ? 'Reposição' : 'Ajuste',
      note: delta > 0 ? `+${delta} Reposição no Balcão` : 'Atualização direta pelo balcão',
    });

    this.notify();
  }

  restockAccessories(
    ids: string[],
    delta: number,
    actor = 'Thiago Vasconcelos',
    actorRole: UserRole = 'ADMIN'
  ): void {
    const cleanDelta = Math.round(Number(delta));
    if (!Number.isFinite(cleanDelta) || cleanDelta <= 0 || ids.length === 0) return;
    ids.forEach((id) => this.restockAccessory(id, cleanDelta, actor, actorRole));
  }

  addCustomerNote(
    customerId: string,
    content: string,
    author = 'Thiago Vasconcelos'
  ): void {
    const trimmed = content.trim();
    if (!trimmed) return;
    this.state = {
      ...this.state,
      customers: this.state.customers.map((c) =>
        c.id === customerId
          ? {
              ...c,
              notes: [
                {
                  id: `note-${Date.now()}`,
                  author,
                  createdAt: REFERENCE_TODAY,
                  content: trimmed,
                },
                ...c.notes,
              ],
            }
          : c
      ),
    };
    this.appendCustomerActivity(customerId, {
      type: 'note',
      title: 'Nova nota interna adicionada',
      detail: trimmed.length > 72 ? `${trimmed.slice(0, 72)}…` : trimmed,
      actor: author,
    });

    this.notify();
  }

  /**
   * Executes counter checkout: marks serialized items as Sold (keeping non-serialized catalog items available),
   * decrements secondary stocks, appends immutable Stock Ledger + Audit Log, and emits Order.
   */
  createOrder(input: CreateOrderInput): Order {
    const template = this.getActiveTemplate();
    const customer = this.state.customers.find((c) => c.id === input.customerId);
    if (!customer) throw new Error('Selecione um cliente válido.');

    let smartphone: Smartphone | undefined;
    if (input.smartphoneId) {
      smartphone = this.state.smartphones.find((s) => s.id === input.smartphoneId);
      if (!smartphone) throw new Error('Item não encontrado.');
      if (template.features.hasSerializedItems && smartphone.status === 'Vendido') {
        throw new Error('Este aparelho já consta como vendido no estoque.');
      }
    }

    if (!smartphone && input.accessoryItems.length === 0) {
      throw new Error(
        `Selecione ao menos um ${template.labels.primaryItemSingular.toLowerCase()} ou ${template.labels.secondaryItemSingular.toLowerCase()} para confirmar.`
      );
    }

    const accessoryLines: OrderAccessoryLine[] = [];
    for (const item of input.accessoryItems) {
      if (item.quantity <= 0) continue;
      const acc = this.state.accessories.find((a) => a.id === item.accessoryId);
      if (!acc) throw new Error('Item complementar não encontrado.');
      if (acc.stock < item.quantity) {
        throw new Error(
          `Estoque insuficiente para ${acc.name} (disponível: ${acc.stock}).`
        );
      }
      accessoryLines.push({
        accessoryId: acc.id,
        sku: acc.sku,
        name: acc.name,
        quantity: item.quantity,
        unitPrice: acc.price,
      });
    }

    const accessoriesTotal = accessoryLines.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0
    );
    const totalAmount = (smartphone?.salePrice ?? 0) + accessoriesTotal;
    const issuedAt = REFERENCE_TODAY;
    const warrantyExpiresAt = template.features.hasWarrantyQr
      ? addDaysISO(issuedAt, input.warrantyDays)
      : issuedAt;
    const nextNumber = 152 + this.state.orders.length;
    const sellerName = input.sellerName ?? 'Thiago Vasconcelos';
    const actorRole = input.actorRole ?? 'ADMIN';
    const orderPrefix =
      template.id === AURACELL_TEMPLATE.id
        ? 'AC'
        : buildStoreOrderPrefix(template.storeName);

    const order: Order = {
      id: `ord-${Date.now()}`,
      code: `${orderPrefix}-2026-0${nextNumber}`,
      publicToken: generateWarrantyUuid(),
      customerId: customer.id,
      smartphoneId: smartphone?.id,
      smartphoneSnapshot: smartphone
        ? {
            brand: smartphone.brand,
            model: smartphone.model,
            storage: smartphone.storage,
            color: smartphone.color,
            condition: smartphone.condition,
            batteryHealth: smartphone.batteryHealth,
            imei1: smartphone.imei1,
            imei2: smartphone.imei2,
            serialNumber: smartphone.serialNumber,
            checklist: smartphone.checklist.map((c) => ({ ...c })),
            unitPrice: smartphone.salePrice,
          }
        : undefined,
      accessories: accessoryLines,
      totalAmount,
      paymentMethod: input.paymentMethod,
      warrantyDays: input.warrantyDays,
      issuedAt,
      warrantyExpiresAt,
      sellerName,
    };

    const nextSmartphones = smartphone
      ? this.state.smartphones.map((sp) => {
          if (sp.id !== smartphone!.id) return sp;
          if (template.features.hasSerializedItems) {
            return { ...sp, status: 'Vendido' as SmartphoneStatus };
          }
          if (typeof sp.stockQty === 'number') {
            return {
              ...sp,
              stockQty: Math.max(0, Number((sp.stockQty - 1).toFixed(2))),
            };
          }
          return sp;
        })
      : this.state.smartphones;

    const qtyByAccId = new Map(accessoryLines.map((l) => [l.accessoryId, l.quantity]));
    const nextAccessories = this.state.accessories.map((acc) => {
      const dec = qtyByAccId.get(acc.id);
      if (!dec) return acc;
      return {
        ...acc,
        stock: Math.max(0, acc.stock - dec),
        soldThisMonth: acc.soldThisMonth + dec,
      };
    });

    const nextCustomers = smartphone
      ? this.state.customers.map((c) =>
          c.id === customer.id && !c.ownedModelIds.includes(smartphone!.modelId)
            ? { ...c, ownedModelIds: [smartphone!.modelId, ...c.ownedModelIds] }
            : c
        )
      : this.state.customers;

    const totalAccQty = accessoryLines.reduce((sum, l) => sum + l.quantity, 0);
    const nextWeekly = this.state.weeklyMovement.map((point, idx, arr) =>
      idx === arr.length - 1
        ? {
            ...point,
            aparelhos: point.aparelhos + (smartphone ? 1 : 0),
            acessorios: point.acessorios + totalAccQty,
            revenue: point.revenue + totalAmount,
          }
        : point
    );

    this.state = {
      ...this.state,
      smartphones: nextSmartphones,
      accessories: nextAccessories,
      customers: nextCustomers,
      orders: [order, ...this.state.orders],
      weeklyMovement: nextWeekly,
    };

    if (smartphone) {
      const updatedPrimary = nextSmartphones.find((s) => s.id === smartphone!.id);
      this.appendLedger({
        actor: sellerName,
        itemType: 'Aparelho',
        itemId: smartphone.id,
        itemLabel: `${smartphone.brand} ${smartphone.model}${smartphone.storage ? ` · ${smartphone.storage}` : ''}`,
        sku: smartphone.sku,
        delta: -1,
        resultingStock: template.features.hasSerializedItems
          ? 0
          : updatedPrimary?.stockQty ?? 1,
        reason: 'Saída / Venda',
        note: `Pedido ${order.code} · Cliente ${customer.name}`,
      });
    }

    for (const line of accessoryLines) {
      const updatedAcc = nextAccessories.find((a) => a.id === line.accessoryId);
      this.appendLedger({
        actor: sellerName,
        itemType: 'Acessório',
        itemId: line.accessoryId,
        itemLabel: line.name,
        sku: line.sku,
        delta: -line.quantity,
        resultingStock: updatedAcc?.stock ?? 0,
        reason: 'Saída / Venda',
        note: `Pedido ${order.code} · Cliente ${customer.name}`,
      });
    }

    this.appendAudit({
      actor: sellerName,
      actorRole,
      actionType: 'CREATE_ORDER',
      actionLabel: template.features.hasWarrantyQr
        ? 'Saída & Termo de Garantia'
        : 'Pedido concluído no balcão',
      targetLabel: `${order.code} · ${customer.name}`,
      detail: template.features.hasWarrantyQr
        ? `${formatCurrencyBRL(order.totalAmount)} · Garantia ${order.warrantyDays} dias`
        : `${formatCurrencyBRL(order.totalAmount)} · ${order.paymentMethod}`,
      resourceType: 'ORDER',
      resourceId: order.id,
    });

    this.appendCustomerActivity(customer.id, {
      type: smartphone ? 'sale' : 'accessory',
      title: smartphone
        ? `Pedido registrado: ${smartphone.model}`
        : `Compra de ${template.labels.secondaryTabName.toLowerCase()} registrada`,
      detail: template.features.hasWarrantyQr
        ? `Pedido ${order.code} · ${formatCurrencyBRL(order.totalAmount)} · Garantia ${order.warrantyDays}d`
        : `Pedido ${order.code} · ${formatCurrencyBRL(order.totalAmount)}`,
      actor: sellerName,
    });

    this.notify();

    if (typeof window !== 'undefined') {
      const idempotencyKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      apiRequest('/api/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          customerId: input.customerId,
          primaryItemId: input.smartphoneId,
          accessoryItems: input.accessoryItems,
          warrantyDays: input.warrantyDays,
          paymentMethod: input.paymentMethod,
          sellerName,
        }),
      }).catch(() => {});
    }

    return order;
  }

  getDashboardSummary(): DashboardSummary {
    const availableSmartphones = this.state.smartphones.filter(
      (s) => s.status === 'Disponível'
    ).length;
    const reservedSmartphones = this.state.smartphones.filter(
      (s) => s.status === 'Reservado'
    ).length;
    const evaluatingSmartphones = this.state.smartphones.filter(
      (s) => s.status === 'Em Avaliação'
    ).length;
    const lowStockAccessories = this.state.accessories.filter(
      (a) => a.stock <= a.minStock
    ).length;
    const totalAccessoryUnits = this.state.accessories.reduce(
      (sum, a) => sum + a.stock,
      0
    );

    const activeOrdersWithWarranty = this.state.orders.filter(
      (o) => getDaysRemaining(o.warrantyExpiresAt, REFERENCE_TODAY) > 0
    );
    const expiringWarrantiesCount = activeOrdersWithWarranty.filter(
      (o) => getDaysRemaining(o.warrantyExpiresAt, REFERENCE_TODAY) <= 15
    ).length;

    const expiringPrimary = this.state.smartphones.filter(
      (s) =>
        s.status !== 'Vendido' &&
        Boolean(s.expiresAt) &&
        getDaysRemaining(s.expiresAt!, REFERENCE_TODAY) <= 7
    ).length;
    const expiringSecondary = this.state.accessories.filter(
      (a) =>
        a.stock > 0 &&
        Boolean(a.expiresAt) &&
        getDaysRemaining(a.expiresAt!, REFERENCE_TODAY) <= 7
    ).length;
    const expiringBatchesCount = expiringPrimary + expiringSecondary;

    const weeklyOutputs = this.state.weeklyMovement.reduce(
      (sum, d) => sum + d.aparelhos,
      0
    );
    const weeklyRevenue = this.state.weeklyMovement.reduce(
      (sum, d) => sum + d.revenue,
      0
    );

    const customerCounts = {
      total: this.state.customers.length,
      active: this.state.customers.filter((c) => c.status === 'ATIVO').length,
      lead: this.state.customers.filter((c) => c.status === 'LEAD').length,
      inactive: this.state.customers.filter((c) => c.status === 'INATIVO').length,
    };

    return {
      availableSmartphones,
      reservedSmartphones,
      evaluatingSmartphones,
      lowStockAccessories,
      totalAccessoryUnits,
      activeWarranties: activeOrdersWithWarranty.length,
      expiringWarrantiesCount,
      expiringBatchesCount,
      weeklyOutputs,
      weeklyRevenue,
      customerCounts,
    };
  }
}

export const crmService = new AuraCellService();

/**
 * Generates and downloads a UTF-8 CSV file in the browser.
 */
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [
      headers.map(escapeCell).join(','),
      ...rows.map((r) => r.map(escapeCell).join(',')),
    ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
