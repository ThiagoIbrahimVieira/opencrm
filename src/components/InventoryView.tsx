import React from 'react';
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Download,
  Plus,
  Eye,
  EyeOff,
  X,
  Tag,
  Printer,
  Check,
  Battery,
  ArrowRight,
  LayoutList,
  Rows3,
  CalendarClock,
} from 'lucide-react';
import {
  Accessory,
  Customer,
  DeviceModel,
  DynamicCatalog,
  InventoryTab,
  Smartphone,
  SmartphoneStatus,
} from '../types/crm';
import { StoreTemplate } from '../types/template';
import { REFERENCE_TODAY } from '../data/mockData';
import { templateRequiresImeiLuhn } from '../data/templates';
import {
  formatCurrencyBRL,
  formatDateBR,
  formatIMEI,
  getDaysRemaining,
  maskIMEI,
} from '../utils/imei';
import { downloadCSV } from '../services/crmService';
import {
  AuraButton,
  AuraChecklist,
  AuraToggle,
  StatusBadge,
  getAccessoryStockBadge,
  getSmartphoneStatusTone,
} from './ui/AuraPrimitives';
import { CreatableSelect } from './ui/CreatableSelect';

function formatCustomAttributeValue(val: unknown): string {
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  if (Array.isArray(val)) return val.join(', ');
  if (val === null || val === undefined) return '—';
  return String(val);
}

function formatStockQtyDisplay(qty?: number, unit?: string): string {
  const numeric = typeof qty === 'number' && !Number.isNaN(qty) ? qty : 1;
  const formatted = Number.isInteger(numeric)
    ? String(numeric)
    : numeric.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return `${formatted} ${unit?.trim() || 'un.'}`;
}

const RESTOCK_SHORTCUTS = [5, 10, 25, 50] as const;

interface InventoryViewProps {
  template: StoreTemplate;
  isAdmin: boolean;
  activeTab: InventoryTab;
  onTabChange: (tab: InventoryTab) => void;
  smartphones: Smartphone[];
  accessories: Accessory[];
  customers: Customer[];
  deviceModels: DeviceModel[];
  catalog: DynamicCatalog;
  onlyLowStock: boolean;
  onOnlyLowStockChange: (val: boolean) => void;
  selectedSmartphoneDetail: Smartphone | null;
  onSelectSmartphoneDetail: (sp: Smartphone | null) => void;
  onOpenAddModal: (mode: InventoryTab) => void;
  onRevealIMEI: (sp: Smartphone) => void;
  onBulkUpdateSmartphoneStatus: (ids: string[], status: SmartphoneStatus) => void;
  onUpdateSmartphonePrice: (smartphoneId: string, newPrice: number) => void;
  onToggleSmartphoneChecklist: (smartphoneId: string, itemId: string, checked: boolean) => void;
  onRestockSmartphones: (
    ids: string[],
    delta: number,
    opts?: { setAvailable?: boolean }
  ) => void;
  onRestockAccessory: (accessoryId: string, delta: number) => void;
  onRestockAccessoriesBulk: (ids: string[], delta: number) => void;
  onStartCheckoutWithSmartphone: (smartphoneId: string) => void;
  onNotify: (message: string, detail?: string) => void;
}

type SmartphoneSort = 'recent' | 'price-desc' | 'price-asc' | 'battery-desc';
type AccessorySort = 'stock-asc' | 'stock-desc' | 'price-desc' | 'name-asc';

export function InventoryView({
  template,
  isAdmin,
  activeTab,
  onTabChange,
  smartphones,
  accessories,
  customers,
  deviceModels,
  catalog,
  onlyLowStock,
  onOnlyLowStockChange,
  selectedSmartphoneDetail,
  onSelectSmartphoneDetail,
  onOpenAddModal,
  onRevealIMEI,
  onBulkUpdateSmartphoneStatus,
  onUpdateSmartphonePrice,
  onToggleSmartphoneChecklist,
  onRestockSmartphones,
  onRestockAccessory,
  onRestockAccessoriesBulk,
  onStartCheckoutWithSmartphone,
  onNotify,
}: InventoryViewProps) {
  const { labels, features } = template;
  const isPhoneSerialized = templateRequiresImeiLuhn(template);
  const supportsPrimaryStockQty = !features.hasSerializedItems;
  const [showStats, setShowStats] = React.useState(true);
  const [compactRows, setCompactRows] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Filters & Sorting
  const [statusFilter, setStatusFilter] = React.useState<'Todos' | SmartphoneStatus>('Todos');
  const [conditionFilter, setConditionFilter] = React.useState<string>('Todas');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('Todas');
  const [phoneSort, setPhoneSort] = React.useState<SmartphoneSort>('recent');
  const [accSort, setAccSort] = React.useState<AccessorySort>('stock-asc');

  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false);
  const [sortMenuOpen, setSortMenuOpen] = React.useState(false);
  const [editingPriceDraft, setEditingPriceDraft] = React.useState<string>('');

  // Quick stock replenishment state (Detail Drawer & Floating Bulk Bar)
  const [drawerRestockOpen, setDrawerRestockOpen] = React.useState(false);
  const [drawerRestockQty, setDrawerRestockQty] = React.useState<string>('10');
  const [drawerRestockSetAvailable, setDrawerRestockSetAvailable] = React.useState(true);

  const [bulkRestockOpen, setBulkRestockOpen] = React.useState(false);
  const [bulkRestockQty, setBulkRestockQty] = React.useState<string>('10');
  const [bulkRestockSetAvailable, setBulkRestockSetAvailable] = React.useState(true);

  // Row selection for floating bulk action bar (Image 6)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [bulkStatusMenuOpen, setBulkStatusMenuOpen] = React.useState(false);
  const [labelModalItems, setLabelModalItems] = React.useState<
    { title: string; subtitle: string; code: string; price: string }[] | null
  >(null);

  // Revealed IMEI map
  const [revealedImeiIds, setRevealedImeiIds] = React.useState<Record<string, boolean>>({});

  // Clear selection when switching tabs or stores
  React.useEffect(() => {
    setSelectedIds([]);
    setBulkStatusMenuOpen(false);
    setBulkRestockOpen(false);
  }, [activeTab]);

  React.useEffect(() => {
    setSearchQuery('');
    setStatusFilter('Todos');
    setConditionFilter('Todas');
    setCategoryFilter('Todas');
    setSelectedIds([]);
    setBulkStatusMenuOpen(false);
    setBulkRestockOpen(false);
    setDrawerRestockOpen(false);
    setEditingPriceDraft('');
    setPhoneSort('recent');
  }, [template.id]);

  React.useEffect(() => {
    setDrawerRestockOpen(false);
    setDrawerRestockQty('10');
    setDrawerRestockSetAvailable(true);
  }, [selectedSmartphoneDetail?.id]);

  const modelLabelMap = React.useMemo(
    () => new Map(deviceModels.map((m) => [m.id, m.tagLabel])),
    [deviceModels]
  );

  // Filtered & sorted primary items
  const filteredSmartphones = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return smartphones
      .filter((s) => {
        if (statusFilter !== 'Todos' && s.status !== statusFilter) return false;
        if (conditionFilter !== 'Todas' && s.condition !== conditionFilter) return false;
        if (!q) return true;
        const customStr = s.customAttributes
          ? Object.values(s.customAttributes)
              .map((v) => formatCustomAttributeValue(v))
              .join(' ')
              .toLowerCase()
          : '';
        return (
          s.model.toLowerCase().includes(q) ||
          s.brand.toLowerCase().includes(q) ||
          s.color.toLowerCase().includes(q) ||
          s.storage.toLowerCase().includes(q) ||
          s.sku.toLowerCase().includes(q) ||
          s.imei1.includes(q) ||
          s.serialNumber.toLowerCase().includes(q) ||
          customStr.includes(q)
        );
      })
      .sort((a, b) => {
        if (phoneSort === 'price-desc') return b.salePrice - a.salePrice;
        if (phoneSort === 'price-asc') return a.salePrice - b.salePrice;
        if (phoneSort === 'battery-desc') return b.batteryHealth - a.batteryHealth;
        return b.acquiredAt.localeCompare(a.acquiredAt);
      });
  }, [smartphones, statusFilter, conditionFilter, searchQuery, phoneSort]);

  // Filtered & sorted Accessories
  const filteredAccessories = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accessories
      .filter((a) => {
        if (categoryFilter !== 'Todas' && a.category !== categoryFilter) return false;
        if (onlyLowStock && a.stock > a.minStock) return false;
        if (!q) return true;
        const modelsStr = a.compatibleModelIds
          .map((id) => modelLabelMap.get(id) ?? id)
          .join(' ')
          .toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          a.sku.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          modelsStr.includes(q)
        );
      })
      .sort((a, b) => {
        if (accSort === 'stock-asc') return a.stock - b.stock;
        if (accSort === 'stock-desc') return b.stock - a.stock;
        if (accSort === 'price-desc') return b.price - a.price;
        return a.name.localeCompare(b.name);
      });
  }, [accessories, categoryFilter, onlyLowStock, searchQuery, accSort, modelLabelMap]);

  const currentVisibleIds =
    activeTab === 'smartphones'
      ? filteredSmartphones.map((s) => s.id)
      : filteredAccessories.map((a) => a.id);

  const allSelected =
    currentVisibleIds.length > 0 &&
    currentVisibleIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentVisibleIds);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // KPI metrics for collapsible Image 6 bar
  const phoneKpis = React.useMemo(() => {
    const available = smartphones.filter((s) => s.status === 'Disponível');
    const reserved = smartphones.filter((s) => s.status === 'Reservado');
    const inventoryValue = available.reduce((sum, s) => {
      const qty = supportsPrimaryStockQty ? (s.stockQty ?? 1) : 1;
      return qty > 0 ? sum + s.salePrice * qty : sum;
    }, 0);
    const totalAvailableUnits = supportsPrimaryStockQty
      ? available.reduce((sum, s) => sum + Math.max(0, s.stockQty ?? 1), 0)
      : available.length;
    const avgBattery =
      available.length > 0
        ? Math.round(
            available.reduce((sum, s) => sum + s.batteryHealth, 0) / available.length
          )
        : 0;
    const avgTicket =
      available.length > 0
        ? Math.round(
            available.reduce((sum, s) => sum + s.salePrice, 0) / available.length
          )
        : 0;
    const expiringCount =
      smartphones.filter(
        (s) => s.expiresAt && getDaysRemaining(s.expiresAt, REFERENCE_TODAY) <= 7
      ).length +
      accessories.filter(
        (a) => a.expiresAt && getDaysRemaining(a.expiresAt, REFERENCE_TODAY) <= 7
      ).length;

    const fourthKpi = isPhoneSerialized
      ? {
          label: 'Saúde Média de Bateria',
          value: `${avgBattery}%`,
          sub: `Padrão ${template.storeName} Grau A+`,
        }
      : features.hasExpirationDate
        ? {
            label: 'Validades Próximas (≤7d)',
            value: String(expiringCount),
            sub: expiringCount > 0 ? 'Atenção à validade de lote' : 'Lotes dentro do prazo',
          }
        : {
            label: 'Ticket Médio do Catálogo',
            value: formatCurrencyBRL(avgTicket),
            sub: `${available.length} item(ns) ativos`,
          };

    return [
      {
        label: `${labels.primaryTabName} Disponíveis`,
        value: String(available.length),
        sub: supportsPrimaryStockQty
          ? `${totalAvailableUnits.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} em estoque · ${smartphones.length} cadastrados`
          : `${smartphones.length} cadastrados no total`,
      },
      {
        label: isPhoneSerialized ? 'Valor em Vitrine' : 'Valor em Catálogo',
        value: formatCurrencyBRL(inventoryValue),
        sub: supportsPrimaryStockQty
          ? 'Disponíveis com estoque (> 0)'
          : 'Somente itens disponíveis',
      },
      {
        label: 'Reservados no Balcão',
        value: String(reserved.length),
        sub: 'Aguardando retirada',
      },
      fourthKpi,
    ];
  }, [
    smartphones,
    accessories,
    features,
    isPhoneSerialized,
    supportsPrimaryStockQty,
    labels.primaryTabName,
    template.storeName,
  ]);

  const accessoryKpis = React.useMemo(() => {
    const totalUnits = accessories.reduce((sum, a) => sum + a.stock, 0);
    const totalValue = accessories.reduce((sum, a) => sum + a.stock * a.price, 0);
    const lowCount = accessories.filter((a) => a.stock > 0 && a.stock <= a.minStock).length;
    const outCount = accessories.filter((a) => a.stock === 0).length;
    return [
      {
        label: 'SKUs Ativos',
        value: String(accessories.length),
        sub: `${totalUnits} unidades físicas`,
      },
      {
        label: `Valor em ${labels.secondaryTabName}`,
        value: formatCurrencyBRL(totalValue),
        sub: 'Preço de balcão atual',
      },
      {
        label: 'Abaixo do Mínimo',
        value: String(lowCount),
        sub: 'Sugestão de reposição',
      },
      {
        label: 'Itens Esgotados',
        value: String(outCount),
        sub: outCount > 0 ? 'Ação imediata necessária' : 'Nenhum item zerado',
      },
    ];
  }, [accessories, labels.secondaryTabName]);

  const handleExport = (onlySelected = false) => {
    const storeSlug = template.id.replace(/^store-/, '');
    if (activeTab === 'smartphones') {
      const target = onlySelected
        ? filteredSmartphones.filter((s) => selectedIds.includes(s.id))
        : filteredSmartphones;
      if (isPhoneSerialized) {
        downloadCSV(
          `${storeSlug}-itens.csv`,
          ['SKU', 'Marca', 'Modelo', 'Armazenamento', 'Cor', 'Condição', 'Bateria (%)', 'IMEI 1 (Mascarado)', 'Preço (R$)', 'Status'],
          target.map((s) => [
            s.sku,
            s.brand,
            s.model,
            s.storage,
            s.color,
            s.condition,
            s.batteryHealth,
            maskIMEI(s.imei1),
            s.salePrice,
            s.status,
          ])
        );
      } else {
        downloadCSV(
          `${storeSlug}-catalogo.csv`,
          ['SKU', 'Linha', 'Item', 'Categoria', 'Validade', 'Preço (R$)', 'Status'],
          target.map((s) => [
            s.sku,
            s.brand,
            s.model,
            s.condition,
            s.expiresAt ? formatDateBR(s.expiresAt) : '—',
            s.salePrice,
            s.status,
          ])
        );
      }
      onNotify(
        'Exportação concluída',
        `${target.length} registro(s) exportados em CSV.`
      );
    } else {
      const target = onlySelected
        ? filteredAccessories.filter((a) => selectedIds.includes(a.id))
        : filteredAccessories;
      downloadCSV(
        `${storeSlug}-secundarios.csv`,
        ['SKU', 'Produto', 'Categoria', 'Validade', 'Estoque', 'Mínimo', 'Preço (R$)'],
        target.map((a) => [
          a.sku,
          a.name,
          a.category,
          a.expiresAt ? formatDateBR(a.expiresAt) : '—',
          a.stock,
          a.minStock,
          a.price,
        ])
      );
      onNotify(
        'Exportação concluída',
        `${target.length} item(ns) exportados em CSV.`
      );
    }
  };

  const handlePrintLabels = () => {
    if (activeTab === 'smartphones') {
      const chosen = smartphones.filter((s) => selectedIds.includes(s.id));
      setLabelModalItems(
        chosen.map((s) => ({
          title:
            isPhoneSerialized && s.storage !== '—'
              ? `${s.model} · ${s.storage}`
              : s.model,
          subtitle: isPhoneSerialized
            ? `${s.color} · ${s.condition} · Bat. ${s.batteryHealth}%`
            : `${s.brand} · ${s.condition}${s.expiresAt ? ` · Val. ${formatDateBR(s.expiresAt)}` : ''}`,
          code: isPhoneSerialized
            ? `IMEI ${maskIMEI(s.imei1)} · ${s.sku}`
            : s.sku,
          price: formatCurrencyBRL(s.salePrice),
        }))
      );
    } else {
      const chosen = accessories.filter((a) => selectedIds.includes(a.id));
      setLabelModalItems(
        chosen.map((a) => ({
          title: a.name,
          subtitle: features.hasCompatibilityCrossSell
            ? `${a.category} · ${a.compatibleModelIds
                .slice(0, 2)
                .map((id) => modelLabelMap.get(id) ?? id)
                .join(', ')}`
            : `${a.category}${a.expiresAt ? ` · Val. ${formatDateBR(a.expiresAt)}` : ''}`,
          code: a.sku,
          price: formatCurrencyBRL(a.price),
        }))
      );
    }
  };

  const activeFilterCount =
    activeTab === 'smartphones'
      ? (statusFilter !== 'Todos' ? 1 : 0) + (conditionFilter !== 'Todas' ? 1 : 0)
      : (categoryFilter !== 'Todas' ? 1 : 0) + (onlyLowStock ? 1 : 0);

  const liveSelectedDetail = selectedSmartphoneDetail
    ? smartphones.find((s) => s.id === selectedSmartphoneDetail.id) ?? null
    : null;

  return (
    <div className="space-y-5 pb-20">
      {/* Page Title & Clean Underlined Tabs (Image 2 + Image 6) */}
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-[32px] leading-tight text-[#1F1E1B]">
              Estoque Inteligente
            </h1>
            <p className="text-sm text-[#6E6B63] mt-0.5">
              {isPhoneSerialized
                ? `Controle unitário por IMEI para ${labels.primaryTabName.toLowerCase()} e gestão por lote SKU para ${labels.secondaryTabName.toLowerCase()}.`
                : features.hasSerializedItems
                  ? `Controle individual por código único para ${labels.primaryTabName.toLowerCase()} e gestão por lote SKU para ${labels.secondaryTabName.toLowerCase()}.`
                  : features.hasExpirationDate
                    ? `Gestão de ${labels.primaryTabName.toLowerCase()} e controle de lote e validade para ${labels.secondaryTabName.toLowerCase()}.`
                    : `Catálogo completo de ${labels.primaryTabName.toLowerCase()} e controle de estoque para ${labels.secondaryTabName.toLowerCase()}.`}
            </p>
          </div>
        </div>

        {/* Clean Underlined Tabs */}
        <div className="flex items-center gap-7 border-b border-[#DFDDD3]" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'smartphones'}
            onClick={() => onTabChange('smartphones')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'smartphones'
                ? 'border-[#4F5A47] text-[#1F1E1B]'
                : 'border-transparent text-[#6E6B63] hover:text-[#1F1E1B]'
            }`}
          >
            {labels.primaryTabName}
            <span className="text-xs font-medium text-[#6E6B63] tabular-nums">
              ({smartphones.length})
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'accessories'}
            onClick={() => onTabChange('accessories')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'accessories'
                ? 'border-[#4F5A47] text-[#1F1E1B]'
                : 'border-transparent text-[#6E6B63] hover:text-[#1F1E1B]'
            }`}
          >
            {labels.secondaryTabName}
            <span className="text-xs font-medium text-[#6E6B63] tabular-nums">
              ({accessories.length})
            </span>
          </button>
        </div>
      </header>

      {/* Complete Image 6 Toolbar (Visualização, Filtrar, Ordenar, Mostrar Estatísticas, Exportar, + Cadastrar) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Visualização density button */}
          <AuraButton
            variant="outline"
            size="md"
            onClick={() => setCompactRows((v) => !v)}
            title="Alternar densidade da tabela"
          >
            {compactRows ? (
              <LayoutList className="h-3.5 w-3.5 text-[#6E6B63]" />
            ) : (
              <Rows3 className="h-3.5 w-3.5 text-[#6E6B63]" />
            )}
            {compactRows ? 'Compacta' : 'Visualização'}
          </AuraButton>

          {/* Filtrar button + Popover */}
          <div className="relative">
            <AuraButton
              variant={activeFilterCount > 0 ? 'secondary' : 'outline'}
              size="md"
              onClick={() => {
                setFilterPanelOpen((v) => !v);
                setSortMenuOpen(false);
              }}
              aria-expanded={filterPanelOpen}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#4F5A47]" />
              Filtrar
              {activeFilterCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center h-4.5 min-w-[18px] px-1 rounded-full bg-[#4F5A47] text-white text-[10px] tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </AuraButton>

            {filterPanelOpen && (
              <div className="absolute left-0 top-11 z-30 w-72 bg-white border border-[#E5E2D9] rounded-2xl shadow-lg p-4 space-y-3.5">
                {activeTab === 'smartphones' ? (
                  <>
                    <CreatableSelect
                      id="filter-phone-status"
                      label="Status"
                      size="sm"
                      creatable={false}
                      value={statusFilter}
                      searchPlaceholder="Filtrar status..."
                      options={[
                        { value: 'Todos', label: 'Todos os status' },
                        { value: 'Disponível', label: 'Disponível' },
                        { value: 'Reservado', label: 'Reservado' },
                        { value: 'Em Avaliação', label: 'Em Avaliação' },
                        { value: 'Vendido', label: 'Vendido' },
                      ]}
                      onChange={(val) =>
                        setStatusFilter(val as 'Todos' | SmartphoneStatus)
                      }
                    />
                    <CreatableSelect
                      id="filter-phone-cond"
                      label="Condição"
                      size="sm"
                      creatable={false}
                      value={conditionFilter}
                      searchPlaceholder="Filtrar condição..."
                      options={[
                        { value: 'Todas', label: 'Todas as condições' },
                        ...catalog.conditions.map((c) => ({ value: c, label: c })),
                      ]}
                      onChange={setConditionFilter}
                    />
                  </>
                ) : (
                  <>
                    <CreatableSelect
                      id="filter-acc-cat"
                      label="Categoria"
                      size="sm"
                      creatable={false}
                      value={categoryFilter}
                      searchPlaceholder="Filtrar categoria..."
                      options={[
                        { value: 'Todas', label: 'Todas as categorias' },
                        ...catalog.accessoryCategories.map((c) => ({
                          value: c,
                          label: c,
                        })),
                      ]}
                      onChange={setCategoryFilter}
                    />
                    <div className="pt-1">
                      <AuraToggle
                        id="filter-low-stock-toggle"
                        label="Somente estoque baixo"
                        checked={onlyLowStock}
                        onChange={onOnlyLowStockChange}
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-[#EFECE6]">
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('Todos');
                      setConditionFilter('Todas');
                      setCategoryFilter('Todas');
                      onOnlyLowStockChange(false);
                    }}
                    className="text-xs text-[#6E6B63] hover:text-[#1F1E1B] cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                  <AuraButton
                    variant="primary"
                    size="sm"
                    onClick={() => setFilterPanelOpen(false)}
                  >
                    Aplicar
                  </AuraButton>
                </div>
              </div>
            )}
          </div>

          {/* Ordenar button + Dropdown */}
          <div className="relative">
            <AuraButton
              variant="outline"
              size="md"
              onClick={() => {
                setSortMenuOpen((v) => !v);
                setFilterPanelOpen(false);
              }}
              aria-expanded={sortMenuOpen}
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-[#6E6B63]" />
              Ordenar
            </AuraButton>

            {sortMenuOpen && (
              <div className="absolute left-0 top-11 z-30 w-52 bg-white border border-[#E5E2D9] rounded-xl shadow-lg p-1.5">
                {activeTab === 'smartphones'
                  ? (
                      [
                        ['recent', 'Mais recentes'],
                        ['price-desc', 'Maior preço'],
                        ['price-asc', 'Menor preço'],
                        ...(isPhoneSerialized
                          ? ([['battery-desc', 'Maior saúde de bateria']] as [
                              SmartphoneSort,
                              string,
                            ][])
                          : []),
                      ] as [SmartphoneSort, string][]
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setPhoneSort(key);
                          setSortMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer ${
                          phoneSort === key
                            ? 'bg-[#F4F2EC] text-[#1F1E1B] font-medium'
                            : 'text-[#4A4842] hover:bg-[#FAF9F6]'
                        }`}
                      >
                        {label}
                        {phoneSort === key && <Check className="h-3.5 w-3.5 text-[#4F5A47]" />}
                      </button>
                    ))
                  : (
                      [
                        ['stock-asc', 'Menor estoque primeiro'],
                        ['stock-desc', 'Maior estoque primeiro'],
                        ['price-desc', 'Maior preço'],
                        ['name-asc', 'Ordem alfabética'],
                      ] as [AccessorySort, string][]
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setAccSort(key);
                          setSortMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer ${
                          accSort === key
                            ? 'bg-[#F4F2EC] text-[#1F1E1B] font-medium'
                            : 'text-[#4A4842] hover:bg-[#FAF9F6]'
                        }`}
                      >
                        {label}
                        {accSort === key && <Check className="h-3.5 w-3.5 text-[#4F5A47]" />}
                      </button>
                    ))}
              </div>
            )}
          </div>

          {/* Image 6 Tactile Toggle: Mostrar Estatísticas */}
          <div className="pl-2 flex items-center">
            <AuraToggle
              id="toggle-show-statistics"
              label="Mostrar Estatísticas"
              checked={showStats}
              onChange={setShowStats}
            />
          </div>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <Search className="h-3.5 w-3.5 text-[#8C887E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'smartphones'
                  ? isPhoneSerialized
                    ? 'Filtrar modelo, IMEI ou cor...'
                    : `Filtrar ${labels.primaryItemSingular.toLowerCase()}, SKU ou atributo...`
                  : `Filtrar SKU, ${labels.secondaryItemSingular.toLowerCase()} ou categoria...`
              }
              aria-label="Filtrar tabela de estoque"
              className="h-9 pl-8 pr-3 w-56 rounded-xl bg-white border border-[#D4D0C5] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
            />
          </div>

          <AuraButton variant="outline" size="md" onClick={() => handleExport(false)}>
            <Download className="h-3.5 w-3.5 text-[#6E6B63]" />
            Exportar
          </AuraButton>

          <AuraButton
            variant="primary"
            size="md"
            onClick={() => onOpenAddModal(activeTab)}
          >
            <Plus className="h-4 w-4" />
            Cadastrar
          </AuraButton>
        </div>
      </div>

      {/* Collapsible 4-KPI Strip (Image 6 unified strip, toggled by Mostrar Estatísticas) */}
      {showStats && (
        <section
          aria-label="Estatísticas do estoque"
          data-testid="inventory-kpi-strip"
          className="bg-white border border-[#E5E2D9] rounded-2xl shadow-[0_1px_2px_rgba(28,25,23,0.03)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EFECE6]"
        >
          {(activeTab === 'smartphones' ? phoneKpis : accessoryKpis).map((kpi) => (
            <div key={kpi.label} className="p-4 sm:p-5">
              <p className="text-xs font-medium text-[#6E6B63]">{kpi.label}</p>
              <p className="text-2xl font-semibold text-[#1F1E1B] tabular-nums mt-1.5 leading-tight">
                {kpi.value}
              </p>
              <p className="text-xs text-[#7A776E] mt-1">{kpi.sub}</p>
            </div>
          ))}
        </section>
      )}

      {/* Mobile inline search */}
      <div className="relative md:hidden">
        <Search className="h-3.5 w-3.5 text-[#8C887E] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar no estoque..."
          aria-label="Buscar no estoque"
          className="w-full h-9 pl-8 pr-3 rounded-xl bg-white border border-[#D4D0C5] text-xs text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
        />
      </div>

      {/* Data Table Surface (Image 6 layout in Image 5 editorial skin) */}
      <div className="bg-white border border-[#E5E2D9] rounded-2xl shadow-[0_1px_2px_rgba(28,25,23,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'smartphones' ? (
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-[#E5E2D9] bg-[#FAF9F6] text-[11px] font-medium text-[#6E6B63]">
                  <th className="w-11 pl-4 pr-2 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label={`Selecionar todos (${labels.primaryTabName})`}
                      className="h-4 w-4 rounded border-[#C9C5B9] accent-[#4F5A47] cursor-pointer align-middle"
                    />
                  </th>
                  <th className="px-3 py-3">{labels.primaryItemSingular}</th>
                  <th className="px-3 py-3">
                    {isPhoneSerialized ? 'Condição' : 'Linha / Categoria'}
                  </th>
                  <th className="px-3 py-3">
                    {isPhoneSerialized ? 'Saúde da Bateria' : 'Atributos'}
                  </th>
                  <th className="px-3 py-3">
                    {isPhoneSerialized
                      ? 'IMEI 1'
                      : features.hasExpirationDate
                        ? 'Validade / Lote'
                        : 'Referência'}
                  </th>
                  {supportsPrimaryStockQty && (
                    <th className="px-3 py-3 text-right">Estoque</th>
                  )}
                  <th className="px-3 py-3 text-right">Preço de Venda</th>
                  <th className="pl-3 pr-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE6] text-[13px]">
                {filteredSmartphones.map((sp) => {
                  const checked = selectedIds.includes(sp.id);
                  const isRevealed = Boolean(revealedImeiIds[sp.id]);
                  const attrEntries = template.primaryFields
                    .map((field) => {
                      const raw = sp.customAttributes?.[field.key];
                      if (
                        raw === undefined ||
                        raw === null ||
                        raw === '' ||
                        (Array.isArray(raw) && raw.length === 0)
                      ) {
                        return null;
                      }
                      return {
                        key: field.key,
                        label: field.label,
                        value: formatCustomAttributeValue(raw),
                      };
                    })
                    .filter(Boolean) as { key: string; label: string; value: string }[];
                  const expDays = sp.expiresAt
                    ? getDaysRemaining(sp.expiresAt, REFERENCE_TODAY)
                    : null;

                  return (
                    <tr
                      key={sp.id}
                      onClick={() => onSelectSmartphoneDetail(sp)}
                      className={`transition-colors cursor-pointer ${
                        checked ? 'bg-[#F4F6F1]' : 'hover:bg-[#FAF9F6]'
                      }`}
                    >
                      <td
                        className={`pl-4 pr-2 ${compactRows ? 'py-2.5' : 'py-3.5'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectOne(sp.id)}
                          aria-label={`Selecionar ${sp.model}`}
                          className="h-4 w-4 rounded border-[#C9C5B9] accent-[#4F5A47] cursor-pointer align-middle"
                        />
                      </td>
                      <td className={`px-3 ${compactRows ? 'py-2.5' : 'py-3.5'}`}>
                        <p className="font-medium text-[#1F1E1B]">
                          {isPhoneSerialized
                            ? `${sp.brand} ${sp.model} · ${sp.storage}`
                            : sp.model}
                        </p>
                        <p className="text-xs text-[#6E6B63]">
                          {isPhoneSerialized
                            ? `${sp.color} · `
                            : sp.brand
                              ? `${sp.brand} · `
                              : ''}
                          <span className="font-mono text-[11px]">{sp.sku}</span>
                        </p>
                      </td>
                      <td className={`px-3 ${compactRows ? 'py-2.5' : 'py-3.5'} text-xs text-[#4A4842]`}>
                        {sp.condition}
                      </td>
                      <td className={`px-3 ${compactRows ? 'py-2.5' : 'py-3.5'}`}>
                        {isPhoneSerialized ? (
                          <div className="flex items-center gap-2.5">
                            <div className="w-16 h-1.5 rounded-full bg-[#ECEAE2] overflow-hidden">
                              <div
                                style={{ width: `${sp.batteryHealth}%` }}
                                className={`h-full rounded-full ${
                                  sp.batteryHealth >= 92
                                    ? 'bg-[#4F5A47]'
                                    : sp.batteryHealth >= 85
                                      ? 'bg-[#B3741E]'
                                      : 'bg-[#9B3B2B]'
                                }`}
                              />
                            </div>
                            <span className="text-xs font-medium tabular-nums text-[#1F1E1B]">
                              {sp.batteryHealth}%
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                            {attrEntries.slice(0, 3).map((attr) => (
                              <span
                                key={attr.key}
                                title={`${attr.label}: ${attr.value}`}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-[#EFECE6] text-[#4A4842] truncate max-w-[140px]"
                              >
                                {attr.value}
                              </span>
                            ))}
                            {attrEntries.length === 0 && (
                              <span className="text-xs text-[#8C887E]">—</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td
                        className={`px-3 ${compactRows ? 'py-2.5' : 'py-3.5'}`}
                        onClick={(e) => {
                          if (isPhoneSerialized) e.stopPropagation();
                        }}
                      >
                        {isPhoneSerialized ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="font-mono text-xs text-[#2C2A25]">
                              {isRevealed ? formatIMEI(sp.imei1) : maskIMEI(sp.imei1)}
                            </span>
                            <button
                              type="button"
                              aria-label={
                                isRevealed
                                  ? `Ocultar IMEI de ${sp.model}`
                                  : `Revelar IMEI de ${sp.model}`
                              }
                              onClick={() => {
                                const next = !isRevealed;
                                setRevealedImeiIds((prev) => ({ ...prev, [sp.id]: next }));
                                if (next) onRevealIMEI(sp);
                              }}
                              className="p-1 rounded-md text-[#6E6B63] hover:text-[#1F1E1B] hover:bg-[#ECEAE2] transition-colors cursor-pointer"
                            >
                              {isRevealed ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        ) : features.hasExpirationDate && sp.expiresAt ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="text-xs tabular-nums text-[#2C2A25]">
                              {formatDateBR(sp.expiresAt)}
                            </span>
                            {expDays !== null && expDays <= 3 && (
                              <StatusBadge
                                label={expDays <= 0 ? 'Vencido' : `${expDays}d`}
                                tone={expDays <= 0 ? 'terracotta' : 'amber'}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-[#6E6B63]">
                            {sp.serialNumber}
                          </span>
                        )}
                      </td>
                      {supportsPrimaryStockQty && (
                        <td
                          className={`px-3 ${compactRows ? 'py-2.5' : 'py-3.5'} text-right whitespace-nowrap`}
                        >
                          <span
                            className={`text-xs font-medium tabular-nums ${
                              (sp.stockQty ?? 1) <= 0
                                ? 'text-[#9B3B2B]'
                                : 'text-[#1F1E1B]'
                            }`}
                          >
                            {formatStockQtyDisplay(sp.stockQty, sp.stockUnit)}
                          </span>
                        </td>
                      )}
                      <td
                        className={`px-3 ${compactRows ? 'py-2.5' : 'py-3.5'} text-right font-medium tabular-nums text-[#1F1E1B]`}
                      >
                        {formatCurrencyBRL(sp.salePrice)}
                      </td>
                      <td className={`pl-3 pr-5 ${compactRows ? 'py-2.5' : 'py-3.5'} text-right`}>
                        <StatusBadge
                          label={sp.status}
                          tone={getSmartphoneStatusTone(sp.status)}
                        />
                      </td>
                    </tr>
                  );
                })}

                {filteredSmartphones.length === 0 && (
                  <tr>
                    <td
                      colSpan={supportsPrimaryStockQty ? 8 : 7}
                      className="py-12 text-center text-sm text-[#6E6B63]"
                    >
                      Nenhum item encontrado em {labels.primaryTabName} com os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-[#E5E2D9] bg-[#FAF9F6] text-[11px] font-medium text-[#6E6B63]">
                  <th className="w-11 pl-4 pr-2 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label={`Selecionar todos (${labels.secondaryTabName})`}
                      className="h-4 w-4 rounded border-[#C9C5B9] accent-[#4F5A47] cursor-pointer align-middle"
                    />
                  </th>
                  <th className="px-3 py-3">SKU</th>
                  <th className="px-3 py-3">Produto & Categoria</th>
                  <th className="px-3 py-3">
                    {features.hasCompatibilityCrossSell
                      ? 'Modelos Compatíveis'
                      : features.hasExpirationDate
                        ? 'Validade do Lote'
                        : 'Fabricante / Origem'}
                  </th>
                  <th className="px-3 py-3 text-right">Estoque / Mín.</th>
                  <th className="px-3 py-3 text-right">Preço</th>
                  <th className="pl-3 pr-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE6] text-[13px]">
                {filteredAccessories.map((acc) => {
                  const checked = selectedIds.includes(acc.id);
                  const badge = getAccessoryStockBadge(acc.stock, acc.minStock);
                  const accExpDays = acc.expiresAt
                    ? getDaysRemaining(acc.expiresAt, REFERENCE_TODAY)
                    : null;

                  return (
                    <tr
                      key={acc.id}
                      className={`transition-colors ${
                        checked ? 'bg-[#F4F6F1]' : 'hover:bg-[#FAF9F6]'
                      }`}
                    >
                      <td className={`pl-4 pr-2 ${compactRows ? 'py-2.5' : 'py-3.5'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectOne(acc.id)}
                          aria-label={`Selecionar ${acc.name}`}
                          className="h-4 w-4 rounded border-[#C9C5B9] accent-[#4F5A47] cursor-pointer align-middle"
                        />
                      </td>
                      <td
                        className={`px-3 ${compactRows ? 'py-2.5' : 'py-3.5'} font-mono text-xs text-[#4A4842] whitespace-nowrap`}
                      >
                        {acc.sku}
                      </td>
                      <td className={`px-3 ${compactRows ? 'py-2.5' : 'py-3.5'}`}>
                        <p className="font-medium text-[#1F1E1B]">{acc.name}</p>
                        <p className="text-xs text-[#6E6B63]">
                          {acc.category}
                          {acc.brand ? ` · ${acc.brand}` : ''}
                        </p>
                      </td>
                      <td className={`px-3 ${compactRows ? 'py-2.5' : 'py-3.5'}`}>
                        {features.hasCompatibilityCrossSell ? (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {acc.compatibleModelIds.slice(0, 3).map((modelId) => (
                              <span
                                key={modelId}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-[#EFECE6] text-[#4A4842] whitespace-nowrap"
                              >
                                {modelLabelMap.get(modelId) ?? modelId}
                              </span>
                            ))}
                            {acc.compatibleModelIds.length > 3 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-[#E8E3D9] text-[#2C2A25] tabular-nums">
                                +{acc.compatibleModelIds.length - 3}
                              </span>
                            )}
                          </div>
                        ) : features.hasExpirationDate ? (
                          acc.expiresAt ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="text-xs tabular-nums text-[#2C2A25]">
                                {formatDateBR(acc.expiresAt)}
                              </span>
                              {accExpDays !== null && accExpDays <= 7 && (
                                <StatusBadge
                                  label={
                                    accExpDays <= 0
                                      ? 'Vencido'
                                      : `Vence em ${accExpDays}d`
                                  }
                                  tone={accExpDays <= 1 ? 'terracotta' : 'amber'}
                                />
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-[#8C887E]">Sem validade</span>
                          )
                        ) : (
                          <span className="text-xs text-[#6E6B63]">
                            {acc.brand || acc.ean || acc.category}
                          </span>
                        )}
                      </td>
                      <td className={`px-3 ${compactRows ? 'py-2.5' : 'py-3.5'} text-right`}>
                        <div className="inline-flex items-center gap-2">
                          <span className="tabular-nums font-medium text-[#1F1E1B]">
                            {acc.stock}{' '}
                            <span className="text-xs font-normal text-[#8C887E]">
                              / {acc.minStock}
                            </span>
                          </span>
                          {acc.stock <= acc.minStock && (
                            <button
                              type="button"
                              onClick={() => onRestockAccessory(acc.id, 5)}
                              aria-label={`Repor 5 unidades de ${acc.name}`}
                              className="px-2 py-0.5 rounded-md bg-[#E8E3D9] hover:bg-[#DDD7CA] text-[11px] font-medium text-[#2C2A25] cursor-pointer"
                            >
                              +5
                            </button>
                          )}
                        </div>
                      </td>
                      <td
                        className={`px-3 ${compactRows ? 'py-2.5' : 'py-3.5'} text-right font-medium tabular-nums text-[#1F1E1B]`}
                      >
                        {formatCurrencyBRL(acc.price)}
                      </td>
                      <td className={`pl-3 pr-5 ${compactRows ? 'py-2.5' : 'py-3.5'} text-right`}>
                        <StatusBadge label={badge.label} tone={badge.tone} />
                      </td>
                    </tr>
                  );
                })}

                {filteredAccessories.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-[#6E6B63]">
                      Nenhum item encontrado em {labels.secondaryTabName} com os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Floating Bulk Actions Bar (Image 6 signature bar, olive/stone aesthetic) */}
      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label="Ações em lote"
          className="fixed bottom-6 left-1/2 lg:left-[calc(50%+132px)] -translate-x-1/2 z-40 bg-white border border-[#D4D0C5] rounded-2xl shadow-xl px-4 py-2.5 flex items-center gap-2 sm:gap-3 no-print max-w-[94vw]"
        >
          <span className="text-xs sm:text-[13px] font-semibold text-[#1F1E1B] tabular-nums px-1.5 whitespace-nowrap">
            {selectedIds.length} selecionado{selectedIds.length === 1 ? '' : 's'}
          </span>

          <div className="h-5 w-px bg-[#E5E2D9]" />

          {activeTab === 'smartphones' ? (
            <>
              {supportsPrimaryStockQty && (
                <div className="relative">
                  <AuraButton
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setBulkRestockOpen((v) => !v);
                      setBulkStatusMenuOpen(false);
                    }}
                    aria-expanded={bulkRestockOpen}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Repor Estoque
                  </AuraButton>
                  {bulkRestockOpen && (
                    <div
                      role="dialog"
                      aria-label="Repor estoque em lote"
                      className="absolute bottom-12 left-0 w-72 bg-white border border-[#E5E2D9] rounded-2xl shadow-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-[#1F1E1B]">
                          Repor Estoque ({selectedIds.length})
                        </p>
                        <button
                          type="button"
                          onClick={() => setBulkRestockOpen(false)}
                          aria-label="Fechar reposição em lote"
                          className="p-1 rounded-md text-[#6E6B63] hover:bg-[#EFECE6] cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div>
                        <label
                          htmlFor="bulk-restock-qty"
                          className="block text-[11px] font-medium text-[#6E6B63] mb-1"
                        >
                          Quantidade a adicionar
                        </label>
                        <input
                          id="bulk-restock-qty"
                          type="number"
                          min={0.1}
                          step="any"
                          value={bulkRestockQty}
                          onChange={(e) => setBulkRestockQty(e.target.value)}
                          className="w-full h-9 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm tabular-nums text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {RESTOCK_SHORTCUTS.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setBulkRestockQty(String(amt))}
                            className={`flex-1 h-7 rounded-lg text-xs font-medium tabular-nums border transition-colors cursor-pointer ${
                              Number(bulkRestockQty) === amt
                                ? 'bg-[#4F5A47] text-white border-[#4F5A47]'
                                : 'bg-[#FAF9F6] text-[#2C2A25] border-[#DDDAD0] hover:bg-[#EFECE6]'
                            }`}
                          >
                            +{amt}
                          </button>
                        ))}
                      </div>

                      <label className="flex items-center gap-2 text-xs text-[#2C2A25] cursor-pointer select-none pt-0.5">
                        <input
                          type="checkbox"
                          checked={bulkRestockSetAvailable}
                          onChange={(e) => setBulkRestockSetAvailable(e.target.checked)}
                          className="h-4 w-4 rounded border-[#C9C5B9] accent-[#4F5A47] cursor-pointer"
                        />
                        <span>Definir status como Disponível</span>
                      </label>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#EFECE6]">
                        <AuraButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setBulkRestockOpen(false)}
                        >
                          Cancelar
                        </AuraButton>
                        <AuraButton
                          variant="primary"
                          size="sm"
                          disabled={!Number(bulkRestockQty) || Number(bulkRestockQty) <= 0}
                          onClick={() => {
                            const delta = Number(bulkRestockQty);
                            if (delta > 0) {
                              onRestockSmartphones(selectedIds, delta, {
                                setAvailable: bulkRestockSetAvailable,
                              });
                              setBulkRestockOpen(false);
                              setSelectedIds([]);
                            }
                          }}
                        >
                          Confirmar
                        </AuraButton>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="relative">
                <AuraButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setBulkStatusMenuOpen((v) => !v);
                    setBulkRestockOpen(false);
                  }}
                >
                  <Tag className="h-3.5 w-3.5" />
                  Alterar Status
                </AuraButton>
                {bulkStatusMenuOpen && (
                  <div className="absolute bottom-11 left-0 w-48 bg-white border border-[#E5E2D9] rounded-xl shadow-lg p-1.5">
                    {(
                      [
                        'Disponível',
                        'Reservado',
                        'Em Avaliação',
                        'Vendido',
                      ] as SmartphoneStatus[]
                    ).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          onBulkUpdateSmartphoneStatus(selectedIds, st);
                          setBulkStatusMenuOpen(false);
                          setSelectedIds([]);
                        }}
                        className="w-full text-left px-3 py-2 text-xs rounded-lg text-[#1F1E1B] hover:bg-[#F4F2EC] cursor-pointer"
                      >
                        Marcar como {st}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="relative">
              <AuraButton
                variant="primary"
                size="sm"
                onClick={() => setBulkRestockOpen((v) => !v)}
                aria-expanded={bulkRestockOpen}
              >
                <Plus className="h-3.5 w-3.5" />
                Repor Estoque
              </AuraButton>
              {bulkRestockOpen && (
                <div
                  role="dialog"
                  aria-label="Repor estoque em lote"
                  className="absolute bottom-12 left-0 w-72 bg-white border border-[#E5E2D9] rounded-2xl shadow-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#1F1E1B]">
                      Repor Estoque ({selectedIds.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => setBulkRestockOpen(false)}
                      aria-label="Fechar reposição em lote"
                      className="p-1 rounded-md text-[#6E6B63] hover:bg-[#EFECE6] cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div>
                    <label
                      htmlFor="bulk-acc-restock-qty"
                      className="block text-[11px] font-medium text-[#6E6B63] mb-1"
                    >
                      Quantidade a adicionar (un.)
                    </label>
                    <input
                      id="bulk-acc-restock-qty"
                      type="number"
                      min={1}
                      step={1}
                      value={bulkRestockQty}
                      onChange={(e) => setBulkRestockQty(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm tabular-nums text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {RESTOCK_SHORTCUTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBulkRestockQty(String(amt))}
                        className={`flex-1 h-7 rounded-lg text-xs font-medium tabular-nums border transition-colors cursor-pointer ${
                          Number(bulkRestockQty) === amt
                            ? 'bg-[#4F5A47] text-white border-[#4F5A47]'
                            : 'bg-[#FAF9F6] text-[#2C2A25] border-[#DDDAD0] hover:bg-[#EFECE6]'
                        }`}
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#EFECE6]">
                    <AuraButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setBulkRestockOpen(false)}
                    >
                      Cancelar
                    </AuraButton>
                    <AuraButton
                      variant="primary"
                      size="sm"
                      disabled={!Number(bulkRestockQty) || Number(bulkRestockQty) <= 0}
                      onClick={() => {
                        const delta = Math.round(Number(bulkRestockQty));
                        if (delta > 0) {
                          onRestockAccessoriesBulk(selectedIds, delta);
                          setBulkRestockOpen(false);
                          setSelectedIds([]);
                        }
                      }}
                    >
                      Confirmar
                    </AuraButton>
                  </div>
                </div>
              )}
            </div>
          )}

          <AuraButton variant="outline" size="sm" onClick={handlePrintLabels}>
            <Printer className="h-3.5 w-3.5" />
            Imprimir Etiqueta
          </AuraButton>

          <AuraButton variant="outline" size="sm" onClick={() => handleExport(true)}>
            <Download className="h-3.5 w-3.5" />
            Exportar
          </AuraButton>

          <button
            type="button"
            onClick={() => {
              setSelectedIds([]);
              setBulkRestockOpen(false);
              setBulkStatusMenuOpen(false);
            }}
            aria-label="Limpar seleção"
            className="p-1.5 rounded-lg text-[#6E6B63] hover:bg-[#EFECE6] hover:text-[#1F1E1B] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Device Detail Drawer */}
      {liveSelectedDetail && (
        <div
          className="fixed inset-0 z-50 bg-[#1F1E1B]/35 backdrop-blur-[2px] flex justify-end no-print"
          onClick={() => onSelectSmartphoneDetail(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Detalhes de ${liveSelectedDetail.model}`}
            className="w-full max-w-lg bg-[#F4F2EC] h-full shadow-2xl border-l border-[#DFDDD3] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 bg-white border-b border-[#E5E2D9] flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-[#6E6B63]">
                    {liveSelectedDetail.sku}
                  </span>
                  <StatusBadge
                    label={liveSelectedDetail.status}
                    tone={getSmartphoneStatusTone(liveSelectedDetail.status)}
                  />
                </div>
                <h2 className="font-serif text-2xl text-[#1F1E1B] leading-tight">
                  {isPhoneSerialized
                    ? `${liveSelectedDetail.brand} ${liveSelectedDetail.model}`
                    : liveSelectedDetail.model}
                </h2>
                <p className="text-xs text-[#6E6B63] mt-0.5">
                  {isPhoneSerialized
                    ? `${liveSelectedDetail.storage} · ${liveSelectedDetail.color} · ${liveSelectedDetail.condition}`
                    : `${liveSelectedDetail.brand} · ${liveSelectedDetail.condition}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectSmartphoneDetail(null)}
                aria-label="Fechar detalhes do item"
                className="p-1.5 rounded-lg text-[#6E6B63] hover:bg-[#EFECE6] cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Pricing & Secondary Summary (Cost/Margin visible ONLY to ADMIN) */}
              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[#6E6B63]">Preço de Balcão</p>
                    <p className="text-xl font-semibold text-[#1F1E1B] tabular-nums mt-0.5">
                      {formatCurrencyBRL(liveSelectedDetail.salePrice)}
                    </p>
                    <p className="text-[11px] text-[#7A776E] tabular-nums mt-0.5">
                      Entrada em {formatDateBR(liveSelectedDetail.acquiredAt)}
                    </p>
                  </div>
                  {isPhoneSerialized ? (
                    <div>
                      <p className="text-xs text-[#6E6B63]">Saúde da Bateria</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Battery className="h-4.5 w-4.5 text-[#4F5A47]" />
                        <span className="text-xl font-semibold text-[#1F1E1B] tabular-nums">
                          {liveSelectedDetail.batteryHealth}%
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7A776E] tabular-nums mt-0.5">
                        {typeof liveSelectedDetail.batteryCycles === 'number'
                          ? `${liveSelectedDetail.batteryCycles} ciclos registrados`
                          : 'Verificado em bancada'}
                      </p>
                    </div>
                  ) : supportsPrimaryStockQty ? (
                    <div>
                      <p className="text-xs text-[#6E6B63]">Quantidade em Estoque</p>
                      <p
                        className={`text-xl font-semibold tabular-nums mt-0.5 ${
                          (liveSelectedDetail.stockQty ?? 1) <= 0
                            ? 'text-[#9B3B2B]'
                            : 'text-[#1F1E1B]'
                        }`}
                      >
                        {formatStockQtyDisplay(
                          liveSelectedDetail.stockQty,
                          liveSelectedDetail.stockUnit
                        )}
                      </p>
                      <p className="text-[11px] text-[#7A776E] tabular-nums mt-0.5">
                        Total:{' '}
                        {formatCurrencyBRL(
                          liveSelectedDetail.salePrice *
                            Math.max(0, liveSelectedDetail.stockQty ?? 1)
                        )}
                      </p>
                    </div>
                  ) : features.hasExpirationDate ? (
                    <div>
                      <p className="text-xs text-[#6E6B63]">Validade do Lote</p>
                      <div className="flex items-center gap-2 mt-1">
                        <CalendarClock className="h-4.5 w-4.5 text-[#4F5A47]" />
                        <span className="text-base font-semibold text-[#1F1E1B] tabular-nums">
                          {liveSelectedDetail.expiresAt
                            ? formatDateBR(liveSelectedDetail.expiresAt)
                            : 'Sem vencimento'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7A776E] mt-0.5">
                        Controle de validade ativo
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-[#6E6B63]">Categoria / Linha</p>
                      <p className="text-base font-semibold text-[#1F1E1B] mt-1">
                        {liveSelectedDetail.condition}
                      </p>
                      <p className="text-[11px] text-[#7A776E] mt-0.5">
                        {template.segment}
                      </p>
                    </div>
                  )}
                </div>

                {supportsPrimaryStockQty && features.hasExpirationDate && (
                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-[#EFECE6]">
                    <span className="text-[#6E6B63] inline-flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5 text-[#4F5A47]" />
                      Validade do Lote
                    </span>
                    <span className="font-medium text-[#1F1E1B] tabular-nums">
                      {liveSelectedDetail.expiresAt
                        ? formatDateBR(liveSelectedDetail.expiresAt)
                        : 'Sem vencimento'}
                    </span>
                  </div>
                )}

                {(isAdmin || supportsPrimaryStockQty) && (
                  <div className="pt-3 border-t border-[#EFECE6] space-y-2.5">
                    {isAdmin && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#6E6B63]">
                          Custo de Entrada:{' '}
                          <strong className="text-[#1F1E1B] tabular-nums">
                            {formatCurrencyBRL(liveSelectedDetail.costPrice)}
                          </strong>
                        </span>
                        <span className="font-medium text-[#2E472D] tabular-nums">
                          Margem:{' '}
                          {formatCurrencyBRL(
                            liveSelectedDetail.salePrice - liveSelectedDetail.costPrice
                          )}{' '}
                          (
                          {liveSelectedDetail.salePrice > 0
                            ? Math.round(
                                ((liveSelectedDetail.salePrice -
                                  liveSelectedDetail.costPrice) /
                                  liveSelectedDetail.salePrice) *
                                  100
                              )
                            : 0}
                          %)
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {isAdmin && (
                        <>
                          <input
                            type="number"
                            min={0.01}
                            step="any"
                            value={editingPriceDraft}
                            onChange={(e) => setEditingPriceDraft(e.target.value)}
                            placeholder="Novo preço (R$)"
                            aria-label="Atualizar preço de venda"
                            className="flex-1 min-w-[120px] h-8 px-2.5 rounded-lg bg-[#FAF9F6] border border-[#DDDAD0] text-xs tabular-nums text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                          />
                          <AuraButton
                            variant="secondary"
                            size="sm"
                            disabled={!Number(editingPriceDraft)}
                            onClick={() => {
                              const parsed = Number(editingPriceDraft);
                              if (parsed > 0) {
                                onUpdateSmartphonePrice(liveSelectedDetail.id, parsed);
                                setEditingPriceDraft('');
                              }
                            }}
                          >
                            Atualizar Preço
                          </AuraButton>
                        </>
                      )}

                      {supportsPrimaryStockQty && (
                        <AuraButton
                          variant={drawerRestockOpen ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => setDrawerRestockOpen((v) => !v)}
                          aria-expanded={drawerRestockOpen}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Repor Estoque
                        </AuraButton>
                      )}
                    </div>

                    {supportsPrimaryStockQty && drawerRestockOpen && (
                      <div className="rounded-xl bg-[#FAF9F6] border border-[#E5E2D9] p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="drawer-restock-qty"
                            className="text-xs font-medium text-[#1F1E1B]"
                          >
                            Adicionar ao estoque ({liveSelectedDetail.stockUnit || 'un.'})
                          </label>
                          <span className="text-[11px] text-[#6E6B63] tabular-nums">
                            Atual:{' '}
                            {formatStockQtyDisplay(
                              liveSelectedDetail.stockQty,
                              liveSelectedDetail.stockUnit
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            id="drawer-restock-qty"
                            type="number"
                            min={0.1}
                            step="any"
                            value={drawerRestockQty}
                            onChange={(e) => setDrawerRestockQty(e.target.value)}
                            className="w-24 h-9 px-2.5 rounded-lg bg-white border border-[#DDDAD0] text-sm tabular-nums text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                          />
                          <div className="flex-1 flex items-center gap-1.5">
                            {RESTOCK_SHORTCUTS.map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => setDrawerRestockQty(String(amt))}
                                className={`flex-1 h-9 rounded-lg text-xs font-medium tabular-nums border transition-colors cursor-pointer ${
                                  Number(drawerRestockQty) === amt
                                    ? 'bg-[#4F5A47] text-white border-[#4F5A47]'
                                    : 'bg-white text-[#2C2A25] border-[#DDDAD0] hover:bg-[#EFECE6]'
                                }`}
                              >
                                +{amt}
                              </button>
                            ))}
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-xs text-[#2C2A25] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={drawerRestockSetAvailable}
                            onChange={(e) =>
                              setDrawerRestockSetAvailable(e.target.checked)
                            }
                            className="h-4 w-4 rounded border-[#C9C5B9] accent-[#4F5A47] cursor-pointer"
                          />
                          <span>Definir status como Disponível</span>
                        </label>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <AuraButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setDrawerRestockOpen(false)}
                          >
                            Cancelar
                          </AuraButton>
                          <AuraButton
                            variant="primary"
                            size="sm"
                            disabled={
                              !Number(drawerRestockQty) || Number(drawerRestockQty) <= 0
                            }
                            onClick={() => {
                              const delta = Number(drawerRestockQty);
                              if (delta > 0) {
                                onRestockSmartphones([liveSelectedDetail.id], delta, {
                                  setAvailable: drawerRestockSetAvailable,
                                });
                                setDrawerRestockOpen(false);
                              }
                            }}
                          >
                            Confirmar Reposição
                          </AuraButton>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Serialized Identifiers OR Template Custom Attributes */}
              {isPhoneSerialized ? (
                <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-medium text-[#6E6B63]">
                    Identificação Serializada & Origem
                  </p>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-[#F2EFE8]">
                      <span className="text-[#6E6B63]">IMEI 1</span>
                      <span className="font-mono font-medium text-[#1F1E1B]">
                        {formatIMEI(liveSelectedDetail.imei1)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-[#F2EFE8]">
                      <span className="text-[#6E6B63]">IMEI 2 (eSIM)</span>
                      <span className="font-mono text-[#1F1E1B]">
                        {liveSelectedDetail.imei2
                          ? formatIMEI(liveSelectedDetail.imei2)
                          : 'Não informado'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-[#F2EFE8]">
                      <span className="text-[#6E6B63]">Número de Série</span>
                      <span className="font-mono font-medium text-[#1F1E1B]">
                        {liveSelectedDetail.serialNumber}
                      </span>
                    </div>
                    {liveSelectedDetail.ram && (
                      <div className="flex items-center justify-between py-1.5 border-b border-[#F2EFE8]">
                        <span className="text-[#6E6B63]">Memória RAM</span>
                        <span className="font-medium text-[#1F1E1B]">
                          {liveSelectedDetail.ram}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[#6E6B63]">Origem</span>
                      <span className="font-medium text-[#1F1E1B]">
                        {liveSelectedDetail.origin}
                        {liveSelectedDetail.tradeInCustomerId &&
                          ` · ${
                            customers.find(
                              (c) => c.id === liveSelectedDetail.tradeInCustomerId
                            )?.name ?? ''
                          }`}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-medium text-[#6E6B63]">
                    Atributos do Template · {template.segment}
                  </p>
                  <div className="space-y-2.5 text-xs">
                    {template.primaryFields.map((field) => {
                      const val = liveSelectedDetail.customAttributes?.[field.key];
                      return (
                        <div
                          key={field.id}
                          className="flex items-center justify-between gap-3 py-1.5 border-b border-[#F2EFE8] last:border-b-0"
                        >
                          <span className="text-[#6E6B63]">{field.label}</span>
                          <span className="font-medium text-[#1F1E1B] text-right">
                            {field.type === 'date' && typeof val === 'string' && val
                              ? formatDateBR(val)
                              : formatCustomAttributeValue(val)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between py-1.5 border-t border-[#F2EFE8]">
                      <span className="text-[#6E6B63]">Código de Referência</span>
                      <span className="font-mono font-medium text-[#1F1E1B]">
                        {liveSelectedDetail.sku}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Physical Checklist (only when enabled or populated) */}
              {(features.hasEntryChecklist || liveSelectedDetail.checklist.length > 0) && (
                <AuraChecklist
                  title={
                    isPhoneSerialized
                      ? 'Checklist Físico do Aparelho'
                      : `Checklist de ${labels.primaryItemSingular}`
                  }
                  items={liveSelectedDetail.checklist}
                  onToggle={(itemId) => {
                    const target = liveSelectedDetail.checklist.find((c) => c.id === itemId);
                    if (target) {
                      onToggleSmartphoneChecklist(
                        liveSelectedDetail.id,
                        itemId,
                        !target.checked
                      );
                    }
                  }}
                />
              )}

              {liveSelectedDetail.notes && (
                <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4">
                  <p className="text-xs font-medium text-[#6E6B63] mb-1.5">
                    Observações de Entrada
                  </p>
                  <p className="text-[13px] text-[#2C2A25] leading-relaxed">
                    {liveSelectedDetail.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-white border-t border-[#E5E2D9] flex items-center justify-between gap-3">
              <AuraButton
                variant="outline"
                onClick={() => onSelectSmartphoneDetail(null)}
              >
                Fechar
              </AuraButton>
              {liveSelectedDetail.status !== 'Vendido' && (
                <AuraButton
                  variant="primary"
                  onClick={() => {
                    onStartCheckoutWithSmartphone(liveSelectedDetail.id);
                    onSelectSmartphoneDetail(null);
                  }}
                >
                  {labels.orderActionLabel}
                  <ArrowRight className="h-4 w-4" />
                </AuraButton>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Label Sheet Modal */}
      {labelModalItems && (
        <div
          className="fixed inset-0 z-50 bg-[#1F1E1B]/45 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setLabelModalItems(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Prévia de Etiquetas ${template.storeName}`}
            className="w-full max-w-xl bg-[#F4F2EC] rounded-2xl border border-[#E5E2D9] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-white border-b border-[#E5E2D9] flex items-center justify-between no-print">
              <span className="text-sm font-medium text-[#1F1E1B]">
                Etiquetas de Vitrine ({labelModalItems.length})
              </span>
              <div className="flex items-center gap-2">
                <AuraButton
                  variant="primary"
                  size="sm"
                  onClick={() => window.print()}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir Etiquetas
                </AuraButton>
                <button
                  type="button"
                  onClick={() => setLabelModalItems(null)}
                  aria-label="Fechar etiquetas"
                  className="p-1.5 rounded-lg text-[#6E6B63] hover:bg-[#EFECE6] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              id="auracell-printable-document"
              className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto"
            >
              {labelModalItems.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-dashed border-[#B8B3A6] rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-sm text-[#4F5A47]">
                      {template.storeName}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-[#1F1E1B]">
                      {item.price}
                    </span>
                  </div>
                  <p className="text-[13px] font-semibold text-[#1F1E1B]">{item.title}</p>
                  <p className="text-[11px] text-[#6E6B63]">{item.subtitle}</p>
                  <p className="font-mono text-[11px] text-[#2C2A25] pt-2 border-t border-[#EFECE6]">
                    {item.code}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
