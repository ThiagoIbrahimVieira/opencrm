import React from 'react';
import {
  Check,
  ShieldCheck,
  PackageCheck,
  Plus,
  Minus,
  Smartphone as SmartphoneIcon,
  UserCheck,
  AlertCircle,
  Search,
  X,
} from 'lucide-react';
import {
  Accessory,
  CreateOrderInput,
  Customer,
  DeviceModel,
  Order,
  PaymentMethod,
  Smartphone,
  WarrantyDurationDays,
} from '../types/crm';
import { StoreTemplate } from '../types/template';
import { formatCurrencyBRL, formatDateBR, maskIMEI } from '../utils/imei';
import { AuraButton, StatusBadge } from './ui/AuraPrimitives';
import { CreatableSelect } from './ui/CreatableSelect';
import { apiRequest } from '../services/apiClient';

interface CheckoutViewProps {
  template: StoreTemplate;
  customers: Customer[];
  smartphones: Smartphone[];
  accessories: Accessory[];
  deviceModels: DeviceModel[];
  preselectedCustomerId: string | null;
  preselectedSmartphoneId: string | null;
  preselectedAccessoryId: string | null;
  onClearPreselections: () => void;
  onConfirmOrder: (input: CreateOrderInput) => Order;
  onOpenWarrantyCertificate: (order: Order, customer: Customer) => void;
}

const WARRANTY_OPTIONS: { days: WarrantyDurationDays; label: string; desc: string }[] = [
  { days: 90, label: '90 dias', desc: 'Cobertura padrão' },
  { days: 180, label: '180 dias', desc: 'Cobertura estendida' },
  { days: 365, label: '1 ano', desc: 'Cobertura completa' },
];

const PAYMENT_METHODS: PaymentMethod[] = [
  'PIX',
  'Cartão de Crédito',
  'Débito',
  'Dinheiro',
];

export function CheckoutView({
  template,
  customers,
  smartphones,
  accessories,
  deviceModels,
  preselectedCustomerId,
  preselectedSmartphoneId,
  preselectedAccessoryId,
  onClearPreselections,
  onConfirmOrder,
  onOpenWarrantyCertificate,
}: CheckoutViewProps) {
  const { labels, features } = template;
  const availablePhones = React.useMemo(
    () => smartphones.filter((s) => s.status !== 'Vendido'),
    [smartphones]
  );

  const [customerId, setCustomerId] = React.useState<string>(
    preselectedCustomerId ?? customers[0]?.id ?? ''
  );
  const [smartphoneId, setSmartphoneId] = React.useState<string>(
    preselectedSmartphoneId ?? ''
  );
  const [accessoryQuantities, setAccessoryQuantities] = React.useState<
    Record<string, number>
  >(() => (preselectedAccessoryId ? { [preselectedAccessoryId]: 1 } : {}));
  const [warrantyDays, setWarrantyDays] = React.useState<WarrantyDurationDays>(180);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('PIX');
  const [showAllAccessories, setShowAllAccessories] = React.useState(false);
  const [phoneSearch, setPhoneSearch] = React.useState('');
  const [accessorySearch, setAccessorySearch] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [cpfSearchQuery, setCpfSearchQuery] = React.useState('');
  const [cpfSearching, setCpfSearching] = React.useState(false);
  const [cpfSearchFeedback, setCpfSearchFeedback] = React.useState<string | null>(null);

  const handleSearchCpf = async () => {
    const clean = cpfSearchQuery.replace(/\D/g, '');
    if (!clean) {
      setCpfSearchFeedback('Digite ao menos os dígitos do CPF para buscar.');
      return;
    }
    setCpfSearchFeedback(null);
    setCpfSearching(true);

    // 1. Busca primeiro nos clientes em memória
    const localMatch = customers.find((c) => {
      const cDigits = (c.cpf || '').replace(/\D/g, '');
      return cDigits.includes(clean) || (c.cpfLast4 && clean.endsWith(c.cpfLast4));
    });

    if (localMatch) {
      setCustomerId(localMatch.id);
      setCpfSearchFeedback(`Cliente localizado: ${localMatch.name}`);
      setCpfSearching(false);
      return;
    }

    // 2. Consulta a API /api/customers/search?cpf=...
    try {
      const res = await apiRequest(`/api/customers/search?cpf=${encodeURIComponent(clean)}`);
      if (res?.customer) {
        setCustomerId(res.customer.id);
        setCpfSearchFeedback(`Cliente localizado via API: ${res.customer.name}`);
      } else if (Array.isArray(res) && res.length > 0) {
        setCustomerId(res[0].id);
        setCpfSearchFeedback(`Cliente localizado via API: ${res[0].name}`);
      } else {
        setCpfSearchFeedback('Nenhum cliente cadastrado com este CPF.');
      }
    } catch {
      setCpfSearchFeedback('Nenhum cliente localizado com este CPF.');
    } finally {
      setCpfSearching(false);
    }
  };

  // Reset checkout selections when switching stores
  React.useEffect(() => {
    setCustomerId(customers[0]?.id ?? '');
    setSmartphoneId('');
    setAccessoryQuantities({});
    setPhoneSearch('');
    setAccessorySearch('');
    setShowAllAccessories(!features.hasCompatibilityCrossSell);
    setErrorMsg(null);
  }, [template.id]);

  React.useEffect(() => {
    if (preselectedCustomerId) setCustomerId(preselectedCustomerId);
    if (preselectedSmartphoneId) setSmartphoneId(preselectedSmartphoneId);
    if (preselectedAccessoryId) {
      setAccessoryQuantities((prev) => ({
        ...prev,
        [preselectedAccessoryId]: Math.max(1, prev[preselectedAccessoryId] ?? 0),
      }));
    }
    if (preselectedCustomerId || preselectedSmartphoneId || preselectedAccessoryId) {
      onClearPreselections();
    }
  }, [
    preselectedCustomerId,
    preselectedSmartphoneId,
    preselectedAccessoryId,
    onClearPreselections,
  ]);

  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;
  const selectedPhone = availablePhones.find((p) => p.id === smartphoneId) ?? null;

  const modelLabelMap = React.useMemo(
    () => new Map(deviceModels.map((m) => [m.id, m.tagLabel])),
    [deviceModels]
  );

  // Suggest compatible in-stock accessories based on selected phone OR customer's owned device
  const relevantModelIds = React.useMemo(() => {
    if (selectedPhone) return [selectedPhone.modelId];
    if (selectedCustomer) return selectedCustomer.ownedModelIds;
    return [];
  }, [selectedPhone, selectedCustomer]);

  const suggestedAccessories = React.useMemo(() => {
    const modelSet = new Set(relevantModelIds);
    return accessories.filter(
      (a) =>
        a.stock > 0 &&
        (modelSet.size === 0 ||
          a.compatibleModelIds.some((id) => modelSet.has(id) || id === 'usb-c-universal'))
    );
  }, [accessories, relevantModelIds]);

  const filteredAvailablePhones = React.useMemo(() => {
    const q = phoneSearch.trim().toLowerCase();
    if (!q) return availablePhones;
    const digitsOnly = q.replace(/\D/g, '');
    return availablePhones.filter((sp) => {
      const customValues = sp.customAttributes
        ? Object.values(sp.customAttributes)
            .map((v) => (Array.isArray(v) ? v.join(' ') : String(v ?? '')))
            .join(' ')
        : '';
      const haystack = [
        sp.brand,
        sp.model,
        sp.color,
        sp.storage,
        sp.condition,
        sp.sku,
        sp.imei1,
        sp.imei2 ?? '',
        sp.serialNumber,
        customValues,
      ]
        .join(' ')
        .toLowerCase();
      if (haystack.includes(q)) return true;
      if (digitsOnly.length >= 3) {
        return (
          sp.imei1.includes(digitsOnly) ||
          (sp.imei2 ? sp.imei2.includes(digitsOnly) : false)
        );
      }
      return false;
    });
  }, [availablePhones, phoneSearch]);

  const baseAccessories = React.useMemo(
    () =>
      !features.hasCompatibilityCrossSell || showAllAccessories
        ? accessories.filter((a) => a.stock > 0)
        : suggestedAccessories,
    [
      features.hasCompatibilityCrossSell,
      showAllAccessories,
      accessories,
      suggestedAccessories,
    ]
  );

  const displayedAccessories = React.useMemo(() => {
    const q = accessorySearch.trim().toLowerCase();
    if (!q) return baseAccessories;
    return baseAccessories.filter((acc) => {
      const compatLabels = acc.compatibleModelIds
        .map((id) => modelLabelMap.get(id) ?? id)
        .join(' ');
      const haystack = [
        acc.name,
        acc.sku,
        acc.category,
        acc.brand ?? '',
        acc.ean ?? '',
        compatLabels,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [baseAccessories, accessorySearch, modelLabelMap]);

  const setAccQty = (acc: Accessory, nextQty: number) => {
    const clamped = Math.max(0, Math.min(acc.stock, nextQty));
    setAccessoryQuantities((prev) => {
      const next = { ...prev };
      if (clamped === 0) {
        delete next[acc.id];
      } else {
        next[acc.id] = clamped;
      }
      return next;
    });
  };

  const selectedAccessoryLines = Object.entries(accessoryQuantities)
    .map(([id, qty]) => {
      const acc = accessories.find((a) => a.id === id);
      return acc && qty > 0 ? { acc, qty } : null;
    })
    .filter(Boolean) as { acc: Accessory; qty: number }[];

  const accessoriesSubtotal = selectedAccessoryLines.reduce(
    (sum, line) => sum + line.acc.price * line.qty,
    0
  );
  const grandTotal = (selectedPhone?.salePrice ?? 0) + accessoriesSubtotal;

  const handleSubmit = () => {
    setErrorMsg(null);
    if (!selectedCustomer) {
      setErrorMsg('Selecione um cliente para registrar a saída.');
      return;
    }
    if (!selectedPhone && selectedAccessoryLines.length === 0) {
      setErrorMsg('Selecione ao menos um aparelho ou acessório para confirmar a saída.');
      return;
    }

    try {
      const order = onConfirmOrder({
        customerId: selectedCustomer.id,
        smartphoneId: selectedPhone?.id,
        accessoryItems: selectedAccessoryLines.map((l) => ({
          accessoryId: l.acc.id,
          quantity: l.qty,
        })),
        warrantyDays,
        paymentMethod,
      });

      // Reset selections cleanly after checkout
      setSmartphoneId('');
      setAccessoryQuantities({});
      onOpenWarrantyCertificate(order, selectedCustomer);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao registrar saída.');
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-[32px] leading-tight text-[#1F1E1B]">
          {features.hasWarrantyQr
            ? `${labels.orderActionLabel} & Termo de Garantia`
            : `${labels.orderActionLabel} · ${template.storeName}`}
        </h1>
        <p className="text-sm text-[#6E6B63] mt-0.5">
          {features.hasWarrantyQr
            ? `Dê baixa imediata no estoque, adicione ${labels.secondaryTabName.toLowerCase()} e emita o termo imprimível.`
            : `Selecione o cliente, monte o pedido com ${labels.primaryTabName.toLowerCase()} e ${labels.secondaryTabName.toLowerCase()} e emita o comprovante.`}
        </p>
      </header>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl bg-[#F8E5E2] border border-[#EAC5BF] px-4 py-3 text-xs text-[#9B3B2B] flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Counter Selection Steps (7 cols) */}
        <div className="xl:col-span-7 space-y-5">
          {/* Step 1: Select Customer */}
          <section className="bg-white border border-[#E5E2D9] rounded-2xl p-5 shadow-[0_1px_2px_rgba(28,25,23,0.03)] space-y-3.5">
            <div className="flex items-center gap-2.5">
              <span className="h-6 w-6 rounded-full bg-[#4F5A47] text-white text-xs font-medium flex items-center justify-center tabular-nums">
                1
              </span>
              <h2 className="text-sm font-semibold text-[#1F1E1B]">
                Selecionar Cliente
              </h2>
            </div>

            {/* Campo de busca rápida de cliente por CPF com botão Buscar */}
            <div className="space-y-1.5">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 text-[#8C887E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={cpfSearchQuery}
                    onChange={(e) => {
                      setCpfSearchQuery(e.target.value);
                      if (cpfSearchFeedback) setCpfSearchFeedback(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchCpf();
                      }
                    }}
                    placeholder="Busca rápida por CPF (digite o CPF)..."
                    className="w-full h-9.5 pl-8 pr-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                  />
                </div>
                <AuraButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSearchCpf}
                  disabled={cpfSearching || !cpfSearchQuery.trim()}
                >
                  {cpfSearching ? 'Buscando...' : 'Buscar CPF'}
                </AuraButton>
              </div>
              {cpfSearchFeedback && (
                <p className="text-[11px] text-[#4F5A47] font-medium px-1">
                  {cpfSearchFeedback}
                </p>
              )}
            </div>

            <CreatableSelect
              id="checkout-customer"
              value={customerId}
              creatable={false}
              placeholder="Selecione um cliente..."
              searchPlaceholder="Buscar cliente por nome, CPF (final), telefone ou tag..."
              options={customers.map((cu) => ({
                value: cu.id,
                label: cu.name,
                sublabel: `${cu.city} · ${cu.email} · CPF final ${cu.cpfLast4 || (cu.cpf ? cu.cpf.slice(-4) : '••••')}`,
                searchKeywords: `${cu.phone} ${cu.phone.replace(/\D/g, '')} ${cu.cpfLast4 || ''} ${(cu.cpf || '').replace(/\D/g, '')} ${cu.tags.join(' ')}`,
              }))}
              onChange={setCustomerId}
            />

            {selectedCustomer && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E6B63] bg-[#F8F7F3] rounded-xl px-3.5 py-2.5">
                <span className="inline-flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-[#4F5A47]" />
                  {selectedCustomer.email}
                </span>
                {features.hasCompatibilityCrossSell &&
                selectedCustomer.ownedModelIds.length > 0 ? (
                  <span>
                    Referência no perfil:{' '}
                    <strong className="font-medium text-[#1F1E1B]">
                      {selectedCustomer.ownedModelIds
                        .map((id) => modelLabelMap.get(id) ?? id)
                        .join(', ')}
                    </strong>
                  </span>
                ) : selectedCustomer.tags.length > 0 ? (
                  <span className="truncate">
                    Tags:{' '}
                    <strong className="font-medium text-[#1F1E1B]">
                      {selectedCustomer.tags.slice(0, 3).join(' · ')}
                    </strong>
                  </span>
                ) : (
                  <span>{selectedCustomer.city}</span>
                )}
              </div>
            )}
          </section>

          {/* Step 2: Select Primary Item */}
          <section className="bg-white border border-[#E5E2D9] rounded-2xl p-5 shadow-[0_1px_2px_rgba(28,25,23,0.03)] space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 rounded-full bg-[#4F5A47] text-white text-xs font-medium flex items-center justify-center tabular-nums">
                  2
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[#1F1E1B]">
                    Escolher {labels.primaryItemSingular} Disponível
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-[#7A776E] tabular-nums">
                  Exibindo {filteredAvailablePhones.length} de {availablePhones.length} disponíveis
                </span>
                {smartphoneId && (
                  <button
                    type="button"
                    onClick={() => setSmartphoneId('')}
                    className="text-xs font-medium text-[#6E6B63] hover:text-[#1F1E1B] cursor-pointer"
                  >
                    Remover seleção
                  </button>
                )}
              </div>
            </div>

            {/* Inline Instant Search for Step 2 */}
            {availablePhones.length > 0 && (
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-[#8C887E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={phoneSearch}
                  onChange={(e) => setPhoneSearch(e.target.value)}
                  placeholder={
                    features.hasSerializedItems
                      ? 'Buscar por modelo, cor, armazenamento, IMEI ou SKU...'
                      : `Buscar ${labels.primaryItemSingular.toLowerCase()} por nome, SKU ou atributo...`
                  }
                  aria-label={`Buscar ${labels.primaryItemSingular.toLowerCase()} disponível`}
                  className="w-full h-9 pl-8 pr-8 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47] focus:bg-white transition-colors"
                />
                {phoneSearch && (
                  <button
                    type="button"
                    aria-label="Limpar busca de itens"
                    onClick={() => setPhoneSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C887E] hover:text-[#1F1E1B] cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            <div className="max-h-[420px] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredAvailablePhones.map((sp) => {
                  const active = sp.id === smartphoneId;
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSmartphoneId(active ? '' : sp.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-[#F4F6F1] border-[#4F5A47] ring-1 ring-[#4F5A47]'
                          : 'bg-[#FAF9F6] border-[#E5E2D9] hover:border-[#C5C0B3]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#1F1E1B] truncate">
                            {features.hasSerializedItems && sp.storage !== '—'
                              ? `${sp.model} · ${sp.storage}`
                              : sp.model}
                          </p>
                          <p className="text-xs text-[#6E6B63] truncate">
                            {features.hasSerializedItems
                              ? `${sp.color} · ${sp.condition}`
                              : `${sp.brand} · ${sp.condition}`}
                          </p>
                        </div>
                        <span
                          className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border ${
                            active
                              ? 'bg-[#4F5A47] border-[#4F5A47] text-white'
                              : 'bg-white border-[#CFCBC0]'
                          }`}
                        >
                          {active && <Check className="h-3 w-3 stroke-[2.5]" />}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#EAE7DF] text-xs">
                        <span className="font-mono text-[11px] text-[#6E6B63]">
                          {features.hasSerializedItems
                            ? maskIMEI(sp.imei1)
                            : sp.expiresAt
                              ? `Val. ${formatDateBR(sp.expiresAt)}`
                              : sp.sku}
                        </span>
                        <span className="font-semibold tabular-nums text-[#1F1E1B]">
                          {formatCurrencyBRL(sp.salePrice)}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {availablePhones.length === 0 && (
                  <p className="col-span-2 text-xs text-[#6E6B63] py-4">
                    Nenhum item disponível em {labels.primaryTabName}. Cadastre novos itens no Estoque.
                  </p>
                )}

                {availablePhones.length > 0 && filteredAvailablePhones.length === 0 && (
                  <div className="col-span-2 rounded-xl bg-[#FAF9F6] border border-dashed border-[#DDDAD0] px-4 py-8 text-center space-y-2">
                    <p className="text-xs font-medium text-[#2C2A25]">
                      Nenhum item corresponde a &ldquo;{phoneSearch}&rdquo;
                    </p>
                    <p className="text-[11px] text-[#7A776E]">
                      Tente buscar por outro nome, SKU ou característica cadastrada.
                    </p>
                    <button
                      type="button"
                      onClick={() => setPhoneSearch('')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#4F5A47] hover:underline cursor-pointer"
                    >
                      Limpar busca
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Step 3: Secondary Items / Cross-Sell */}
          <section className="bg-white border border-[#E5E2D9] rounded-2xl p-5 shadow-[0_1px_2px_rgba(28,25,23,0.03)] space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 rounded-full bg-[#4F5A47] text-white text-xs font-medium flex items-center justify-center tabular-nums">
                  3
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[#1F1E1B] flex items-center gap-1.5">
                    {labels.crossSellTitle}
                    <PackageCheck className="h-3.5 w-3.5 text-[#4F5A47]" />
                  </h2>
                  <p className="text-xs text-[#6E6B63]">
                    {features.hasCompatibilityCrossSell
                      ? selectedPhone
                        ? `Sugeridos para ${selectedPhone.model}`
                        : 'Sugeridos para o perfil do cliente'
                      : `${labels.secondaryTabName} disponíveis em estoque`}
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-[#7A776E] tabular-nums">
                Exibindo {displayedAccessories.length} de {baseAccessories.length}
              </span>
            </div>

            {/* Compact Search Bar + Quick Scope Toggle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="h-3.5 w-3.5 text-[#8C887E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={accessorySearch}
                  onChange={(e) => setAccessorySearch(e.target.value)}
                  placeholder={`Buscar ${labels.secondaryItemSingular.toLowerCase()} por nome, SKU ou categoria...`}
                  aria-label={`Buscar ${labels.secondaryItemSingular.toLowerCase()} no checkout`}
                  className="w-full h-9 pl-8 pr-8 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47] focus:bg-white transition-colors"
                />
                {accessorySearch && (
                  <button
                    type="button"
                    aria-label="Limpar busca de itens secundários"
                    onClick={() => setAccessorySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C887E] hover:text-[#1F1E1B] cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {features.hasCompatibilityCrossSell && (
                <div
                  role="group"
                  aria-label="Filtro de escopo de itens"
                  className="inline-flex items-center p-0.5 rounded-xl bg-[#EFECE6] border border-[#E5E2D9] shrink-0"
                >
                  <button
                    type="button"
                    aria-pressed={!showAllAccessories}
                    onClick={() => setShowAllAccessories(false)}
                    className={`h-8 px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      !showAllAccessories
                        ? 'bg-[#4F5A47] text-white shadow-xs'
                        : 'text-[#5C5952] hover:text-[#1F1E1B]'
                    }`}
                  >
                    Sugeridos / Compatíveis
                  </button>
                  <button
                    type="button"
                    aria-pressed={showAllAccessories}
                    onClick={() => setShowAllAccessories(true)}
                    className={`h-8 px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      showAllAccessories
                        ? 'bg-[#4F5A47] text-white shadow-xs'
                        : 'text-[#5C5952] hover:text-[#1F1E1B]'
                    }`}
                  >
                    Todos em estoque
                  </button>
                </div>
              )}
            </div>

            <div className="max-h-[360px] overflow-y-auto pr-1 space-y-2">
              {displayedAccessories.map((acc) => {
                const qty = accessoryQuantities[acc.id] ?? 0;
                return (
                  <div
                    key={acc.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                      qty > 0
                        ? 'bg-[#F4F6F1] border-[#4F5A47]/50'
                        : 'bg-[#FAF9F6] border-[#ECE9E1]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#1F1E1B] truncate">
                        {acc.name}
                      </p>
                      <p className="text-xs text-[#6E6B63] tabular-nums">
                        <span className="font-mono text-[11px]">{acc.sku}</span> ·{' '}
                        {acc.category} · {acc.stock} em loja ·{' '}
                        <strong className="text-[#1F1E1B]">
                          {formatCurrencyBRL(acc.price)}
                        </strong>
                      </p>
                    </div>

                    {qty === 0 ? (
                      <AuraButton
                        variant="secondary"
                        size="sm"
                        onClick={() => setAccQty(acc, 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar
                      </AuraButton>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 bg-white border border-[#D4D0C5] rounded-lg px-1.5 py-1">
                        <button
                          type="button"
                          aria-label={`Diminuir quantidade de ${acc.name}`}
                          onClick={() => setAccQty(acc, qty - 1)}
                          className="h-6 w-6 rounded flex items-center justify-center text-[#4A4842] hover:bg-[#EFECE6] cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-semibold tabular-nums">
                          {qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Aumentar quantidade de ${acc.name}`}
                          disabled={qty >= acc.stock}
                          onClick={() => setAccQty(acc, qty + 1)}
                          className="h-6 w-6 rounded flex items-center justify-center text-[#4A4842] hover:bg-[#EFECE6] disabled:opacity-35 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {displayedAccessories.length === 0 && (
                <div className="rounded-xl bg-[#FAF9F6] border border-dashed border-[#DDDAD0] px-4 py-7 text-center space-y-2">
                  <p className="text-xs font-medium text-[#2C2A25]">
                    {accessorySearch.trim()
                      ? `Nenhum acessório encontrado para "${accessorySearch}"`
                      : 'Nenhum acessório compatível disponível em estoque.'}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    {accessorySearch.trim() && (
                      <button
                        type="button"
                        onClick={() => setAccessorySearch('')}
                        className="text-xs font-medium text-[#4F5A47] hover:underline cursor-pointer"
                      >
                        Limpar busca
                      </button>
                    )}
                    {!showAllAccessories && (
                      <button
                        type="button"
                        onClick={() => setShowAllAccessories(true)}
                        className="text-xs font-medium text-[#6E6B63] hover:text-[#1F1E1B] hover:underline cursor-pointer"
                      >
                        Ver todos em estoque
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right: Warranty, Payment & Summary Card (5 cols) */}
        <aside className="xl:col-span-5 bg-white border border-[#E5E2D9] rounded-2xl p-6 shadow-[0_1px_2px_rgba(28,25,23,0.03)] space-y-5 xl:sticky xl:top-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#EFECE6]">
            <div>
              <h2 className="font-serif text-2xl text-[#1F1E1B] leading-tight">
                Resumo do Balcão
              </h2>
              <p className="text-xs text-[#6E6B63] mt-0.5">
                {features.hasWarrantyQr
                  ? 'Conferência antes da baixa e emissão do termo'
                  : 'Conferência antes do fechamento do pedido'}
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 text-[#4F5A47]" />
          </div>

          {/* Warranty Duration Selector (only when template hasWarrantyQr) */}
          {features.hasWarrantyQr && (
            <div>
              <p className="text-xs font-medium text-[#4A4842] mb-2">
                Prazo do Termo de Garantia
              </p>
              <div className="grid grid-cols-3 gap-2">
                {WARRANTY_OPTIONS.map((opt) => {
                  const active = warrantyDays === opt.days;
                  return (
                    <button
                      key={opt.days}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setWarrantyDays(opt.days)}
                      className={`p-2.5 rounded-xl border text-center transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#4F5A47] text-white border-[#4F5A47]'
                          : 'bg-[#FAF9F6] text-[#1F1E1B] border-[#DDDAD0] hover:border-[#ABA596]'
                      }`}
                    >
                      <p className="text-xs font-semibold tabular-nums">{opt.label}</p>
                      <p
                        className={`text-[10px] mt-0.5 ${
                          active ? 'text-[#E6ECE3]' : 'text-[#6E6B63]'
                        }`}
                      >
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment Method Selector */}
          <div>
            <p className="text-xs font-medium text-[#4A4842] mb-2">
              Forma de Pagamento
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((pm) => {
                const active = paymentMethod === pm;
                return (
                  <button
                    key={pm}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPaymentMethod(pm)}
                    className={`h-9 px-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#E8E3D9] text-[#1F1E1B] border-[#BEB7A8]'
                        : 'bg-white text-[#6E6B63] border-[#E5E2D9] hover:text-[#1F1E1B]'
                    }`}
                  >
                    {pm}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Items Breakdown */}
          <div className="pt-4 border-t border-[#EFECE6] space-y-2.5 text-xs">
            <p className="font-medium text-[#6E6B63]">Itens selecionados</p>

            {selectedPhone ? (
              <div className="flex items-start justify-between gap-2 py-1.5">
                <div className="flex items-start gap-2">
                  <SmartphoneIcon className="h-3.5 w-3.5 text-[#4F5A47] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-[#1F1E1B]">
                      {features.hasSerializedItems && selectedPhone.storage !== '—'
                        ? `${selectedPhone.model} · ${selectedPhone.storage}`
                        : selectedPhone.model}
                    </p>
                    <p className="text-[11px] font-mono text-[#6E6B63]">
                      {features.hasSerializedItems
                        ? `IMEI ${maskIMEI(selectedPhone.imei1)}`
                        : `SKU ${selectedPhone.sku}`}
                    </p>
                  </div>
                </div>
                <span className="font-semibold tabular-nums text-[#1F1E1B]">
                  {formatCurrencyBRL(selectedPhone.salePrice)}
                </span>
              </div>
            ) : (
              <p className="text-[#8C887E] italic">
                Nenhum {labels.primaryItemSingular.toLowerCase()} selecionado
              </p>
            )}

            {selectedAccessoryLines.map(({ acc, qty }) => (
              <div
                key={acc.id}
                className="flex items-center justify-between gap-2 py-1 text-[#2C2A25]"
              >
                <span className="truncate">
                  {qty}× {acc.name}
                </span>
                <span className="font-medium tabular-nums shrink-0">
                  {formatCurrencyBRL(acc.price * qty)}
                </span>
              </div>
            ))}
          </div>

          {/* Grand Total */}
          <div className="pt-4 border-t border-[#E5E2D9] flex items-baseline justify-between">
            <div>
              <p className="text-xs text-[#6E6B63]">Total do Pedido</p>
              {features.hasWarrantyQr ? (
                <StatusBadge label={`Garantia ${warrantyDays} dias`} tone="olive" />
              ) : (
                <StatusBadge label={paymentMethod} tone="stone" />
              )}
            </div>
            <p className="text-2xl font-semibold tabular-nums text-[#1F1E1B]">
              {formatCurrencyBRL(grandTotal)}
            </p>
          </div>

          <AuraButton
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!selectedCustomer || (!selectedPhone && selectedAccessoryLines.length === 0)}
            onClick={handleSubmit}
          >
            <ShieldCheck className="h-4.5 w-4.5" />
            {features.hasWarrantyQr
              ? 'Confirmar Saída e Gerar Termo'
              : `Confirmar ${labels.orderActionLabel}`}
          </AuraButton>
        </aside>
      </div>
    </div>
  );
}
