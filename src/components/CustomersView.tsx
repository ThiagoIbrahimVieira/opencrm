import React from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  History,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Package,
  PackageCheck,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone as SmartphoneIcon,
  StickyNote,
  Tag,
  UserCheck,
  X,
} from 'lucide-react';
import {
  Accessory,
  CreateCustomerInput,
  Customer,
  CustomerActivityType,
  CustomerSegment,
  CustomerStatus,
  DeviceModel,
  Order,
  UpdateCustomerInput,
} from '../types/crm';
import { StoreTemplate } from '../types/template';
import { REFERENCE_TODAY } from '../data/mockData';
import {
  formatCurrencyBRL,
  formatDateBR,
  getDaysRemaining,
  getWarrantyPercentRemaining,
  maskCPF,
  maskIMEI,
  maskPhone,
} from '../utils/imei';
import {
  buildWhatsAppAccessoryUrl,
  buildWhatsAppDirectCustomerUrl,
  buildWhatsAppWarrantyUrl,
} from '../utils/qrAndWhatsapp';
import { AuraButton, StatusBadge } from './ui/AuraPrimitives';
import { CreatableSelect } from './ui/CreatableSelect';
import { CustomerModal } from './CustomerModal';

interface CustomersViewProps {
  template: StoreTemplate;
  customers: Customer[];
  orders: Order[];
  deviceModels: DeviceModel[];
  selectedCustomerId: string | null;
  onSelectCustomer: (customerId: string | null) => void;
  getCompatibleAccessories: (customerId: string) => Accessory[];
  onRevealSensitiveData: (customer: Customer) => void;
  onAddNote: (customerId: string, content: string) => void;
  onAddTag: (customerId: string, tag: string) => void;
  onRemoveTag: (customerId: string, tag: string) => void;
  onAddDeviceModel: (params: { name: string; brand?: string }) => DeviceModel;
  onCreateCustomer: (input: CreateCustomerInput) => Customer;
  onUpdateCustomer: (customerId: string, input: UpdateCustomerInput) => Customer;
  onOpenWarrantyDocument: (order: Order, customer: Customer) => void;
  onPreviewPublicWarranty: (publicToken: string) => void;
  onQuickSellAccessory: (customerId: string, accessoryId: string) => void;
  onStartCheckoutForCustomer: (customerId: string) => void;
}

type DetailTab =
  | 'overview'
  | 'devices'
  | 'warranties'
  | 'compatible'
  | 'notes'
  | 'documents'
  | 'activity';

type StatusFilter = 'TODOS' | CustomerStatus;
type SortOption = 'recent' | 'name-asc' | 'purchases-desc';

const ITEMS_PER_PAGE = 6;

const AVATAR_TONES = [
  'bg-[#4F5A47] text-[#F4F2EC]', // olive
  'bg-[#67735B] text-[#F4F2EC]', // moss
  'bg-[#8A775A] text-[#F4F2EC]', // dark sand
  'bg-[#7D5E45] text-[#F4F2EC]', // warm bronze
  'bg-[#5D6658] text-[#F4F2EC]', // sage slate
  'bg-[#746B5C] text-[#F4F2EC]', // taupe bronze
];

function getAvatarTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function getCustomerStatusMeta(status: CustomerStatus): {
  label: string;
  tone: 'olive' | 'amber' | 'stone';
} {
  switch (status) {
    case 'ATIVO':
      return { label: 'Ativo', tone: 'olive' };
    case 'LEAD':
      return { label: 'Lead', tone: 'amber' };
    case 'INATIVO':
      return { label: 'Inativo', tone: 'stone' };
  }
}

function formatRelativeDateBR(timestamp: string, referenceToday = REFERENCE_TODAY): string {
  const datePart = timestamp.slice(0, 10);
  const ref = new Date(`${referenceToday}T12:00:00Z`);
  const target = new Date(`${datePart}T12:00:00Z`);
  if (Number.isNaN(target.getTime())) return formatDateBR(datePart);

  const diffDays = Math.round((ref.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'hoje';
  if (diffDays === 1) return 'ontem';
  if (diffDays < 30) return `há ${diffDays} dias`;
  const months = Math.floor(diffDays / 30);
  if (months === 1) return 'há 1 mês';
  if (months < 12) return `há ${months} meses`;
  return formatDateBR(datePart);
}

function getActivityIcon(type: CustomerActivityType) {
  switch (type) {
    case 'sale':
      return ShoppingBag;
    case 'warranty':
      return ShieldCheck;
    case 'accessory':
      return Package;
    case 'audit':
      return Eye;
    case 'tradein':
      return RefreshCw;
    case 'note':
      return StickyNote;
    default:
      return UserCheck;
  }
}

export function CustomersView({
  template,
  customers,
  orders,
  deviceModels,
  selectedCustomerId,
  onSelectCustomer,
  getCompatibleAccessories,
  onRevealSensitiveData,
  onAddNote,
  onAddTag,
  onRemoveTag,
  onAddDeviceModel,
  onCreateCustomer,
  onUpdateCustomer,
  onOpenWarrantyDocument,
  onPreviewPublicWarranty,
  onQuickSellAccessory,
  onStartCheckoutForCustomer,
}: CustomersViewProps) {
  const { labels, features } = template;
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('TODOS');
  const [segmentFilter, setSegmentFilter] = React.useState<'TODOS' | CustomerSegment>('TODOS');
  const [onlyActiveWarranty, setOnlyActiveWarranty] = React.useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<SortOption>('recent');
  const [page, setPage] = React.useState(1);

  const [activeTab, setActiveTab] = React.useState<DetailTab>('overview');
  const [revealedCustomerPii, setRevealedCustomerPii] = React.useState<
    Record<string, boolean>
  >({});

  // Mobile Master-Detail navigation state (true = show detail sheet on < lg screens)
  const [mobileDetailOpen, setMobileDetailOpen] = React.useState<boolean>(() =>
    Boolean(selectedCustomerId)
  );

  // Inline note, tag & tab search inputs
  const [newNote, setNewNote] = React.useState('');
  const [addingTagInline, setAddingTagInline] = React.useState(false);
  const [inlineTagValue, setInlineTagValue] = React.useState('');
  const [devicesSearch, setDevicesSearch] = React.useState('');
  const [compatibleSearch, setCompatibleSearch] = React.useState('');

  // Row context menu ("...")
  const [openMenuCustomerId, setOpenMenuCustomerId] = React.useState<string | null>(null);

  // Create / Edit Customer modal
  const [customerModalOpen, setCustomerModalOpen] = React.useState(false);
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(null);

  const filterPopoverRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setActiveTab('overview');
    setSearchQuery('');
    setStatusFilter('TODOS');
    setSegmentFilter('TODOS');
    setOnlyActiveWarranty(false);
    setPage(1);
    setDevicesSearch('');
    setCompatibleSearch('');
  }, [template.id]);

  React.useEffect(() => {
    if (selectedCustomerId) {
      setMobileDetailOpen(true);
    }
  }, [selectedCustomerId]);

  React.useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(e.target as Node)
      ) {
        setFilterPopoverOpen(false);
      }
      setOpenMenuCustomerId(null);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const modelLabelMap = React.useMemo(
    () => new Map(deviceModels.map((m) => [m.id, m.tagLabel])),
    [deviceModels]
  );

  const ordersByCustomer = React.useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of orders) {
      const list = map.get(o.customerId) ?? [];
      list.push(o);
      map.set(o.customerId, list);
    }
    map.forEach((list) => list.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)));
    return map;
  }, [orders]);

  const filteredCustomers = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = customers.filter((c) => {
      if (statusFilter !== 'TODOS' && c.status !== statusFilter) return false;
      if (segmentFilter !== 'TODOS' && c.segment !== segmentFilter) return false;

      if (onlyActiveWarranty) {
        const cuOrders = ordersByCustomer.get(c.id) ?? [];
        const hasActive = cuOrders.some(
          (o) => getDaysRemaining(o.warrantyExpiresAt, REFERENCE_TODAY) > 0
        );
        if (!hasActive) return false;
      }

      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.segment.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        c.ownedModelIds.some((id) =>
          (modelLabelMap.get(id) ?? id).toLowerCase().includes(q)
        )
      );
    });

    const sorted = [...list];
    if (sortBy === 'name-asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    } else if (sortBy === 'purchases-desc') {
      sorted.sort((a, b) => {
        const countA = (ordersByCustomer.get(a.id) ?? []).length;
        const countB = (ordersByCustomer.get(b.id) ?? []).length;
        if (countB !== countA) return countB - countA;
        return b.createdAt.localeCompare(a.createdAt);
      });
    } else {
      // 'recent' — sort by latest activity or createdAt desc
      sorted.sort((a, b) => {
        const latestA = a.activities[0]?.timestamp ?? a.createdAt;
        const latestB = b.activities[0]?.timestamp ?? b.createdAt;
        return latestB.localeCompare(latestA);
      });
    }

    return sorted;
  }, [
    customers,
    searchQuery,
    statusFilter,
    segmentFilter,
    onlyActiveWarranty,
    sortBy,
    ordersByCustomer,
    modelLabelMap,
  ]);

  // Reset pagination when filters change
  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, segmentFilter, onlyActiveWarranty, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedCustomers = React.useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredCustomers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCustomers, safePage]);

  // Resolve active customer for Detail Workspace (auto-select first visible on desktop)
  const resolvedCustomer = React.useMemo(() => {
    if (selectedCustomerId) {
      const found = customers.find((c) => c.id === selectedCustomerId);
      if (found) return found;
    }
    return filteredCustomers[0] ?? customers[0] ?? null;
  }, [selectedCustomerId, customers, filteredCustomers]);

  const handleSelectCustomerCard = (customerId: string) => {
    onSelectCustomer(customerId);
    setMobileDetailOpen(true);
    setActiveTab('overview');
    setAddingTagInline(false);
    setInlineTagValue('');
    setDevicesSearch('');
    setCompatibleSearch('');
  };

  const handleOpenCreateModal = () => {
    setEditingCustomer(null);
    setCustomerModalOpen(true);
  };

  const handleOpenEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerModalOpen(true);
    setOpenMenuCustomerId(null);
  };

  const handleToggleRevealPii = (customer: Customer) => {
    const next = !revealedCustomerPii[customer.id];
    setRevealedCustomerPii((prev) => ({
      ...prev,
      [customer.id]: next,
    }));
    if (next) {
      onRevealSensitiveData(customer);
    }
  };

  const handleInlineTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedCustomer || !inlineTagValue.trim()) return;
    onAddTag(resolvedCustomer.id, inlineTagValue);
    setInlineTagValue('');
    setAddingTagInline(false);
  };

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedCustomer || !newNote.trim()) return;
    onAddNote(resolvedCustomer.id, newNote);
    setNewNote('');
  };

  // Precomputed metrics for the currently displayed customer
  const customerOrders = resolvedCustomer
    ? ordersByCustomer.get(resolvedCustomer.id) ?? []
    : [];
  const deviceOrders = customerOrders.filter((o) => Boolean(o.smartphoneSnapshot));
  const activeWarrantyOrders = customerOrders.filter(
    (o) => getDaysRemaining(o.warrantyExpiresAt, REFERENCE_TODAY) > 0
  );
  const compatibleAccessories = resolvedCustomer
    ? getCompatibleAccessories(resolvedCustomer.id)
    : [];

  const filteredDeviceOrders = React.useMemo(() => {
    const q = devicesSearch.trim().toLowerCase();
    if (!q) return deviceOrders;
    const digitsOnly = q.replace(/\D/g, '');
    return deviceOrders.filter((order) => {
      const snap = order.smartphoneSnapshot!;
      const haystack = [
        snap.brand,
        snap.model,
        snap.storage,
        snap.color,
        snap.condition,
        snap.imei1,
        order.code,
      ]
        .join(' ')
        .toLowerCase();
      if (haystack.includes(q)) return true;
      if (digitsOnly.length >= 3 && snap.imei1.includes(digitsOnly)) return true;
      return false;
    });
  }, [deviceOrders, devicesSearch]);

  const filteredOwnedModelIds = React.useMemo(() => {
    const ids = resolvedCustomer?.ownedModelIds ?? [];
    const q = devicesSearch.trim().toLowerCase();
    if (!q) return ids;
    return ids.filter((id) => (modelLabelMap.get(id) ?? id).toLowerCase().includes(q));
  }, [resolvedCustomer, devicesSearch, modelLabelMap]);

  const filteredCompatibleAccessories = React.useMemo(() => {
    const q = compatibleSearch.trim().toLowerCase();
    if (!q) return compatibleAccessories;
    return compatibleAccessories.filter((acc) => {
      const compatLabels = acc.compatibleModelIds
        .map((id) => modelLabelMap.get(id) ?? id)
        .join(' ');
      const haystack = [
        acc.name,
        acc.sku,
        acc.category,
        acc.brand ?? '',
        compatLabels,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [compatibleAccessories, compatibleSearch, modelLabelMap]);

  const devicesTabCount = Math.max(
    deviceOrders.length,
    resolvedCustomer?.ownedModelIds.length ?? 0
  );

  const isPiiRevealed = resolvedCustomer
    ? Boolean(revealedCustomerPii[resolvedCustomer.id])
    : false;

  const activeFilterCount =
    (segmentFilter !== 'TODOS' ? 1 : 0) + (onlyActiveWarranty ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Master-Detail Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* === LEFT / CENTER COLUMN: MASTER CLIENT LIST === */}
        <section
          aria-label="Lista de clientes"
          className={`lg:col-span-4 bg-white border border-[#E5E2D9] rounded-2xl shadow-[0_1px_2px_rgba(28,25,23,0.03)] flex flex-col overflow-hidden ${
            mobileDetailOpen ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Master Header */}
          <div className="p-4 border-b border-[#EFECE6] space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="font-serif text-[28px] leading-none text-[#1F1E1B]">
                  Clientes
                </h1>
                <p className="text-xs text-[#6E6B63] mt-1 tabular-nums">
                  {filteredCustomers.length}{' '}
                  {filteredCustomers.length === 1 ? 'cliente' : 'clientes'}
                </p>
              </div>
              <AuraButton variant="primary" size="sm" onClick={handleOpenCreateModal}>
                <Plus className="h-3.5 w-3.5" />
                Novo Cliente
              </AuraButton>
            </div>

            {/* Search + Filter Popover Trigger */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="h-3.5 w-3.5 text-[#8C887E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar nome, e-mail, telefone ou tag..."
                  aria-label="Buscar clientes"
                  className="w-full h-9 pl-8 pr-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                />
              </div>

              <div ref={filterPopoverRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterPopoverOpen((v) => !v)}
                  aria-label="Filtros avançados de clientes"
                  aria-expanded={filterPopoverOpen}
                  className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer relative ${
                    filterPopoverOpen || activeFilterCount > 0
                      ? 'bg-[#4F5A47] text-[#F4F2EC] border-[#4F5A47]'
                      : 'bg-[#FAF9F6] text-[#4A4842] border-[#DDDAD0] hover:border-[#BDB8AA]'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-[#B47B2B] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {filterPopoverOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E5E2D9] rounded-2xl shadow-xl p-4 z-30 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#1F1E1B]">
                        Filtros Adicionais
                      </p>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSegmentFilter('TODOS');
                            setOnlyActiveWarranty(false);
                          }}
                          className="text-[11px] font-medium text-[#4F5A47] hover:underline cursor-pointer"
                        >
                          Limpar
                        </button>
                      )}
                    </div>

                    <CreatableSelect
                      id="filter-customer-segment"
                      label="Segmento"
                      size="sm"
                      creatable={false}
                      value={segmentFilter}
                      searchPlaceholder="Filtrar segmento..."
                      options={[
                        { value: 'TODOS', label: 'Todos os segmentos' },
                        { value: 'VIP', label: 'VIP' },
                        { value: 'Varejo', label: 'Varejo' },
                        { value: 'Corporativo', label: 'Corporativo' },
                        { value: 'Revenda', label: 'Revenda' },
                      ]}
                      onChange={(val) =>
                        setSegmentFilter(val as 'TODOS' | CustomerSegment)
                      }
                    />

                    {features.hasWarrantyQr && (
                      <label className="flex items-center gap-2.5 text-xs text-[#2C2A25] cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={onlyActiveWarranty}
                          onChange={(e) => setOnlyActiveWarranty(e.target.checked)}
                          className="h-4 w-4 rounded accent-[#4F5A47] cursor-pointer"
                        />
                        Apenas com garantia ativa
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Status Pills */}
            <div
              role="group"
              aria-label="Filtrar clientes por status"
              className="flex items-center gap-1.5 flex-wrap"
            >
              {(
                [
                  { id: 'TODOS', label: 'Todos' },
                  { id: 'ATIVO', label: 'Ativo' },
                  { id: 'LEAD', label: 'Lead' },
                  { id: 'INATIVO', label: 'Inativo' },
                ] as { id: StatusFilter; label: string }[]
              ).map((pill) => {
                const active = statusFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatusFilter(pill.id)}
                    className={`h-7 px-3 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#4F5A47] text-[#F4F2EC]'
                        : 'bg-[#F4F2EC] text-[#55524A] hover:bg-[#E8E3D9] hover:text-[#1F1E1B]'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            {/* Sort Dropdown (Custom CreatableSelect, zero native <select>) */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] text-[#7A776E]">Ordenar por</span>
              <div className="w-40">
                <CreatableSelect
                  id="customers-sort"
                  size="sm"
                  creatable={false}
                  value={sortBy}
                  searchPlaceholder="Ordenação..."
                  options={[
                    { value: 'recent', label: 'Recentes' },
                    { value: 'name-asc', label: 'Nome A–Z' },
                    { value: 'purchases-desc', label: 'Mais compras' },
                  ]}
                  onChange={(val) => setSortBy(val as SortOption)}
                />
              </div>
            </div>
          </div>

          {/* Compact Master Cards List */}
          <div className="divide-y divide-[#F0EDE6]">
            {paginatedCustomers.map((cu) => {
              const isSelected = resolvedCustomer?.id === cu.id;
              const statusMeta = getCustomerStatusMeta(cu.status);
              const avatarClass = getAvatarTone(cu.id);
              const menuOpen = openMenuCustomerId === cu.id;

              return (
                <div
                  key={cu.id}
                  className={`relative px-4 py-3.5 transition-colors flex items-start justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-[#F4F2EC] shadow-[inset_3px_0_0_#4F5A47]'
                      : 'hover:bg-[#FAF9F6]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectCustomerCard(cu.id)}
                    aria-current={isSelected ? 'true' : undefined}
                    className="flex items-start gap-3 min-w-0 flex-1 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F5A47] rounded-lg"
                  >
                    <span
                      className={`h-10 w-10 rounded-full font-serif text-sm font-medium flex items-center justify-center shrink-0 mt-0.5 ${avatarClass}`}
                    >
                      {cu.initials}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-semibold text-[#1F1E1B] truncate">
                          {cu.name}
                        </p>
                      </div>
                      <p className="text-[11px] text-[#6E6B63] truncate mt-0.5">
                        {cu.email}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                        <span className="font-mono text-[11px] text-[#7A776E]">
                          {maskPhone(cu.phone)}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Quick Actions Menu ("...") */}
                  <div
                    className="relative shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-label={`Ações para ${cu.name}`}
                      onClick={() =>
                        setOpenMenuCustomerId(menuOpen ? null : cu.id)
                      }
                      className="h-7 w-7 rounded-lg text-[#6E6B63] hover:bg-[#E8E3D9] hover:text-[#1F1E1B] flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 mt-1 w-44 bg-white border border-[#E5E2D9] rounded-xl shadow-lg py-1 z-30">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(cu)}
                          className="w-full px-3 py-2 text-left text-xs text-[#2C2A25] hover:bg-[#F4F2EC] flex items-center gap-2 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-[#4F5A47]" />
                          Editar cliente
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuCustomerId(null);
                            onStartCheckoutForCustomer(cu.id);
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-[#2C2A25] hover:bg-[#F4F2EC] flex items-center gap-2 cursor-pointer"
                        >
                          <ShoppingBag className="h-3.5 w-3.5 text-[#4F5A47]" />
                          {labels.orderActionLabel}
                        </button>
                        <a
                          href={buildWhatsAppDirectCustomerUrl({
                            phone: cu.phone,
                            customerName: cu.name,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setOpenMenuCustomerId(null)}
                          className="w-full px-3 py-2 text-left text-xs text-[#2E472D] hover:bg-[#F4F2EC] flex items-center gap-2"
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-[#4F5A47]" />
                          Abrir WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {paginatedCustomers.length === 0 && (
              <div className="px-5 py-12 text-center space-y-2">
                <p className="text-sm text-[#4A4842] font-medium">
                  Nenhum cliente encontrado
                </p>
                <p className="text-xs text-[#7A776E]">
                  Ajuste os filtros ou cadastre um novo cliente.
                </p>
              </div>
            )}
          </div>

          {/* Clean Numeric Pagination Footer (< 1 2 3 >) */}
          <div className="px-4 py-3 border-t border-[#EFECE6] bg-[#FAF9F6] flex items-center justify-between text-xs mt-auto">
            <span className="text-[11px] text-[#7A776E] tabular-nums">
              Página {safePage} de {totalPages}
            </span>

            <nav
              aria-label="Paginação de clientes"
              className="flex items-center gap-1"
            >
              <button
                type="button"
                aria-label="Página anterior"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 w-7 rounded-lg border border-[#E5E2D9] bg-white text-[#4A4842] hover:bg-[#F4F2EC] disabled:opacity-40 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  aria-current={num === safePage ? 'page' : undefined}
                  onClick={() => setPage(num)}
                  className={`h-7 min-w-[28px] px-2 rounded-lg text-xs font-medium tabular-nums transition-colors cursor-pointer ${
                    num === safePage
                      ? 'bg-[#4F5A47] text-[#F4F2EC]'
                      : 'bg-white border border-[#E5E2D9] text-[#4A4842] hover:bg-[#F4F2EC]'
                  }`}
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                aria-label="Próxima página"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 w-7 rounded-lg border border-[#E5E2D9] bg-white text-[#4A4842] hover:bg-[#F4F2EC] disabled:opacity-40 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </nav>
          </div>
        </section>

        {/* === RIGHT COLUMN: DETAILED CUSTOMER WORKSPACE === */}
        <section
          aria-label="Workspace do cliente selecionado"
          className={`lg:col-span-8 space-y-5 min-w-0 ${
            mobileDetailOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Mobile/Tablet Back to List Button */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setMobileDetailOpen(false)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4A4842] hover:text-[#1F1E1B] cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para clientes
            </button>
          </div>

          {resolvedCustomer ? (
            <div className="bg-white border border-[#E5E2D9] rounded-2xl shadow-[0_1px_2px_rgba(28,25,23,0.03)] overflow-hidden">
              {/* Profile Header */}
              <div className="p-6 pb-0">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5">
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className={`h-14 w-14 rounded-full font-serif text-xl font-medium flex items-center justify-center shrink-0 ${getAvatarTone(
                        resolvedCustomer.id
                      )}`}
                    >
                      {resolvedCustomer.initials}
                    </div>

                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="font-serif text-[28px] leading-tight text-[#1F1E1B]">
                          {resolvedCustomer.name}
                        </h2>
                        <StatusBadge
                          label={getCustomerStatusMeta(resolvedCustomer.status).label}
                          tone={getCustomerStatusMeta(resolvedCustomer.status).tone}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6E6B63]">
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-[#8C887E]" />
                          {resolvedCustomer.email}
                        </span>
                        <span className="text-[#D4D0C5]">·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-[#8C887E]" />
                          <span className="font-mono text-[#2C2A25]">
                            {isPiiRevealed
                              ? resolvedCustomer.phone
                              : maskPhone(resolvedCustomer.phone)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleRevealPii(resolvedCustomer)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4F2EC] border border-[#E5E2D9] text-[11px] font-medium text-[#4F5A47] hover:bg-[#E8E3D9] transition-colors cursor-pointer"
                          >
                            {isPiiRevealed ? (
                              <>
                                <EyeOff className="h-3 w-3" />
                                Ocultar
                              </>
                            ) : (
                              <>
                                <Eye className="h-3 w-3" />
                                Revelar
                              </>
                            )}
                          </button>
                        </span>
                        <span className="text-[#D4D0C5]">·</span>
                        <span className="font-medium text-[#4A4842]">
                          {resolvedCustomer.segment}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Header Right Actions: Editar + WhatsApp + Nova Saída */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <AuraButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditModal(resolvedCustomer)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Editar
                    </AuraButton>

                    <a
                      href={buildWhatsAppDirectCustomerUrl({
                        phone: resolvedCustomer.phone,
                        customerName: resolvedCustomer.name,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Conversar no WhatsApp com ${resolvedCustomer.name}`}
                      className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-[#E6ECE3] text-[#2E472D] hover:bg-[#D8E3D3] transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>

                    <AuraButton
                      variant="primary"
                      size="sm"
                      onClick={() => onStartCheckoutForCustomer(resolvedCustomer.id)}
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      {labels.orderActionLabel}
                    </AuraButton>
                  </div>
                </div>

                {/* Underlined Tab Bar with Real Counts (template-driven) */}
                <div
                  role="tablist"
                  aria-label="Seções do cliente"
                  className="flex items-center gap-4 border-b border-[#EFECE6] overflow-x-auto"
                >
                  {(
                    [
                      { id: 'overview', label: 'Visão Geral' },
                      {
                        id: 'devices',
                        label: labels.primaryTabName,
                        count: devicesTabCount,
                      },
                      ...(features.hasWarrantyQr
                        ? [
                            {
                              id: 'warranties' as DetailTab,
                              label: 'Garantias',
                              count: activeWarrantyOrders.length,
                            },
                          ]
                        : []),
                      ...(features.hasCompatibilityCrossSell
                        ? [
                            {
                              id: 'compatible' as DetailTab,
                              label: 'Compatíveis',
                              count: compatibleAccessories.length,
                            },
                          ]
                        : []),
                      { id: 'notes', label: 'Notas' },
                      { id: 'documents', label: 'Documentos' },
                      { id: 'activity', label: 'Atividade' },
                    ] as { id: DetailTab; label: string; count?: number }[]
                  ).map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-3 text-[12.5px] font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                          active
                            ? 'border-[#4F5A47] text-[#1F1E1B]'
                            : 'border-transparent text-[#6E6B63] hover:text-[#1F1E1B]'
                        }`}
                      >
                        <span>{tab.label}</span>
                        {typeof tab.count === 'number' && (
                          <span
                            className={`text-[11px] tabular-nums ${
                              active ? 'text-[#4F5A47] font-semibold' : 'text-[#8C887E]'
                            }`}
                          >
                            ({tab.count})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* === TAB CONTENT AREA === */}
              <div className="p-6 bg-[#FAF9F6]/60">
                {/* 1. VISÃO GERAL — Modular 2x2 Grid */}
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                    {/* Top Left: SOBRE O CLIENTE */}
                    <div className="xl:col-span-6 bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#7A776E]">
                          SOBRE O CLIENTE
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleToggleRevealPii(resolvedCustomer)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4F5A47] hover:underline cursor-pointer"
                        >
                          {isPiiRevealed ? (
                            <>
                              <EyeOff className="h-3 w-3" />
                              Ocultar dados
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3" />
                              Revelar CPF/Tel.
                            </>
                          )}
                        </button>
                      </div>

                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-xs">
                        <div>
                          <dt className="text-[#7A776E]">Nome completo</dt>
                          <dd className="font-medium text-[#1F1E1B] mt-0.5">
                            {resolvedCustomer.name}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-[#7A776E]">Segmento</dt>
                          <dd className="font-medium text-[#1F1E1B] mt-0.5">
                            {resolvedCustomer.segment}
                          </dd>
                        </div>

                        <div className="sm:col-span-2">
                          <dt className="text-[#7A776E]">E-mail</dt>
                          <dd className="text-[#1F1E1B] mt-0.5 break-all">
                            {resolvedCustomer.email}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-[#7A776E]">Telefone / WhatsApp</dt>
                          <dd className="font-mono text-[#1F1E1B] mt-0.5">
                            {isPiiRevealed
                              ? resolvedCustomer.phone
                              : maskPhone(resolvedCustomer.phone)}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-[#7A776E]">CPF (auditado)</dt>
                          <dd className="font-mono text-[#1F1E1B] mt-0.5">
                            {isPiiRevealed
                              ? resolvedCustomer.cpf
                              : maskCPF(resolvedCustomer.cpf)}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-[#7A776E]">Cliente desde</dt>
                          <dd className="text-[#1F1E1B] tabular-nums mt-0.5">
                            {formatDateBR(resolvedCustomer.createdAt || resolvedCustomer.since)}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-[#7A776E]">Localidade</dt>
                          <dd className="text-[#1F1E1B] mt-0.5 inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-[#8C887E]" />
                            {resolvedCustomer.city}
                          </dd>
                        </div>
                      </dl>

                      {/* Editable Tags Section with inline "+" */}
                      <div className="pt-3 border-t border-[#EFECE6] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#7A776E]">
                            Tags
                          </span>
                          {!addingTagInline && (
                            <button
                              type="button"
                              onClick={() => setAddingTagInline(true)}
                              aria-label="Adicionar nova tag ao cliente"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4F5A47] hover:bg-[#F4F2EC] px-2 py-0.5 rounded-md cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                              Nova tag
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {resolvedCustomer.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F4F2EC] border border-[#E5E2D9] text-xs text-[#2C2A25]"
                            >
                              {tag}
                              <button
                                type="button"
                                aria-label={`Remover tag ${tag}`}
                                onClick={() => onRemoveTag(resolvedCustomer.id, tag)}
                                className="text-[#8C887E] hover:text-[#1F1E1B] cursor-pointer"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}

                          {!addingTagInline ? (
                            <button
                              type="button"
                              onClick={() => setAddingTagInline(true)}
                              aria-label="Adicionar tag rápida"
                              className="h-6 w-6 rounded-full border border-dashed border-[#BDB8AA] text-[#6E6B63] hover:border-[#4F5A47] hover:text-[#4F5A47] flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          ) : (
                            <form
                              onSubmit={handleInlineTagSubmit}
                              className="inline-flex items-center gap-1.5 mt-1 w-full"
                            >
                              <input
                                type="text"
                                autoFocus
                                value={inlineTagValue}
                                onChange={(e) => setInlineTagValue(e.target.value)}
                                placeholder="Ex: Prefere Película Privacidade..."
                                aria-label="Nome da nova tag"
                                className="flex-1 h-7 px-2.5 rounded-lg bg-[#FAF9F6] border border-[#4F5A47] text-xs text-[#1F1E1B] focus:outline-none"
                              />
                              <AuraButton type="submit" variant="primary" size="sm">
                                Salvar
                              </AuraButton>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingTagInline(false);
                                  setInlineTagValue('');
                                }}
                                className="p-1 text-[#6E6B63] hover:text-[#1F1E1B] cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Top Right: PRIMARY ITEMS & WARRANTIES / RECENT ORDERS */}
                    <div className="xl:col-span-6 bg-white border border-[#E5E2D9] rounded-2xl p-5 flex flex-col justify-between space-y-4">
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#7A776E]">
                            {features.hasWarrantyQr
                              ? `${labels.primaryTabName.toUpperCase()} & GARANTIAS ATIVAS`
                              : `${labels.primaryTabName.toUpperCase()} & PEDIDOS RECENTES`}
                          </h3>
                          <span className="text-[11px] text-[#6E6B63] tabular-nums">
                            {features.hasWarrantyQr
                              ? `${activeWarrantyOrders.length} vigente(s)`
                              : `${customerOrders.length} pedido(s)`}
                          </span>
                        </div>

                        {deviceOrders.length > 0 ? (
                          <div className="space-y-3">
                            {deviceOrders.slice(0, 3).map((order) => {
                              const snap = order.smartphoneSnapshot!;
                              const daysLeft = getDaysRemaining(
                                order.warrantyExpiresAt,
                                REFERENCE_TODAY
                              );
                              const pct = getWarrantyPercentRemaining(
                                order.warrantyDays,
                                order.warrantyExpiresAt,
                                REFERENCE_TODAY
                              );
                              const isWarning = daysLeft > 0 && daysLeft <= 15;
                              const isExpired = daysLeft <= 0;

                              return (
                                <div
                                  key={order.id}
                                  className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-2.5"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <span className="h-9 w-9 rounded-xl bg-[#ECEAE2] text-[#4F5A47] flex items-center justify-center shrink-0">
                                        {features.hasSerializedItems ? (
                                          <SmartphoneIcon className="h-4 w-4" />
                                        ) : (
                                          <ShoppingBag className="h-4 w-4" />
                                        )}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-[13px] font-semibold text-[#1F1E1B] leading-snug">
                                          {features.hasSerializedItems && snap.storage !== '—'
                                            ? `${snap.model} · ${snap.storage}`
                                            : snap.model}
                                        </p>
                                        <p className="text-[11px] text-[#6E6B63] truncate">
                                          {features.hasSerializedItems
                                            ? `${snap.color} · ${snap.condition}`
                                            : `${formatDateBR(order.issuedAt)} · ${order.paymentMethod}`}
                                        </p>
                                      </div>
                                    </div>
                                    {features.hasWarrantyQr ? (
                                      <StatusBadge
                                        label={isExpired ? 'Encerrada' : `${daysLeft}d`}
                                        tone={
                                          isExpired
                                            ? 'stone'
                                            : isWarning
                                              ? 'amber'
                                              : 'olive'
                                        }
                                      />
                                    ) : (
                                      <span className="text-xs font-semibold tabular-nums text-[#1F1E1B]">
                                        {formatCurrencyBRL(order.totalAmount)}
                                      </span>
                                    )}
                                  </div>

                                  {features.hasWarrantyQr && (
                                    <div className="space-y-1">
                                      <div className="h-2 w-full rounded-full bg-[#E8E5DC] overflow-hidden">
                                        <div
                                          style={{ width: `${pct}%` }}
                                          className={`h-full rounded-full transition-all duration-300 ${
                                            isExpired
                                              ? 'bg-[#8A867D]'
                                              : isWarning
                                                ? 'bg-[#B47B2B]'
                                                : 'bg-[#4F5A47]'
                                          }`}
                                        />
                                      </div>
                                      <div className="flex items-center justify-between text-[11px] text-[#6E6B63] tabular-nums">
                                        <span>
                                          Vence em: {formatDateBR(order.warrantyExpiresAt)}
                                        </span>
                                        <span className="font-medium text-[#2C2A25]">
                                          {pct}% restante
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : resolvedCustomer.ownedModelIds.length > 0 ? (
                          <div className="space-y-2.5">
                            {resolvedCustomer.ownedModelIds.map((modelId) => (
                              <div
                                key={modelId}
                                className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] flex items-center justify-between gap-2.5"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="h-9 w-9 rounded-xl bg-[#ECEAE2] text-[#4F5A47] flex items-center justify-center shrink-0">
                                    {features.hasSerializedItems ? (
                                      <SmartphoneIcon className="h-4 w-4" />
                                    ) : (
                                      <Package className="h-4 w-4" />
                                    )}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-[#1F1E1B] truncate">
                                      {modelLabelMap.get(modelId) ?? modelId}
                                    </p>
                                    <p className="text-[11px] text-[#6E6B63]">
                                      Preferência registrada no perfil do cliente
                                    </p>
                                  </div>
                                </div>
                                <StatusBadge label="Perfil" tone="stone" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-[#6E6B63] py-6 text-center">
                            Nenhum pedido registrado ainda para este cliente.
                          </p>
                        )}
                      </div>

                      <div className="pt-2.5 border-t border-[#EFECE6] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('devices')}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#4F5A47] hover:underline cursor-pointer whitespace-nowrap"
                        >
                          Ver histórico ({labels.primaryTabName})
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                        </button>
                        {features.hasCompatibilityCrossSell &&
                          compatibleAccessories.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setActiveTab('compatible')}
                              className="text-[11px] text-[#6E6B63] hover:text-[#1F1E1B] cursor-pointer whitespace-nowrap"
                            >
                              {compatibleAccessories.length} compatíveis
                            </button>
                          )}
                      </div>
                    </div>

                    {/* Bottom Left: ATIVIDADE RECENTE */}
                    <div className="xl:col-span-6 bg-white border border-[#E5E2D9] rounded-2xl p-5 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <h3 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#7A776E]">
                          ATIVIDADE RECENTE
                        </h3>

                        {resolvedCustomer.activities.length > 0 ? (
                          <div className="space-y-3">
                            {resolvedCustomer.activities.slice(0, 4).map((act) => {
                              const Icon = getActivityIcon(act.type);
                              return (
                                <div
                                  key={act.id}
                                  className="flex items-start gap-3 text-xs"
                                >
                                  <span className="h-7 w-7 rounded-lg bg-[#F4F2EC] border border-[#EAE7DF] text-[#4F5A47] flex items-center justify-center shrink-0 mt-0.5">
                                    <Icon className="h-3.5 w-3.5" />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-2">
                                      <p className="font-medium text-[#1F1E1B] truncate">
                                        {act.title}
                                      </p>
                                      <span className="text-[11px] text-[#8C887E] whitespace-nowrap shrink-0">
                                        {formatRelativeDateBR(act.timestamp)}
                                      </span>
                                    </div>
                                    {act.detail && (
                                      <p className="text-[11px] text-[#6E6B63] mt-0.5 line-clamp-1">
                                        {act.detail}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-[#6E6B63] py-4">
                            Nenhuma atividade registrada ainda.
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[#EFECE6]">
                        <button
                          type="button"
                          onClick={() => setActiveTab('activity')}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#4F5A47] hover:underline cursor-pointer"
                        >
                          Ver toda atividade
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Right: NOTAS */}
                    <div className="xl:col-span-6 bg-white border border-[#E5E2D9] rounded-2xl p-5 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#7A776E]">
                            NOTAS
                          </h3>
                          <span className="text-[11px] text-[#7A776E] tabular-nums">
                            {resolvedCustomer.notes.length} salva(s)
                          </span>
                        </div>

                        {resolvedCustomer.notes.length > 0 ? (
                          <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-[#6E6B63]">
                              <span className="font-medium text-[#2C2A25]">
                                {resolvedCustomer.notes[0].author}
                              </span>
                              <span className="tabular-nums">
                                {formatDateBR(resolvedCustomer.notes[0].createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-[#2C2A25] leading-relaxed">
                              {resolvedCustomer.notes[0].content}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-[#6E6B63] py-2">
                            Nenhuma nota interna registrada ainda.
                          </p>
                        )}

                        <form onSubmit={handleNoteSubmit} className="flex items-center gap-2 min-w-0">
                          <input
                            type="text"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Adicionar nota rápida..."
                            aria-label="Adicionar nota interna"
                            className="min-w-0 flex-1 h-9 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                          />
                          <AuraButton
                            type="submit"
                            variant="secondary"
                            size="sm"
                            disabled={!newNote.trim()}
                            className="shrink-0"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Salvar
                          </AuraButton>
                        </form>
                      </div>

                      <div className="pt-2 border-t border-[#EFECE6]">
                        <button
                          type="button"
                          onClick={() => setActiveTab('notes')}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#4F5A47] hover:underline cursor-pointer"
                        >
                          Ver todas as notas
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. PRIMARY ITEMS / HISTORY TAB */}
                {activeTab === 'devices' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[#1F1E1B]">
                          {labels.primaryTabName} & Histórico de Pedidos
                        </h3>
                        <p className="text-xs text-[#6E6B63] mt-0.5">
                          Itens adquiridos em {template.storeName} e preferências salvas no perfil do cliente.
                        </p>
                      </div>
                      <AuraButton
                        variant="secondary"
                        size="sm"
                        onClick={() => onStartCheckoutForCustomer(resolvedCustomer.id)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {labels.orderActionLabel}
                      </AuraButton>
                    </div>

                    {(deviceOrders.length > 0 || resolvedCustomer.ownedModelIds.length > 0) && (
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 text-[#8C887E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={devicesSearch}
                          onChange={(e) => setDevicesSearch(e.target.value)}
                          placeholder={
                            features.hasSerializedItems
                              ? 'Buscar aparelho por modelo, cor, armazenamento, IMEI ou pedido...'
                              : `Buscar em ${labels.primaryTabName.toLowerCase()} ou código do pedido...`
                          }
                          aria-label="Buscar histórico do cliente"
                          className="w-full h-9 pl-8 pr-8 rounded-xl bg-white border border-[#DDDAD0] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47] transition-colors"
                        />
                        {devicesSearch && (
                          <button
                            type="button"
                            aria-label="Limpar busca do histórico"
                            onClick={() => setDevicesSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C887E] hover:text-[#1F1E1B] cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {deviceOrders.length > 0 ? (
                      filteredDeviceOrders.length > 0 ? (
                        <div className="space-y-3">
                          {filteredDeviceOrders.map((order) => {
                            const snap = order.smartphoneSnapshot!;
                            const daysLeft = getDaysRemaining(
                              order.warrantyExpiresAt,
                              REFERENCE_TODAY
                            );
                            return (
                              <div
                                key={order.id}
                                className="bg-white border border-[#E5E2D9] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                              >
                                <div className="flex items-start gap-3.5 min-w-0">
                                  <span className="h-11 w-11 rounded-xl bg-[#ECEAE2] text-[#4F5A47] flex items-center justify-center shrink-0">
                                    {features.hasSerializedItems ? (
                                      <SmartphoneIcon className="h-5 w-5" />
                                    ) : (
                                      <ShoppingBag className="h-5 w-5" />
                                    )}
                                  </span>
                                  <div className="min-w-0 space-y-1">
                                    <p className="text-sm font-semibold text-[#1F1E1B]">
                                      {features.hasSerializedItems
                                        ? `${snap.brand} ${snap.model} · ${snap.storage}`
                                        : snap.model}
                                    </p>
                                    <p className="text-xs text-[#6E6B63]">
                                      {features.hasSerializedItems
                                        ? `${snap.color} · ${snap.condition} · Bateria ${snap.batteryHealth}%`
                                        : `${snap.brand} · ${snap.condition} · ${order.paymentMethod}`}
                                    </p>
                                    <p className="text-[11px] font-mono text-[#6E6B63] tabular-nums">
                                      {features.hasSerializedItems
                                        ? `IMEI: ${maskIMEI(snap.imei1)} · `
                                        : ''}
                                      Pedido {order.code} · {formatDateBR(order.issuedAt)}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                                  <div className="text-right mr-1">
                                    <p className="text-sm font-semibold tabular-nums text-[#1F1E1B]">
                                      {formatCurrencyBRL(order.totalAmount)}
                                    </p>
                                    {features.hasWarrantyQr && (
                                      <p className="text-[11px] text-[#6E6B63]">
                                        {daysLeft > 0
                                          ? `Garantia: ${daysLeft}d`
                                          : 'Garantia encerrada'}
                                      </p>
                                    )}
                                  </div>
                                  <AuraButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      onOpenWarrantyDocument(order, resolvedCustomer)
                                    }
                                  >
                                    {features.hasWarrantyQr
                                      ? 'Abrir Termo'
                                      : 'Abrir Comprovante'}
                                  </AuraButton>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="bg-white border border-dashed border-[#DDDAD0] rounded-2xl p-7 text-center space-y-2">
                          <p className="text-xs font-medium text-[#2C2A25]">
                            Nenhum aparelho corresponde a &ldquo;{devicesSearch}&rdquo;
                          </p>
                          <button
                            type="button"
                            onClick={() => setDevicesSearch('')}
                            className="text-xs font-medium text-[#4F5A47] hover:underline cursor-pointer"
                          >
                            Limpar busca
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="bg-white border border-[#E5E2D9] rounded-2xl p-6 space-y-3">
                        <p className="text-xs text-[#6E6B63]">
                          Este cliente ainda não possui aparelhos comprados pelo balcão.
                        </p>
                        {filteredOwnedModelIds.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {filteredOwnedModelIds.map((id) => (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4F2EC] border border-[#E5E2D9] text-xs font-medium text-[#2C2A25]"
                              >
                                <SmartphoneIcon className="h-3.5 w-3.5 text-[#4F5A47]" />
                                {modelLabelMap.get(id) ?? id}
                              </span>
                            ))}
                          </div>
                        ) : (
                          devicesSearch.trim() && (
                            <p className="text-xs text-[#7A776E]">
                              Nenhum modelo corresponde a &ldquo;{devicesSearch}&rdquo;.
                            </p>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. GARANTIAS TAB */}
                {activeTab === 'warranties' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#1F1E1B]">
                        Coberturas de Garantia & QR Code Público
                      </h3>
                      <p className="text-xs text-[#6E6B63] mt-0.5">
                        Acompanhe vencimentos, envie lembretes no WhatsApp e consulte o certificado público.
                      </p>
                    </div>

                    {customerOrders.length > 0 ? (
                      <div className="space-y-3">
                        {customerOrders.map((order) => {
                          const daysLeft = getDaysRemaining(
                            order.warrantyExpiresAt,
                            REFERENCE_TODAY
                          );
                          const pct = getWarrantyPercentRemaining(
                            order.warrantyDays,
                            order.warrantyExpiresAt,
                            REFERENCE_TODAY
                          );
                          const isWarning = daysLeft > 0 && daysLeft <= 15;
                          const isExpired = daysLeft <= 0;

                          return (
                            <div
                              key={order.id}
                              className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-3.5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold text-[#1F1E1B]">
                                      {order.smartphoneSnapshot
                                        ? `${order.smartphoneSnapshot.brand} ${order.smartphoneSnapshot.model} · ${order.smartphoneSnapshot.storage}`
                                        : 'Garantia de Acessórios'}
                                    </p>
                                    <StatusBadge
                                      label={
                                        isExpired
                                          ? 'Encerrada'
                                          : isWarning
                                            ? `Vence em ${daysLeft}d`
                                            : `Ativa · ${daysLeft}d`
                                      }
                                      tone={
                                        isExpired
                                          ? 'stone'
                                          : isWarning
                                            ? 'amber'
                                            : 'olive'
                                      }
                                    />
                                  </div>
                                  <p className="text-xs text-[#6E6B63] mt-1 tabular-nums">
                                    Certificado{' '}
                                    <span className="font-mono text-[#2C2A25]">
                                      {order.code}
                                    </span>{' '}
                                    · Emitido em {formatDateBR(order.issuedAt)} · Vence em{' '}
                                    {formatDateBR(order.warrantyExpiresAt)}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  {daysLeft > 0 && daysLeft <= 15 && (
                                    <a
                                      href={buildWhatsAppWarrantyUrl({
                                        phone: resolvedCustomer.phone,
                                        customerName: resolvedCustomer.name,
                                        modelName:
                                          order.smartphoneSnapshot?.model ?? 'aparelho',
                                        daysLeft,
                                      })}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-[#E6ECE3] text-[#2E472D] hover:bg-[#D8E3D3]"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5" />
                                      Avisar no WhatsApp
                                    </a>
                                  )}
                                  <AuraButton
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      onPreviewPublicWarranty(order.publicToken)
                                    }
                                  >
                                    <QrCode className="h-3.5 w-3.5" />
                                    Pré-visualizar página pública (QR Code)
                                  </AuraButton>
                                  <AuraButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      onOpenWarrantyDocument(order, resolvedCustomer)
                                    }
                                  >
                                    Abrir Termo
                                  </AuraButton>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <div className="h-2 w-full rounded-full bg-[#ECEAE2] overflow-hidden">
                                  <div
                                    style={{ width: `${pct}%` }}
                                    className={`h-full rounded-full ${
                                      isExpired
                                        ? 'bg-[#8A867D]'
                                        : isWarning
                                          ? 'bg-[#B47B2B]'
                                          : 'bg-[#4F5A47]'
                                    }`}
                                  />
                                </div>
                                <div className="flex justify-between text-[11px] text-[#6E6B63] tabular-nums">
                                  <span>Cobertura de {order.warrantyDays} dias</span>
                                  <span>{pct}% restante</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-white border border-[#E5E2D9] rounded-2xl p-8 text-center text-xs text-[#6E6B63]">
                        Nenhuma garantia registrada para este cliente.
                      </div>
                    )}
                  </div>
                )}

                {/* 4. COMPATÍVEIS TAB (Preserves v2 Smart Cross-Sell Engine + wa.me) */}
                {activeTab === 'compatible' && (
                  <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-[15px] font-semibold text-[#1F1E1B] flex items-center gap-2">
                          <PackageCheck className="h-4 w-4 text-[#4F5A47]" />
                          Acessórios Compatíveis em Estoque
                        </h3>
                        <p className="text-xs text-[#6E6B63] mt-0.5">
                          Cruzamento automático com o(s) modelo(s) de {resolvedCustomer.name.split(' ')[0]} (somente SKUs com estoque &gt; 0).
                        </p>
                      </div>
                      <span className="text-xs font-medium text-[#2E472D] bg-[#E6ECE3] px-2.5 py-0.5 rounded-full tabular-nums">
                        {compatibleSearch.trim()
                          ? `${filteredCompatibleAccessories.length} de ${compatibleAccessories.length} disponíveis`
                          : `${compatibleAccessories.length} disponíveis`}
                      </span>
                    </div>

                    {compatibleAccessories.length > 0 && (
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 text-[#8C887E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={compatibleSearch}
                          onChange={(e) => setCompatibleSearch(e.target.value)}
                          placeholder="Buscar acessório compatível por nome, SKU ou categoria..."
                          aria-label="Buscar acessórios compatíveis"
                          className="w-full h-9 pl-8 pr-8 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47] focus:bg-white transition-colors"
                        />
                        {compatibleSearch && (
                          <button
                            type="button"
                            aria-label="Limpar busca de acessórios compatíveis"
                            onClick={() => setCompatibleSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C887E] hover:text-[#1F1E1B] cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {compatibleAccessories.length > 0 ? (
                      filteredCompatibleAccessories.length > 0 ? (
                        <div className="max-h-[420px] overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {filteredCompatibleAccessories.map((acc) => {
                            const primaryModelName =
                              modelLabelMap.get(resolvedCustomer.ownedModelIds[0]) ??
                              deviceOrders[0]?.smartphoneSnapshot?.model ??
                              'seu smartphone';
                            const waAccUrl = buildWhatsAppAccessoryUrl({
                              phone: resolvedCustomer.phone,
                              customerName: resolvedCustomer.name,
                              modelName: primaryModelName,
                              accessoryName: acc.name,
                              priceFormatted: formatCurrencyBRL(acc.price),
                            });

                            return (
                              <div
                                key={acc.id}
                                className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E8E5DC] flex items-center justify-between gap-2.5"
                              >
                                <div className="min-w-0">
                                  <p className="text-[13px] font-medium text-[#1F1E1B] truncate">
                                    {acc.name}
                                  </p>
                                  <p className="text-xs text-[#6E6B63] mt-0.5 tabular-nums">
                                    <span className="font-mono text-[11px]">{acc.sku}</span> ·{' '}
                                    {acc.stock} un. ·{' '}
                                    <strong className="text-[#1F1E1B]">
                                      {formatCurrencyBRL(acc.price)}
                                    </strong>
                                  </p>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <a
                                    href={waAccUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Enviar sugestão de ${acc.name} no WhatsApp para ${resolvedCustomer.name}`}
                                    title="Oferecer no WhatsApp"
                                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-[#E6ECE3] text-[#2E472D] hover:bg-[#D8E3D3] transition-colors"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                  </a>
                                  <AuraButton
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      onQuickSellAccessory(resolvedCustomer.id, acc.id)
                                    }
                                  >
                                    Vender
                                  </AuraButton>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-[#FAF9F6] border border-dashed border-[#DDDAD0] px-4 py-7 text-center space-y-2">
                          <p className="text-xs font-medium text-[#2C2A25]">
                            Nenhum acessório compatível corresponde a &ldquo;{compatibleSearch}&rdquo;
                          </p>
                          <button
                            type="button"
                            onClick={() => setCompatibleSearch('')}
                            className="text-xs font-medium text-[#4F5A47] hover:underline cursor-pointer"
                          >
                            Limpar busca
                          </button>
                        </div>
                      )
                    ) : (
                      <p className="text-xs text-[#6E6B63] py-6 text-center">
                        Nenhum acessório compatível em estoque no momento.
                      </p>
                    )}
                  </div>
                )}

                {/* 5. NOTAS TAB */}
                {activeTab === 'notes' && (
                  <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#1F1E1B]">
                        Notas Internas do Atendimento
                      </h3>
                      <p className="text-xs text-[#6E6B63] mt-0.5">
                        Preferências de cor, película, histórico de negociação e lembretes de pós-venda.
                      </p>
                    </div>

                    <form onSubmit={handleNoteSubmit} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Escreva uma nota interna sobre o cliente..."
                        aria-label="Nova nota interna"
                        className="flex-1 h-10 px-3.5 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                      />
                      <AuraButton
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={!newNote.trim()}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Salvar Nota
                      </AuraButton>
                    </form>

                    {resolvedCustomer.notes.length > 0 ? (
                      <div className="space-y-3">
                        {resolvedCustomer.notes.map((note) => (
                          <div
                            key={note.id}
                            className="p-4 rounded-xl bg-[#FAF9F6] border border-[#EFECE6]"
                          >
                            <div className="flex items-center justify-between text-xs text-[#6E6B63] mb-1.5">
                              <span className="font-semibold text-[#1F1E1B]">
                                {note.author}
                              </span>
                              <span className="tabular-nums">
                                {formatDateBR(note.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-[#2C2A25] leading-relaxed">
                              {note.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#6E6B63] py-6 text-center">
                        Nenhuma nota registrada ainda.
                      </p>
                    )}
                  </div>
                )}

                {/* 6. DOCUMENTOS TAB */}
                {activeTab === 'documents' && (
                  <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#1F1E1B]">
                        {features.hasWarrantyQr
                          ? 'Documentos & Termos de Garantia Emitidos'
                          : 'Comprovantes & Pedidos Emitidos'}
                      </h3>
                      <p className="text-xs text-[#6E6B63] mt-0.5">
                        {features.hasWarrantyQr
                          ? 'Acesse o termo completo para impressão ou abra a consulta pública via QR Code.'
                          : 'Acesse o comprovante completo dos pedidos realizados por este cliente.'}
                      </p>
                    </div>

                    {customerOrders.length > 0 ? (
                      <div className="space-y-2.5">
                        {customerOrders.map((order) => {
                          const daysLeft = getDaysRemaining(
                            order.warrantyExpiresAt,
                            REFERENCE_TODAY
                          );
                          return (
                            <div
                              key={order.id}
                              className="p-4 rounded-xl border border-[#ECE9E1] hover:border-[#D4D0C5] transition-colors flex flex-wrap items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="h-9 w-9 rounded-xl bg-[#ECEAE2] text-[#4F5A47] flex items-center justify-center shrink-0">
                                  <FileText className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[13px] font-medium text-[#1F1E1B] truncate">
                                    {features.hasWarrantyQr
                                      ? 'Termo de Garantia'
                                      : 'Comprovante de Pedido'}{' '}
                                    ·{' '}
                                    {order.smartphoneSnapshot?.model ??
                                      labels.secondaryTabName}
                                  </p>
                                  <p className="text-xs text-[#6E6B63] tabular-nums">
                                    <span className="font-mono text-[11px]">
                                      {order.code}
                                    </span>{' '}
                                    · Emitido em {formatDateBR(order.issuedAt)}
                                    {features.hasWarrantyQr
                                      ? ` · Válido até ${formatDateBR(order.warrantyExpiresAt)}`
                                      : ` · ${formatCurrencyBRL(order.totalAmount)}`}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap shrink-0">
                                {features.hasWarrantyQr && (
                                  <>
                                    <StatusBadge
                                      label={
                                        daysLeft > 15
                                          ? 'Garantia Ativa'
                                          : daysLeft > 0
                                            ? `Vence em ${daysLeft}d`
                                            : 'Encerrado'
                                      }
                                      tone={
                                        daysLeft > 15
                                          ? 'olive'
                                          : daysLeft > 0
                                            ? 'amber'
                                            : 'stone'
                                      }
                                    />
                                    <AuraButton
                                      variant="secondary"
                                      size="sm"
                                      onClick={() =>
                                        onPreviewPublicWarranty(order.publicToken)
                                      }
                                    >
                                      <QrCode className="h-3.5 w-3.5" />
                                      Pré-visualizar página pública (QR Code)
                                    </AuraButton>
                                  </>
                                )}
                                <AuraButton
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    onOpenWarrantyDocument(order, resolvedCustomer)
                                  }
                                >
                                  {features.hasWarrantyQr
                                    ? 'Abrir Termo'
                                    : 'Abrir Comprovante'}
                                </AuraButton>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-[#6E6B63] py-6 text-center">
                        {features.hasWarrantyQr
                          ? 'Nenhum termo de garantia emitido ainda para este cliente.'
                          : 'Nenhum comprovante de pedido emitido ainda para este cliente.'}
                      </p>
                    )}
                  </div>
                )}

                {/* 7. ATIVIDADE TAB */}
                {activeTab === 'activity' && (
                  <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-[#1F1E1B] flex items-center gap-2">
                          <History className="h-4 w-4 text-[#4F5A47]" />
                          Linha do Tempo de Atividades
                        </h3>
                        <p className="text-xs text-[#6E6B63] mt-0.5">
                          Registro cronológico de compras, garantias, notas, trade-ins e acessos auditados.
                        </p>
                      </div>
                      <span className="text-xs text-[#7A776E] tabular-nums">
                        {resolvedCustomer.activities.length} eventos
                      </span>
                    </div>

                    {resolvedCustomer.activities.length > 0 ? (
                      <div className="space-y-3">
                        {resolvedCustomer.activities.map((act) => {
                          const Icon = getActivityIcon(act.type);
                          return (
                            <div
                              key={act.id}
                              className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#EFECE6] flex items-start gap-3"
                            >
                              <span className="h-8 w-8 rounded-lg bg-white border border-[#E5E2D9] text-[#4F5A47] flex items-center justify-center shrink-0 mt-0.5">
                                <Icon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                  <p className="text-[13px] font-medium text-[#1F1E1B]">
                                    {act.title}
                                  </p>
                                  <span className="inline-flex items-center gap-1 text-[11px] text-[#7A776E] tabular-nums">
                                    <Clock className="h-3 w-3" />
                                    {formatRelativeDateBR(act.timestamp)} ·{' '}
                                    {formatDateBR(act.timestamp.slice(0, 10))}
                                  </span>
                                </div>
                                {act.detail && (
                                  <p className="text-xs text-[#6E6B63] mt-0.5">
                                    {act.detail}
                                  </p>
                                )}
                                {act.actor && (
                                  <p className="text-[11px] text-[#8C887E] mt-1">
                                    Por {act.actor}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-[#6E6B63] py-6 text-center">
                        Nenhuma atividade registrada ainda.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E2D9] rounded-2xl p-12 text-center space-y-3">
              <p className="font-serif text-xl text-[#1F1E1B]">
                Selecione ou cadastre um cliente
              </p>
              <p className="text-xs text-[#6E6B63]">
                Use o botão acima para iniciar um novo cadastro no CRM de {template.storeName}.
              </p>
              <AuraButton variant="primary" size="md" onClick={handleOpenCreateModal}>
                <Plus className="h-4 w-4" />
                Novo Cliente
              </AuraButton>
            </div>
          )}
        </section>
      </div>

      {/* Create / Edit Customer Slide-Over Modal */}
      <CustomerModal
        open={customerModalOpen}
        editingCustomer={editingCustomer}
        deviceModels={deviceModels}
        onClose={() => {
          setCustomerModalOpen(false);
          setEditingCustomer(null);
        }}
        onAddDeviceModel={onAddDeviceModel}
        onCreateCustomer={(input) => {
          const created = onCreateCustomer(input);
          onSelectCustomer(created.id);
          setMobileDetailOpen(true);
          setActiveTab('overview');
        }}
        onUpdateCustomer={(id, input) => {
          onUpdateCustomer(id, input);
        }}
      />
    </div>
  );
}
