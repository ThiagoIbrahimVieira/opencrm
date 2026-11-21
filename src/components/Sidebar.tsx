import React from 'react';
import {
  LayoutGrid,
  Smartphone,
  Package,
  Users,
  FileCheck2,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  AlertCircle,
  ShieldCheck,
  History,
  Settings,
  LogOut,
  Check,
  Plus,
  Store,
  X,
} from 'lucide-react';
import { AuthUser, UserRole } from '../types/auth';
import { AppSection, InventoryTab } from '../types/crm';
import { StoreSummaryItem, StoreTemplate } from '../types/template';

interface SidebarProps {
  currentUser: AuthUser;
  activeTemplate: StoreTemplate;
  stores: StoreSummaryItem[];
  activeSection: AppSection;
  activeInventoryTab: InventoryTab;
  lowStockFilterActive: boolean;
  counts: {
    availableSmartphones: number;
    totalSmartphones: number;
    totalAccessoryUnits: number;
    lowStockAccessories: number;
    customers: number;
    activeCustomers: number;
    leadCustomers: number;
    inactiveCustomers: number;
    activeWarranties: number;
    auditLogs: number;
  };
  onNavigate: (
    section: AppSection,
    opts?: { inventoryTab?: InventoryTab; onlyLowStock?: boolean }
  ) => void;
  onSwitchStore: (storeId: string) => void;
  onOpenCreateStore: () => void;
  onOpenCommandSearch: () => void;
  onSwitchRole: (role: UserRole) => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isDemoMode?: boolean;
}

function CounterPill({ value, alert = false }: { value: number; alert?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-medium tabular-nums shrink-0 ${
        alert ? 'bg-[#F6ECD9] text-[#855312]' : 'bg-[#E2DED4] text-[#55524A]'
      }`}
    >
      {value}
    </span>
  );
}

export function Sidebar({
  currentUser,
  activeTemplate,
  stores,
  activeSection,
  activeInventoryTab,
  lowStockFilterActive,
  counts,
  onNavigate,
  onSwitchStore,
  onOpenCreateStore,
  onOpenCommandSearch,
  onSwitchRole,
  onLogout,
  mobileOpen,
  onCloseMobile,
  isDemoMode = false,
}: SidebarProps) {
  const [catalogExpanded, setCatalogExpanded] = React.useState(true);
  const [postSaleExpanded, setPostSaleExpanded] = React.useState(true);
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const switcherRef = React.useRef<HTMLDivElement>(null);

  const isAdmin = currentUser.role === 'ADMIN';
  const storeInitial = (activeTemplate.storeName.trim()[0] || 'O').toUpperCase();

  React.useEffect(() => {
    if (!switcherOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [switcherOpen]);

  const handleNav = (
    section: AppSection,
    opts?: { inventoryTab?: InventoryTab; onlyLowStock?: boolean }
  ) => {
    onNavigate(section, opts);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#ECEAE2] border-r border-[#DFDDD3] w-[264px] select-none">
      {/* Notion/Linear-style Workspace Switcher */}
      <div className="px-3.5 pt-3.5 pb-2.5 relative" ref={switcherRef}>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSwitcherOpen((v) => !v)}
            aria-expanded={switcherOpen}
            aria-label={`Alternar loja ativa (${activeTemplate.storeName})`}
            className="flex-1 flex items-center justify-between gap-2 px-2 py-2 rounded-xl hover:bg-[#E2DED4]/80 transition-colors text-left cursor-pointer min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F5A47]/40"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-full bg-[#4F5A47] text-[#F4F2EC] flex items-center justify-center font-serif text-lg shrink-0">
                {storeInitial}
              </div>
              <div className="min-w-0">
                <p className="font-serif text-[18px] leading-tight text-[#1F1E1B] tracking-tight truncate">
                  {activeTemplate.storeName}
                </p>
                <p className="text-[11px] text-[#6E6B63] truncate">
                  {activeTemplate.segment}
                </p>
              </div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-[#6E6B63] shrink-0" />
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
            className="lg:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#6E6B63] hover:bg-[#E2DED4] cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Workspace Switcher Dropdown */}
        {switcherOpen && (
          <div
            role="menu"
            aria-label="Lojas e templates do Open CRM"
            className="absolute left-3.5 right-3.5 top-[64px] z-40 bg-white border border-[#DFDDD3] rounded-2xl shadow-xl p-2 space-y-1"
          >
            <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-[#EFECE6]">
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[#7A776E]">
                Open CRM · Lojas
              </span>
              <span className="text-[10px] text-[#8C887E] tabular-nums">
                {stores.length} ativas
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-0.5 py-0.5">
              {stores.map((st) => {
                const isActive = st.storeId === activeTemplate.id;
                return (
                  <button
                    key={st.storeId}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSwitchStore(st.storeId);
                      setSwitcherOpen(false);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#F4F6F1] text-[#1F1E1B]'
                        : 'hover:bg-[#FAF9F6] text-[#4A4842]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`h-7 w-7 rounded-full flex items-center justify-center font-serif text-sm shrink-0 ${
                          isActive
                            ? 'bg-[#4F5A47] text-white'
                            : 'bg-[#ECEAE2] text-[#4A4842]'
                        }`}
                      >
                        {(st.template.storeName[0] || 'L').toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#1F1E1B] truncate">
                          {st.template.storeName}
                        </p>
                        <p className="text-[10.5px] text-[#6E6B63] truncate">
                          {st.template.segment}
                        </p>
                      </div>
                    </div>
                    {isActive && (
                      <Check className="h-3.5 w-3.5 text-[#4F5A47] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-1.5 border-t border-[#EFECE6]">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSwitcherOpen(false);
                  onCloseMobile();
                  onOpenCreateStore();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-[#2E472D] bg-[#F4F6F1] hover:bg-[#E6ECE3] transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Criar nova loja / template</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Search Input Trigger (⌘K) */}
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={onOpenCommandSearch}
          className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#F6F5F0] border border-[#DDDAD0] text-[#6E6B63] hover:border-[#C5C0B3] hover:text-[#1F1E1B] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F5A47]/40"
        >
          <span className="flex items-center gap-2 text-[13px] truncate">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span>Busca rápida...</span>
          </span>
          <kbd className="hidden sm:inline-flex text-[11px] font-mono text-[#6E6B63] bg-[#ECEAE2] border border-[#D8D4C9] rounded px-1.5 py-0.5 shrink-0">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-3 pb-3">
        {/* Section: Operação */}
        <div>
          <p className="px-2.5 mb-1.5 text-[11px] font-medium text-[#7A776E]">
            Operação
          </p>
          <nav aria-label="Navegação principal" className="space-y-0.5">
            <button
              type="button"
              onClick={() => handleNav('dashboard')}
              className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                activeSection === 'dashboard'
                  ? 'bg-white text-[#1F1E1B] border border-[#DFDDD3] shadow-[0_1px_2px_rgba(28,25,23,0.04)]'
                  : 'text-[#4A4842] hover:bg-[#E5E2D8]/70 hover:text-[#1F1E1B] border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <LayoutGrid className="h-4 w-4 text-[#4F5A47] shrink-0" />
                <span className="truncate">Balcão & Resumo</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleNav('checkout')}
              className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                activeSection === 'checkout'
                  ? 'bg-white text-[#1F1E1B] border border-[#DFDDD3] shadow-[0_1px_2px_rgba(28,25,23,0.04)]'
                  : 'text-[#4A4842] hover:bg-[#E5E2D8]/70 hover:text-[#1F1E1B] border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <FileCheck2 className="h-4 w-4 text-[#4F5A47] shrink-0" />
                <span className="truncate">{activeTemplate.labels.orderActionLabel}</span>
              </span>
            </button>
          </nav>
        </div>

        <div className="border-t border-[#DFDDD3]" />

        {/* Section: Estoque Inteligente */}
        <div>
          <button
            type="button"
            onClick={() => setCatalogExpanded((v) => !v)}
            aria-expanded={catalogExpanded}
            className="w-full flex items-center justify-between px-2.5 mb-1.5 text-[11px] font-medium text-[#7A776E] hover:text-[#1F1E1B] cursor-pointer"
          >
            <span>Estoque Inteligente</span>
            {catalogExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>

          {catalogExpanded && (
            <div className="space-y-0.5 pl-1">
              <button
                type="button"
                onClick={() =>
                  handleNav('inventory', {
                    inventoryTab: 'smartphones',
                    onlyLowStock: false,
                  })
                }
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                  activeSection === 'inventory' && activeInventoryTab === 'smartphones'
                    ? 'bg-white text-[#1F1E1B] border border-[#DFDDD3] shadow-[0_1px_2px_rgba(28,25,23,0.04)]'
                    : 'text-[#4A4842] hover:bg-[#E5E2D8]/70 hover:text-[#1F1E1B] border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {activeTemplate.features.hasSerializedItems ? (
                    <Smartphone className="h-4 w-4 text-[#4F5A47] shrink-0" />
                  ) : (
                    <Store className="h-4 w-4 text-[#4F5A47] shrink-0" />
                  )}
                  <span className="truncate">{activeTemplate.labels.primaryTabName}</span>
                </span>
                <CounterPill value={counts.availableSmartphones} />
              </button>

              <button
                type="button"
                onClick={() =>
                  handleNav('inventory', {
                    inventoryTab: 'accessories',
                    onlyLowStock: false,
                  })
                }
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                  activeSection === 'inventory' &&
                  activeInventoryTab === 'accessories' &&
                  !lowStockFilterActive
                    ? 'bg-white text-[#1F1E1B] border border-[#DFDDD3] shadow-[0_1px_2px_rgba(28,25,23,0.04)]'
                    : 'text-[#4A4842] hover:bg-[#E5E2D8]/70 hover:text-[#1F1E1B] border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Package className="h-4 w-4 text-[#4F5A47] shrink-0" />
                  <span className="truncate">{activeTemplate.labels.secondaryTabName}</span>
                </span>
                <CounterPill value={counts.totalAccessoryUnits} />
              </button>

              <div className="ml-4 pl-3 border-l border-[#D6D2C7] pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    handleNav('inventory', {
                      inventoryTab: 'accessories',
                      onlyLowStock: true,
                    })
                  }
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeSection === 'inventory' &&
                    activeInventoryTab === 'accessories' &&
                    lowStockFilterActive
                      ? 'bg-white text-[#1F1E1B] border border-[#DFDDD3]'
                      : 'text-[#5E5B54] hover:bg-[#E5E2D8]/70 hover:text-[#1F1E1B] border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="h-3.5 w-3.5 text-[#855312] shrink-0" />
                    <span className="truncate">Reposição Mínima</span>
                  </span>
                  <CounterPill
                    value={counts.lowStockAccessories}
                    alert={counts.lowStockAccessories > 0}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[#DFDDD3]" />

        {/* Section: CRM & Pós-Venda */}
        <div>
          <button
            type="button"
            onClick={() => setPostSaleExpanded((v) => !v)}
            aria-expanded={postSaleExpanded}
            className="w-full flex items-center justify-between px-2.5 mb-1.5 text-[11px] font-medium text-[#7A776E] hover:text-[#1F1E1B] cursor-pointer"
          >
            <span>CRM & Pós-Venda</span>
            {postSaleExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>

          {postSaleExpanded && (
            <div className="space-y-0.5 pl-1">
              <button
                type="button"
                onClick={() => handleNav('customers')}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                  activeSection === 'customers'
                    ? 'bg-white text-[#1F1E1B] border border-[#DFDDD3] shadow-[0_1px_2px_rgba(28,25,23,0.04)]'
                    : 'text-[#4A4842] hover:bg-[#E5E2D8]/70 hover:text-[#1F1E1B] border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Users className="h-4 w-4 text-[#4F5A47] shrink-0" />
                  <span className="truncate">Clientes</span>
                </span>
                <CounterPill value={counts.customers} />
              </button>

              {activeTemplate.features.hasWarrantyQr && (
                <div className="ml-4 pl-3 border-l border-[#D6D2C7] pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleNav('customers')}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#5E5B54] hover:bg-[#E5E2D8]/70 hover:text-[#1F1E1B] transition-all cursor-pointer"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#4F5A47] shrink-0" />
                      <span className="truncate">Garantias Ativas</span>
                    </span>
                    <CounterPill value={counts.activeWarranties} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Admin-Only Section: Auditoria & Estoque (Ledger) + Configurações */}
        {isAdmin && (
          <>
            <div className="border-t border-[#DFDDD3]" />
            <div>
              <p className="px-2.5 mb-1.5 text-[11px] font-medium text-[#7A776E]">
                Governança (Admin)
              </p>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleNav('audit')}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                    activeSection === 'audit'
                      ? 'bg-white text-[#1F1E1B] border border-[#DFDDD3] shadow-[0_1px_2px_rgba(28,25,23,0.04)]'
                      : 'text-[#4A4842] hover:bg-[#E5E2D8]/70 hover:text-[#1F1E1B] border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <History className="h-4 w-4 text-[#4F5A47] shrink-0" />
                    <span className="truncate">Auditoria & Estoque</span>
                  </span>
                  <CounterPill value={counts.auditLogs} />
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('settings')}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                    activeSection === 'settings'
                      ? 'bg-white text-[#1F1E1B] border border-[#DFDDD3] shadow-[0_1px_2px_rgba(28,25,23,0.04)]'
                      : 'text-[#4A4842] hover:bg-[#E5E2D8]/70 hover:text-[#1F1E1B] border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Settings className="h-4 w-4 text-[#4F5A47] shrink-0" />
                    <span className="truncate">Configurações</span>
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Minimalist TOTAL DE CLIENTES Summary Card */}
      <div className="px-3.5 pb-2.5 pt-1">
        <button
          type="button"
          onClick={() => handleNav('customers')}
          aria-label="Ver resumo de clientes"
          className="w-full text-left rounded-xl bg-white/95 border border-[#DFDDD3] px-3.5 py-3 shadow-[0_1px_2px_rgba(28,25,23,0.03)] hover:border-[#C5C0B3] transition-colors cursor-pointer"
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[#7A776E]">
              TOTAL DE CLIENTES
            </p>
            <p className="font-serif text-[24px] leading-none text-[#1F1E1B] tabular-nums">
              {counts.customers}
            </p>
          </div>

          <div className="mt-2.5 pt-2 border-t border-[#EFECE6] space-y-1 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[#4A4842]">
                <span className="h-2 w-2 rounded-full bg-[#4F5A47] shrink-0" />
                Ativos
              </span>
              <span className="font-semibold text-[#1F1E1B] tabular-nums">
                {counts.activeCustomers}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[#4A4842]">
                <span className="h-2 w-2 rounded-full bg-[#B47B2B] shrink-0" />
                Leads / Interessados
              </span>
              <span className="font-semibold text-[#1F1E1B] tabular-nums">
                {counts.leadCustomers}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[#4A4842]">
                <span className="h-2 w-2 rounded-full bg-[#8A867D] shrink-0" />
                Inativos
              </span>
              <span className="font-semibold text-[#1F1E1B] tabular-nums">
                {counts.inactiveCustomers}
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Quick RBAC Profile Switcher (Demo Only) or Fixed Role Badge (Real Accounts) */}
      <div className="px-3.5 py-3 border-t border-[#DFDDD3] space-y-2.5">
        {isDemoMode ? (
          <div
            role="group"
            aria-label="Alternar perfil de acesso (Demonstração)"
            className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#E2DED4]"
          >
            <button
              type="button"
              onClick={() => onSwitchRole('ADMIN')}
              aria-pressed={isAdmin}
              className={`h-7 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                isAdmin
                  ? 'bg-white text-[#1F1E1B] shadow-xs'
                  : 'text-[#5E5B54] hover:text-[#1F1E1B]'
              }`}
            >
              Demo Admin
            </button>
            <button
              type="button"
              onClick={() => onSwitchRole('VENDEDOR')}
              aria-pressed={!isAdmin}
              className={`h-7 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                !isAdmin
                  ? 'bg-white text-[#1F1E1B] shadow-xs'
                  : 'text-[#5E5B54] hover:text-[#1F1E1B]'
              }`}
            >
              Demo Vendedor
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#FAF9F5] border border-[#E5E2D9]">
            <span className="text-[11px] font-medium text-[#7A776E] uppercase tracking-wider">
              Papel Ativo
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#4F5A47]/10 text-[#4F5A47]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4F5A47]" />
              {isAdmin ? 'Administrador' : 'Vendedor'}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between px-1 text-[11px] text-[#6E6B63]">
          <span className="truncate">{currentUser.email}</span>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sair da conta"
            className="inline-flex items-center gap-1 text-[#5E5B54] hover:text-[#1F1E1B] font-medium cursor-pointer shrink-0 ml-2"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 no-print">
        {navContent}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[80] lg:hidden bg-[#1F1E1B]/35 backdrop-blur-[2px] flex no-print"
          onClick={onCloseMobile}
        >
          <div className="h-full" onClick={(e) => e.stopPropagation()}>
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
