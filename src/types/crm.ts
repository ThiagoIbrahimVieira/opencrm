import { UserRole } from './auth';

export type DeviceCondition = string;

export type SmartphoneStatus = 'Disponível' | 'Reservado' | 'Vendido' | 'Em Avaliação';

export type DeviceOrigin =
  | 'Fornecedor'
  | 'Troca de Cliente (Trade-in)'
  | 'Compra Direta';

export type AccessoryCategory = string;

export type WarrantyDurationDays = 90 | 180 | 365;

export type PaymentMethod = 'PIX' | 'Cartão de Crédito' | 'Débito' | 'Dinheiro';

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface DeviceModel {
  id: string;
  brand: string;
  name: string;
  tagLabel: string;
  storages: string[];
  colors: string[];
}

export interface Smartphone {
  id: string;
  sku: string;
  modelId: string;
  brand: string;
  model: string;
  storage: string;
  ram?: string;
  color: string;
  condition: DeviceCondition;
  batteryHealth: number; // 0-100
  batteryCycles?: number;
  origin: DeviceOrigin;
  tradeInCustomerId?: string;
  imei1: string;
  imei2?: string;
  serialNumber: string;
  costPrice: number;
  salePrice: number;
  stockQty?: number;
  stockUnit?: string;
  status: SmartphoneStatus;
  checklist: ChecklistItem[];
  acquiredAt: string; // ISO date YYYY-MM-DD
  expiresAt?: string; // Optional batch expiration ISO date (when hasExpirationDate is ON)
  customAttributes?: Record<string, unknown>; // PostgreSQL JSONB custom template attributes
  notes?: string;
}

export interface Accessory {
  id: string;
  sku: string;
  name: string;
  brand?: string;
  ean?: string;
  category: AccessoryCategory;
  compatibleModelIds: string[]; // links to DeviceModel.id
  stock: number;
  minStock: number;
  costPrice: number;
  price: number;
  soldThisMonth: number;
  expiresAt?: string; // Optional batch expiration ISO date
  customAttributes?: Record<string, unknown>; // PostgreSQL JSONB custom template attributes
}

export type CustomerStatus = 'ATIVO' | 'LEAD' | 'INATIVO';

export type CustomerSegment = 'Varejo' | 'VIP' | 'Corporativo' | 'Revenda';

export interface CustomerNote {
  id: string;
  author: string;
  createdAt: string; // ISO date string
  content: string;
}

export type CustomerActivityType =
  | 'sale'
  | 'warranty'
  | 'accessory'
  | 'audit'
  | 'tradein'
  | 'profile'
  | 'note';

export interface CustomerActivity {
  id: string;
  type: CustomerActivityType;
  title: string;
  detail?: string;
  timestamp: string; // ISO timestamp or YYYY-MM-DD
  actor?: string;
}

export interface Customer {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string; // e.g. "(11) 98412-3390"
  cpf: string; // e.g. "394.821.508-42"
  cpfLast4?: string;
  phoneLast4?: string;
  city: string;
  status: CustomerStatus;
  segment: CustomerSegment;
  tags: string[];
  since: string; // ISO date
  createdAt: string; // ISO date
  preferredContact: 'WhatsApp' | 'Ligação' | 'E-mail';
  ownedModelIds: string[];
  notes: CustomerNote[];
  activities: CustomerActivity[];
}

export interface CustomerSearchResult {
  id: string;
  name: string;
  phone: string;
  cpfLast4: string;
}

export interface OrderAccessoryLine {
  accessoryId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  code: string; // e.g. "AC-2026-0148"
  publicToken: string; // UUID for public QR code lookup
  customerId: string;
  smartphoneId?: string;
  smartphoneSnapshot?: {
    brand: string;
    model: string;
    storage: string;
    color: string;
    condition: DeviceCondition;
    batteryHealth: number;
    imei1: string;
    imei2?: string;
    serialNumber: string;
    checklist: ChecklistItem[];
    unitPrice: number;
  };
  accessories: OrderAccessoryLine[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  warrantyDays: WarrantyDurationDays;
  issuedAt: string; // ISO date YYYY-MM-DD
  warrantyExpiresAt: string; // ISO date YYYY-MM-DD
  sellerName: string;
}

export interface PublicWarrantyViewData {
  publicToken: string;
  orderCode: string;
  storeName?: string;
  deviceBrand: string;
  deviceModel: string;
  deviceStorage: string;
  deviceColor: string;
  deviceCondition: string;
  imeiLast4: string;
  issuedAt: string;
  warrantyExpiresAt: string;
  warrantyDays: number;
  daysRemaining: number;
  percentRemaining: number;
  checklist: ChecklistItem[];
  accessoriesSummary: string[];
}

export type AuditActionType =
  | 'REVEAL_IMEI'
  | 'REVEAL_PII'
  | 'CREATE_SMARTPHONE'
  | 'CREATE_ACCESSORY'
  | 'UPDATE_PRICE'
  | 'UPDATE_STATUS'
  | 'CREATE_ORDER'
  | 'RESTOCK'
  | 'TEAM_CHANGE'
  | 'AUTH_SWITCH'
  | 'CREATE_CUSTOMER'
  | 'UPDATE_CUSTOMER'
  | 'CREATE_STORE';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: UserRole;
  actionType: AuditActionType;
  actionLabel: string;
  targetLabel: string;
  detail?: string;
  resourceType?:
    | 'IMEI'
    | 'CPF'
    | 'PHONE'
    | 'SMARTPHONE'
    | 'ACCESSORY'
    | 'ORDER'
    | 'TEAM'
    | 'CUSTOMER';
  resourceId?: string;
}

export type StockLedgerReason =
  | 'Entrada'
  | 'Reposição'
  | 'Saída / Venda'
  | 'Trade-in'
  | 'Ajuste';

export interface StockLedgerEntry {
  id: string;
  timestamp: string;
  actor: string;
  itemType: 'Aparelho' | 'Acessório';
  itemId: string;
  itemLabel: string;
  sku: string;
  delta: number; // +5, -1, +1
  resultingStock: number;
  reason: StockLedgerReason;
  note?: string;
}

export interface WeeklyMovementPoint {
  day: string;
  aparelhos: number;
  acessorios: number;
  revenue: number;
}

export interface DynamicCatalog {
  brands: string[];
  storages: string[];
  ramOptions: string[];
  colors: string[];
  conditions: string[];
  accessoryCategories: string[];
}

export interface CreateSmartphoneInput {
  modelId: string;
  brand: string;
  model: string;
  storage: string;
  ram?: string;
  color: string;
  condition: DeviceCondition;
  batteryHealth: number;
  batteryCycles?: number;
  origin: DeviceOrigin;
  tradeInCustomerId?: string;
  initialStatus?: SmartphoneStatus;
  imei1: string;
  imei2?: string;
  serialNumber: string;
  costPrice: number;
  salePrice: number;
  stockQty?: number;
  stockUnit?: string;
  checklist: ChecklistItem[];
  expiresAt?: string;
  customAttributes?: Record<string, unknown>;
  notes?: string;
  actorName?: string;
  actorRole?: UserRole;
}

export interface CreateAccessoryInput {
  sku: string;
  name: string;
  brand?: string;
  ean?: string;
  category: AccessoryCategory;
  compatibleModelIds: string[];
  stock: number;
  minStock: number;
  costPrice?: number;
  price: number;
  expiresAt?: string;
  customAttributes?: Record<string, unknown>;
  actorName?: string;
  actorRole?: UserRole;
}

export interface CreateOrderInput {
  customerId: string;
  smartphoneId?: string;
  accessoryItems: { accessoryId: string; quantity: number }[];
  warrantyDays: WarrantyDurationDays;
  paymentMethod: PaymentMethod;
  sellerName?: string;
  actorRole?: UserRole;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  city?: string;
  status: CustomerStatus;
  segment: CustomerSegment;
  preferredContact?: 'WhatsApp' | 'Ligação' | 'E-mail';
  tags?: string[];
  ownedModelIds?: string[];
  actorName?: string;
  actorRole?: UserRole;
}

export interface UpdateCustomerInput {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  city?: string;
  status: CustomerStatus;
  segment: CustomerSegment;
  preferredContact?: 'WhatsApp' | 'Ligação' | 'E-mail';
  tags?: string[];
  ownedModelIds?: string[];
  actorName?: string;
  actorRole?: UserRole;
}

export type AppSection =
  | 'dashboard'
  | 'inventory'
  | 'customers'
  | 'checkout'
  | 'audit'
  | 'settings';
export type InventoryTab = 'smartphones' | 'accessories';
