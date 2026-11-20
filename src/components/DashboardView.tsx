import React from 'react';
import {
  Smartphone as SmartphoneIcon,
  Package,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  MessageCircle,
  CalendarClock,
  Store,
  Users,
} from 'lucide-react';
import {
  Accessory,
  AppSection,
  Customer,
  InventoryTab,
  Order,
  Smartphone,
  WeeklyMovementPoint,
} from '../types/crm';
import { StoreTemplate } from '../types/template';
import { DashboardSummary } from '../services/crmService';
import { REFERENCE_TODAY } from '../data/mockData';
import { formatCurrencyBRL, formatDateBR, getDaysRemaining } from '../utils/imei';
import { buildWhatsAppWarrantyUrl } from '../utils/qrAndWhatsapp';
import { AuraButton, StatusBadge } from './ui/AuraPrimitives';

interface DashboardViewProps {
  operatorFirstName: string;
  template: StoreTemplate;
  summary: DashboardSummary;
  weeklyMovement: WeeklyMovementPoint[];
  smartphones: Smartphone[];
  accessories: Accessory[];
  customers: Customer[];
  orders: Order[];
  onNavigate: (
    section: AppSection,
    opts?: { inventoryTab?: InventoryTab; onlyLowStock?: boolean }
  ) => void;
  onOpenCustomer: (customerId: string) => void;
  onOpenSmartphone: (smartphone: Smartphone) => void;
  onRestockAccessory: (accessoryId: string, delta: number) => void;
  onOpenCommandSearch: () => void;
}

export function DashboardView({
  operatorFirstName,
  template,
  summary,
  weeklyMovement,
  smartphones,
  accessories,
  customers,
  orders,
  onNavigate,
  onOpenCustomer,
  onOpenSmartphone,
  onRestockAccessory,
  onOpenCommandSearch,
}: DashboardViewProps) {
  const [activeBarIndex, setActiveBarIndex] = React.useState<number>(
    Math.max(0, weeklyMovement.length - 1)
  );
  const [calendarMonthOffset, setCalendarMonthOffset] = React.useState(0);

  const { features, labels } = template;

  const lowStockItems = accessories
    .filter((a) => a.stock <= a.minStock)
    .sort((a, b) => a.stock - b.stock);

  const expiringWarranties = features.hasWarrantyQr
    ? orders
        .map((order) => {
          const days = getDaysRemaining(order.warrantyExpiresAt, REFERENCE_TODAY);
          const customer = customers.find((c) => c.id === order.customerId);
          return { order, days, customer };
        })
        .filter((item) => item.days > 0 && item.days <= 15 && item.customer)
        .sort((a, b) => a.days - b.days)
    : [];

  const expiringBatches = React.useMemo(() => {
    if (!features.hasExpirationDate) return [];
    const list: {
      id: string;
      name: string;
      sku: string;
      expiresAt: string;
      days: number;
      tab: InventoryTab;
    }[] = [];

    smartphones.forEach((s) => {
      if (s.status !== 'Vendido' && s.expiresAt) {
        const days = getDaysRemaining(s.expiresAt, REFERENCE_TODAY);
        if (days <= 7) {
          list.push({
            id: s.id,
            name: s.model,
            sku: s.sku,
            expiresAt: s.expiresAt,
            days,
            tab: 'smartphones',
          });
        }
      }
    });

    accessories.forEach((a) => {
      if (a.stock > 0 && a.expiresAt) {
        const days = getDaysRemaining(a.expiresAt, REFERENCE_TODAY);
        if (days <= 7) {
          list.push({
            id: a.id,
            name: a.name,
            sku: a.sku,
            expiresAt: a.expiresAt,
            days,
            tab: 'accessories',
          });
        }
      }
    });

    return list.sort((a, b) => a.days - b.days);
  }, [features.hasExpirationDate, smartphones, accessories]);

  const topAccessories = [...accessories]
    .sort((a, b) => b.soldThisMonth - a.soldThisMonth)
    .slice(0, 4);

  const featuredPhones = smartphones
    .filter((s) => s.status === 'Disponível')
    .slice(0, 2);

  // Chart scaling
  const maxAccessories = Math.max(...weeklyMovement.map((d) => d.acessorios), 10);
  const maxSmartphones = Math.max(...weeklyMovement.map((d) => d.aparelhos), 4);
  const chartScaleMax = Math.max(maxAccessories, maxSmartphones * 4);

  // Mini Calendar calculation (Nov 2026 default, shiftable)
  const baseDate = new Date(2026, 10 + calendarMonthOffset, 1); // Nov = 10
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const monthLabel = baseDate.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  const formattedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const firstWeekday = baseDate.getDay(); // 0=Dom
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const highlightedCalendarDays = new Set<number>();
  if (features.hasWarrantyQr) {
    orders.forEach((o) => {
      const [y, m, d] = o.warrantyExpiresAt.split('-').map(Number);
      if (y === year && m - 1 === month) highlightedCalendarDays.add(d);
    });
  }
  if (features.hasExpirationDate) {
    [...smartphones, ...accessories].forEach((item) => {
      if (!item.expiresAt) return;
      const [y, m, d] = item.expiresAt.split('-').map(Number);
      if (y === year && m - 1 === month) highlightedCalendarDays.add(d);
    });
  }

  const totalAlertsCount =
    lowStockItems.length + expiringWarranties.length + expiringBatches.length;

  return (
    <div className="space-y-7">
      {/* Editorial Greeting Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#6E6B63] mb-1">
            Sexta-feira, 20 de novembro · {template.storeName} ({template.segment})
          </p>
          <h1 className="font-serif text-[32px] sm:text-[36px] leading-[1.15] text-[#1F1E1B] tracking-tight">
            Bom dia, {operatorFirstName}
          </h1>
          <p className="text-sm text-[#6E6B63] mt-1">
            {features.hasSerializedItems
              ? 'Resumo do balcão hoje — acompanhe estoque serializado, reposições e garantias ativas.'
              : features.hasExpirationDate
                ? `Resumo de ${template.storeName} — acompanhe ${labels.primaryTabName.toLowerCase()}, reposições e validade de lotes.`
                : `Resumo de ${template.storeName} — acompanhe ${labels.primaryTabName.toLowerCase()}, ${labels.secondaryTabName.toLowerCase()} e atendimento.`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <AuraButton
            variant="outline"
            onClick={onOpenCommandSearch}
            className="hidden sm:inline-flex"
          >
            <Search className="h-3.5 w-3.5 text-[#6E6B63]" />
            {features.hasSerializedItems ? 'Buscar IMEI ou SKU' : 'Buscar item ou SKU'}
          </AuraButton>
          <AuraButton variant="primary" onClick={() => onNavigate('checkout')}>
            <Plus className="h-4 w-4" />
            {labels.orderActionLabel}
          </AuraButton>
        </div>
      </header>

      {/* Quick Stats Strip */}
      <section aria-label="Indicadores rápidos do balcão">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Primary Catalog Items */}
          <button
            type="button"
            onClick={() =>
              onNavigate('inventory', { inventoryTab: 'smartphones', onlyLowStock: false })
            }
            className="group bg-white border border-[#E5E2D9] hover:border-[#C5C0B3] rounded-2xl p-5 text-left transition-colors shadow-[0_1px_2px_rgba(28,25,23,0.03)] cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start justify-between mb-4">
              <span className="h-11 w-11 rounded-full bg-[#4F5A47] text-white flex items-center justify-center">
                {features.hasSerializedItems ? (
                  <SmartphoneIcon className="h-5 w-5" />
                ) : (
                  <Store className="h-5 w-5" />
                )}
              </span>
              <span className="h-7 w-7 rounded-full border border-[#E5E2D9] flex items-center justify-center text-[#6E6B63] group-hover:text-[#1F1E1B] group-hover:border-[#CFCBC0] transition-colors">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div>
              <p className="text-[28px] font-semibold text-[#1F1E1B] tabular-nums leading-none">
                {summary.availableSmartphones}
              </p>
              <p className="text-[13px] font-medium text-[#1F1E1B] mt-2">
                {labels.primaryTabName} Disponíveis
              </p>
              <p className="text-xs text-[#6E6B63] mt-0.5 tabular-nums">
                {features.hasSerializedItems
                  ? `${summary.reservedSmartphones} reservado${summary.reservedSmartphones === 1 ? '' : 's'} no balcão`
                  : `${smartphones.length} cadastrados no catálogo`}
              </p>
            </div>
          </button>

          {/* Card 2: Secondary Low Stock */}
          <button
            type="button"
            onClick={() =>
              onNavigate('inventory', { inventoryTab: 'accessories', onlyLowStock: true })
            }
            className="group bg-white border border-[#E5E2D9] hover:border-[#C5C0B3] rounded-2xl p-5 text-left transition-colors shadow-[0_1px_2px_rgba(28,25,23,0.03)] cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start justify-between mb-4">
              <span className="h-11 w-11 rounded-full bg-[#F6ECD9] text-[#855312] flex items-center justify-center">
                <Package className="h-5 w-5" />
              </span>
              <span className="h-7 w-7 rounded-full border border-[#E5E2D9] flex items-center justify-center text-[#6E6B63] group-hover:text-[#1F1E1B] transition-colors">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div>
              <p className="text-[28px] font-semibold text-[#1F1E1B] tabular-nums leading-none">
                {summary.lowStockAccessories}
              </p>
              <p className="text-[13px] font-medium text-[#1F1E1B] mt-2">
                {labels.secondaryTabName} · Estoque Baixo
              </p>
              <p className="text-xs text-[#6E6B63] mt-0.5 tabular-nums">
                {summary.totalAccessoryUnits} unidades totais em loja
              </p>
            </div>
          </button>

          {/* Card 3: Adaptive — Warranties OR Expiring Batches OR Active Customers */}
          {features.hasWarrantyQr ? (
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="group bg-white border border-[#E5E2D9] hover:border-[#C5C0B3] rounded-2xl p-5 text-left transition-colors shadow-[0_1px_2px_rgba(28,25,23,0.03)] cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="h-11 w-11 rounded-full bg-[#E6ECE3] text-[#2E472D] flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span className="h-7 w-7 rounded-full border border-[#E5E2D9] flex items-center justify-center text-[#6E6B63] group-hover:text-[#1F1E1B] transition-colors">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <div>
                <p className="text-[28px] font-semibold text-[#1F1E1B] tabular-nums leading-none">
                  {summary.activeWarranties}
                </p>
                <p className="text-[13px] font-medium text-[#1F1E1B] mt-2">
                  Garantias Ativas
                </p>
                <p className="text-xs text-[#6E6B63] mt-0.5 tabular-nums">
                  {summary.expiringWarrantiesCount} vencem nos próximos 15 dias
                </p>
              </div>
            </button>
          ) : features.hasExpirationDate ? (
            <button
              type="button"
              onClick={() =>
                onNavigate('inventory', { inventoryTab: 'smartphones', onlyLowStock: false })
              }
              className="group bg-white border border-[#E5E2D9] hover:border-[#C5C0B3] rounded-2xl p-5 text-left transition-colors shadow-[0_1px_2px_rgba(28,25,23,0.03)] cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="h-11 w-11 rounded-full bg-[#F6ECD9] text-[#855312] flex items-center justify-center">
                  <CalendarClock className="h-5 w-5" />
                </span>
                <span className="h-7 w-7 rounded-full border border-[#E5E2D9] flex items-center justify-center text-[#6E6B63] group-hover:text-[#1F1E1B] transition-colors">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <div>
                <p className="text-[28px] font-semibold text-[#1F1E1B] tabular-nums leading-none">
                  {summary.expiringBatchesCount}
                </p>
                <p className="text-[13px] font-medium text-[#1F1E1B] mt-2">
                  Validade de Lote Próxima
                </p>
                <p className="text-xs text-[#6E6B63] mt-0.5 tabular-nums">
                  Itens vencendo nos próximos 7 dias
                </p>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="group bg-white border border-[#E5E2D9] hover:border-[#C5C0B3] rounded-2xl p-5 text-left transition-colors shadow-[0_1px_2px_rgba(28,25,23,0.03)] cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="h-11 w-11 rounded-full bg-[#E6ECE3] text-[#2E472D] flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </span>
                <span className="h-7 w-7 rounded-full border border-[#E5E2D9] flex items-center justify-center text-[#6E6B63] group-hover:text-[#1F1E1B] transition-colors">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <div>
                <p className="text-[28px] font-semibold text-[#1F1E1B] tabular-nums leading-none">
                  {summary.customerCounts.active}
                </p>
                <p className="text-[13px] font-medium text-[#1F1E1B] mt-2">
                  Clientes Ativos
                </p>
                <p className="text-xs text-[#6E6B63] mt-0.5 tabular-nums">
                  {summary.customerCounts.lead} lead(s) em acompanhamento
                </p>
              </div>
            </button>
          )}

          {/* Card 4: Weekly Outputs */}
          <button
            type="button"
            onClick={() => onNavigate('checkout')}
            className="group bg-white border border-[#E5E2D9] hover:border-[#C5C0B3] rounded-2xl p-5 text-left transition-colors shadow-[0_1px_2px_rgba(28,25,23,0.03)] cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start justify-between mb-4">
              <span className="h-11 w-11 rounded-full bg-[#EFECE6] text-[#4F5A47] flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </span>
              <span className="h-7 w-7 rounded-full border border-[#E5E2D9] flex items-center justify-center text-[#6E6B63] group-hover:text-[#1F1E1B] transition-colors">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div>
              <p className="text-[28px] font-semibold text-[#1F1E1B] tabular-nums leading-none">
                {summary.weeklyOutputs}
              </p>
              <p className="text-[13px] font-medium text-[#1F1E1B] mt-2">
                Saídas na Semana
              </p>
              <p className="text-xs text-[#6E6B63] mt-0.5 tabular-nums">
                {formatCurrencyBRL(summary.weeklyRevenue)} movimentados
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Main Analytics + Atenção do Balcão */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Weekly Movement Bar Chart */}
        <div className="xl:col-span-7 bg-white border border-[#E5E2D9] rounded-2xl p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)] flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
            <div>
              <h2 className="text-[15px] font-semibold text-[#1F1E1B]">
                Movimentação Semanal
              </h2>
              <p className="text-xs text-[#6E6B63] mt-0.5">
                Volume de {labels.primaryTabName.toLowerCase()} e{' '}
                {labels.secondaryTabName.toLowerCase()} por dia
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#6E6B63]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#4F5A47]" />
                {labels.primaryTabName}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#CFC8BA]" />
                {labels.secondaryTabName}
              </span>
            </div>
          </div>

          {weeklyMovement[activeBarIndex] && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F8F7F3] border border-[#EAE7DF] rounded-xl px-4 py-2.5 mb-6 text-xs">
              <span className="font-medium text-[#1F1E1B]">
                {weeklyMovement[activeBarIndex].day} · Destaque selecionado
              </span>
              <div className="flex items-center gap-4 tabular-nums text-[#6E6B63]">
                <span>
                  <strong className="text-[#1F1E1B]">
                    {weeklyMovement[activeBarIndex].aparelhos}
                  </strong>{' '}
                  {labels.primaryTabName.toLowerCase()}
                </span>
                <span>
                  <strong className="text-[#1F1E1B]">
                    {weeklyMovement[activeBarIndex].acessorios}
                  </strong>{' '}
                  {labels.secondaryTabName.toLowerCase()}
                </span>
                <span className="font-medium text-[#2E472D]">
                  {formatCurrencyBRL(weeklyMovement[activeBarIndex].revenue)}
                </span>
              </div>
            </div>
          )}

          <div className="relative pt-4 pb-2">
            <div className="absolute inset-x-0 top-4 bottom-8 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3].map((line) => (
                <div key={line} className="border-t border-dashed border-[#ECE9E1] w-full" />
              ))}
            </div>

            <div className="relative z-10 grid grid-cols-6 gap-3 sm:gap-5 items-end h-52">
              {weeklyMovement.map((point, index) => {
                const isSelected = index === activeBarIndex;
                const phoneHeightPct = Math.max(
                  14,
                  Math.round(((point.aparelhos * 4) / chartScaleMax) * 100)
                );
                const accHeightPct = Math.max(
                  14,
                  Math.round((point.acessorios / chartScaleMax) * 100)
                );

                return (
                  <button
                    key={point.day}
                    type="button"
                    onClick={() => setActiveBarIndex(index)}
                    onMouseEnter={() => setActiveBarIndex(index)}
                    aria-label={`${point.day}: ${point.aparelhos} ${labels.primaryTabName} e ${point.acessorios} ${labels.secondaryTabName}`}
                    className="h-full flex flex-col items-center justify-end group cursor-pointer focus-visible:outline-none"
                  >
                    <div className="flex items-end gap-1.5 sm:gap-2 h-44 w-full justify-center">
                      <div
                        style={{ height: `${phoneHeightPct}%` }}
                        className={`w-3 sm:w-4 rounded-t-full transition-all duration-200 ${
                          isSelected
                            ? 'bg-[#4F5A47]'
                            : 'bg-[#4F5A47]/65 group-hover:bg-[#4F5A47]'
                        }`}
                      />
                      <div
                        style={{ height: `${accHeightPct}%` }}
                        className={`w-3 sm:w-4 rounded-t-full transition-all duration-200 ${
                          isSelected
                            ? 'bg-[#BFB7A6]'
                            : 'bg-[#DCD6C9] group-hover:bg-[#CFC8BA]'
                        }`}
                      />
                    </div>
                    <span
                      className={`mt-2.5 text-xs tabular-nums transition-colors ${
                        isSelected ? 'font-semibold text-[#1F1E1B]' : 'text-[#6E6B63]'
                      }`}
                    >
                      {point.day}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Atenção do Balcão */}
        <div className="xl:col-span-5 bg-white border border-[#E5E2D9] rounded-2xl p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-[#1F1E1B]">
                Atenção do Balcão
              </h2>
              <p className="text-xs text-[#6E6B63] mt-0.5">
                {features.hasExpirationDate
                  ? 'Reposição prioritária e validade de lote próxima'
                  : features.hasWarrantyQr
                    ? 'Reposição prioritária e garantias próximas do vencimento'
                    : 'Itens abaixo do estoque mínimo para reposição'}
              </p>
            </div>
            <span className="text-xs font-medium text-[#6E6B63] tabular-nums">
              {totalAlertsCount} alertas
            </span>
          </div>

          <div className="divide-y divide-[#EFECE6] flex-1">
            {lowStockItems.slice(0, 3).map((acc) => (
              <div
                key={acc.id}
                className="py-3 first:pt-1 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                      acc.stock === 0
                        ? 'bg-[#F8E5E2] text-[#9B3B2B]'
                        : 'bg-[#F6ECD9] text-[#855312]'
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#1F1E1B] truncate">
                      {acc.name}
                    </p>
                    <p className="text-xs text-[#6E6B63] tabular-nums">
                      <span className="font-mono text-[11px]">{acc.sku}</span> ·{' '}
                      {acc.stock === 0 ? 'Esgotado' : `${acc.stock}/${acc.minStock} un.`}
                    </p>
                  </div>
                </div>
                <AuraButton
                  variant="secondary"
                  size="sm"
                  onClick={() => onRestockAccessory(acc.id, 5)}
                >
                  +5 un.
                </AuraButton>
              </div>
            ))}

            {/* Batch Expiration Alerts when hasExpirationDate is active */}
            {features.hasExpirationDate &&
              expiringBatches.slice(0, 4).map((batch) => (
                <div
                  key={`exp-${batch.id}`}
                  className="py-3 flex items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                        batch.days <= 1
                          ? 'bg-[#F8E5E2] text-[#9B3B2B]'
                          : 'bg-[#F6ECD9] text-[#855312]'
                      }`}
                    >
                      <CalendarClock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#1F1E1B] truncate">
                        {batch.name}
                      </p>
                      <p className="text-xs text-[#6E6B63] truncate tabular-nums">
                        Validade: {formatDateBR(batch.expiresAt)} ·{' '}
                        {batch.days <= 0
                          ? 'Vencido'
                          : batch.days === 1
                            ? 'Vence amanhã'
                            : `Vence em ${batch.days} dias`}
                      </p>
                    </div>
                  </div>
                  <AuraButton
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onNavigate('inventory', {
                        inventoryTab: batch.tab,
                        onlyLowStock: false,
                      })
                    }
                  >
                    Ver Lote
                  </AuraButton>
                </div>
              ))}

            {/* Warranty Expiration Alerts when hasWarrantyQr is active */}
            {features.hasWarrantyQr &&
              expiringWarranties.map(({ order, days, customer }) => {
                const modelName =
                  order.smartphoneSnapshot?.model ?? labels.primaryItemSingular.toLowerCase();
                const waUrl = buildWhatsAppWarrantyUrl({
                  phone: customer!.phone,
                  customerName: customer!.name,
                  modelName,
                  daysLeft: days,
                });
                return (
                  <div
                    key={order.id}
                    className="py-3 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-9 w-9 rounded-full bg-[#ECEAE2] text-[#4F5A47] flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#1F1E1B] truncate">
                          {customer!.name}
                        </p>
                        <p className="text-xs text-[#6E6B63] truncate tabular-nums">
                          {modelName} · vence em {days}{' '}
                          {days === 1 ? 'dia' : 'dias'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Enviar aviso de garantia no WhatsApp para ${customer!.name}`}
                        title="Avisar no WhatsApp"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-[#E6ECE3] text-[#2E472D] hover:bg-[#D8E3D3] transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                      <AuraButton
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenCustomer(customer!.id)}
                      >
                        Ver Perfil
                      </AuraButton>
                    </div>
                  </div>
                );
              })}

            {totalAlertsCount === 0 && (
              <p className="py-10 text-center text-sm text-[#6E6B63]">
                Tudo em dia no balcão — sem alertas pendentes.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Bottom Row: Itens Mais Procurados + Mini-Calendar */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <div className="xl:col-span-8 bg-white border border-[#E5E2D9] rounded-2xl p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-semibold text-[#1F1E1B]">
                Itens em Destaque
              </h2>
              <p className="text-xs text-[#6E6B63] mt-0.5">
                {labels.primaryTabName} em vitrine e {labels.secondaryTabName.toLowerCase()} de maior giro
              </p>
            </div>
            <AuraButton
              variant="ghost"
              size="sm"
              onClick={() =>
                onNavigate('inventory', { inventoryTab: 'smartphones', onlyLowStock: false })
              }
            >
              Ver estoque completo
            </AuraButton>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EFECE6] text-[11px] font-medium text-[#6E6B63]">
                  <th className="pb-2.5 pr-4">Item</th>
                  <th className="pb-2.5 px-3">Categoria</th>
                  <th className="pb-2.5 px-3">Disponibilidade</th>
                  <th className="pb-2.5 px-3 text-right">Preço</th>
                  <th className="pb-2.5 pl-3 text-right">Código SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2EFE8] text-[13px]">
                {featuredPhones.map((sp) => (
                  <tr
                    key={sp.id}
                    onClick={() => onOpenSmartphone(sp)}
                    className="hover:bg-[#F9F8F4] transition-colors cursor-pointer"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium text-[#1F1E1B]">
                        {sp.model}
                        {sp.storage ? ` · ${sp.storage}` : ''}
                      </p>
                      <p className="text-xs text-[#6E6B63]">
                        {[sp.color, sp.condition].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-xs text-[#6E6B63]">
                      {labels.primaryItemSingular}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge label="Disponível" tone="olive" />
                    </td>
                    <td className="py-3 px-3 text-right font-medium tabular-nums text-[#1F1E1B]">
                      {formatCurrencyBRL(sp.salePrice)}
                    </td>
                    <td className="py-3 pl-3 text-right font-mono text-xs text-[#6E6B63]">
                      {sp.sku}
                    </td>
                  </tr>
                ))}

                {topAccessories.map((acc) => (
                  <tr
                    key={acc.id}
                    onClick={() =>
                      onNavigate('inventory', { inventoryTab: 'accessories', onlyLowStock: false })
                    }
                    className="hover:bg-[#F9F8F4] transition-colors cursor-pointer"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium text-[#1F1E1B]">{acc.name}</p>
                      <p className="text-xs text-[#6E6B63] tabular-nums">
                        {acc.soldThisMonth} vendidos no mês
                      </p>
                    </td>
                    <td className="py-3 px-3 text-xs text-[#6E6B63]">{acc.category}</td>
                    <td className="py-3 px-3">
                      {acc.stock <= acc.minStock ? (
                        <StatusBadge
                          label={acc.stock === 0 ? 'Esgotado' : `${acc.stock} un. (baixo)`}
                          tone={acc.stock === 0 ? 'terracotta' : 'amber'}
                        />
                      ) : (
                        <StatusBadge label={`${acc.stock} un.`} tone="olive" />
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-medium tabular-nums text-[#1F1E1B]">
                      {formatCurrencyBRL(acc.price)}
                    </td>
                    <td className="py-3 pl-3 text-right font-mono text-xs text-[#6E6B63]">
                      {acc.sku}
                    </td>
                  </tr>
                ))}

                {featuredPhones.length === 0 && topAccessories.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-[#6E6B63]">
                      Nenhum item cadastrado ainda neste workspace. Comece adicionando itens no Estoque.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Editorial Mini-Calendar */}
        <div className="xl:col-span-4 bg-white border border-[#E5E2D9] rounded-2xl p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-[#1F1E1B]">
                {formattedMonthLabel}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => setCalendarMonthOffset((m) => m - 1)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-[#6E6B63] hover:bg-[#F4F2EC] hover:text-[#1F1E1B] cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() => setCalendarMonthOffset((m) => m + 1)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-[#6E6B63] hover:bg-[#F4F2EC] hover:text-[#1F1E1B] cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-[#8C887E] mb-2">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <span key={i} className="py-1">
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs tabular-nums">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <span key={`empty-${i}`} className="h-8" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const isToday = year === 2026 && month === 10 && day === 20;
                const hasDue = highlightedCalendarDays.has(day);

                return (
                  <span
                    key={day}
                    className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center transition-colors ${
                      isToday
                        ? 'bg-[#4F5A47] text-white font-semibold'
                        : hasDue
                          ? 'bg-[#F6ECD9] text-[#855312] font-medium'
                          : 'text-[#2C2A25]'
                    }`}
                  >
                    {day}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#EFECE6] flex items-center justify-between text-[11px] text-[#6E6B63]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#4F5A47]" />
              Hoje (20/11)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F6ECD9] border border-[#DFC99B]" />
              {features.hasExpirationDate && !features.hasWarrantyQr
                ? 'Venc. de lote'
                : 'Venc. de garantia'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
