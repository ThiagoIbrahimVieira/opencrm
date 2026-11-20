import React from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Smartphone as SmartphoneIcon,
  Package,
  Plus,
} from 'lucide-react';
import {
  ChecklistItem,
  CreateAccessoryInput,
  CreateSmartphoneInput,
  Customer,
  DeviceModel,
  DeviceOrigin,
  DynamicCatalog,
  InventoryTab,
  SmartphoneStatus,
} from '../types/crm';
import { CustomFieldDefinition, StoreTemplate } from '../types/template';
import { DEFAULT_CHECKLIST_TEMPLATE } from '../data/mockData';
import { templateRequiresImeiLuhn } from '../data/templates';
import { formatCurrencyBRL, validateIMEI } from '../utils/imei';
import { AuraButton, AuraChecklist, AuraToggle } from './ui/AuraPrimitives';
import { CreatableMultiSelect, CreatableSelect } from './ui/CreatableSelect';

interface AddItemModalProps {
  template: StoreTemplate;
  open: boolean;
  initialMode: InventoryTab;
  isAdmin: boolean;
  deviceModels: DeviceModel[];
  catalog: DynamicCatalog;
  customers: Customer[];
  onClose: () => void;
  onAddCatalogOption: (field: keyof DynamicCatalog, label: string) => string;
  onAddDeviceModel: (params: { name: string; brand?: string }) => DeviceModel;
  onCreateSmartphone: (input: CreateSmartphoneInput) => void;
  onCreateAccessory: (input: CreateAccessoryInput) => void;
}

const ORIGINS: DeviceOrigin[] = [
  'Fornecedor',
  'Troca de Cliente (Trade-in)',
  'Compra Direta',
];

function buildInitialCustomAttrs(
  fields: CustomFieldDefinition[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === 'boolean') {
      result[field.key] = false;
    } else if (field.type === 'multiselect') {
      result[field.key] = [];
    } else if (field.type === 'select') {
      result[field.key] = field.options?.[0] ?? '';
    } else {
      result[field.key] = '';
    }
  }
  return result;
}

export function AddItemModal({
  template,
  open,
  initialMode,
  isAdmin,
  deviceModels,
  catalog,
  customers,
  onClose,
  onAddCatalogOption,
  onAddDeviceModel,
  onCreateSmartphone,
  onCreateAccessory,
}: AddItemModalProps) {
  const { labels, features } = template;
  const usesSmartphoneImeiForm = templateRequiresImeiLuhn(template);
  const [mode, setMode] = React.useState<InventoryTab>(initialMode);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Smartphone form state (100% unlocked via CreatableSelects)
  const [brand, setBrand] = React.useState<string>('Apple');
  const [selectedModelId, setSelectedModelId] = React.useState<string>('iphone-16-pro-max');
  const [storage, setStorage] = React.useState<string>('256GB');
  const [ram, setRam] = React.useState<string>('8GB');
  const [color, setColor] = React.useState<string>('Titânio Deserto');
  const [condition, setCondition] = React.useState<string>('Novo Lacrado');
  const [batteryHealth, setBatteryHealth] = React.useState<number>(100);
  const [batteryCycles, setBatteryCycles] = React.useState<string>('');
  const [origin, setOrigin] = React.useState<DeviceOrigin>('Fornecedor');
  const [tradeInCustomerId, setTradeInCustomerId] = React.useState<string>(
    customers[0]?.id ?? ''
  );
  const [markAsEvaluating, setMarkAsEvaluating] = React.useState<boolean>(true);
  const [imei1, setImei1] = React.useState<string>('');
  const [imei2, setImei2] = React.useState<string>('');
  const [serialNumber, setSerialNumber] = React.useState<string>('');
  const [costPrice, setCostPrice] = React.useState<string>('');
  const [salePrice, setSalePrice] = React.useState<string>('');
  const [notes, setNotes] = React.useState<string>('');
  const [checklist, setChecklist] = React.useState<ChecklistItem[]>(() =>
    DEFAULT_CHECKLIST_TEMPLATE.map((c) => ({ ...c }))
  );

  // Dynamic non-serialized primary form state
  const [genericName, setGenericName] = React.useState<string>('');
  const [genericBrand, setGenericBrand] = React.useState<string>(
    catalog.brands[0] ?? template.storeName
  );
  const [genericCondition, setGenericCondition] = React.useState<string>(
    catalog.conditions[0] ?? 'Padrão'
  );
  const [genericSerialCode, setGenericSerialCode] = React.useState<string>('');
  const [genericExpiresAt, setGenericExpiresAt] = React.useState<string>('');
  const [genericStockQty, setGenericStockQty] = React.useState<string>('1');
  const [genericStockUnit, setGenericStockUnit] = React.useState<string>('un.');
  const [genericStatus, setGenericStatus] = React.useState<SmartphoneStatus>('Disponível');
  const [stockUnitOptions, setStockUnitOptions] = React.useState<string[]>([
    'un.',
    'kg',
    'g',
    'L',
    'ml',
    'cx',
    'pct',
  ]);
  const [customAttrs, setCustomAttrs] = React.useState<Record<string, unknown>>(() =>
    buildInitialCustomAttrs(template.primaryFields)
  );
  const [customFieldExtraOptions, setCustomFieldExtraOptions] = React.useState<
    Record<string, string[]>
  >({});
  const [multiTagDrafts, setMultiTagDrafts] = React.useState<Record<string, string>>({});

  // Accessory / secondary form state
  const [sku, setSku] = React.useState<string>('');
  const [accName, setAccName] = React.useState<string>('');
  const [accBrand, setAccBrand] = React.useState<string>('');
  const [accEan, setAccEan] = React.useState<string>('');
  const [category, setCategory] = React.useState<string>(
    catalog.accessoryCategories[0] ?? 'Capinha'
  );
  const [stock, setStock] = React.useState<string>('10');
  const [minStock, setMinStock] = React.useState<string>('5');
  const [accCostPrice, setAccCostPrice] = React.useState<string>('');
  const [accPrice, setAccPrice] = React.useState<string>('');
  const [accExpiresAt, setAccExpiresAt] = React.useState<string>('');
  const [compatibleModelIds, setCompatibleModelIds] = React.useState<string[]>([
    'iphone-15-pro',
  ]);

  React.useEffect(() => {
    if (open) {
      setMode(initialMode);
      setErrorMsg(null);
    }
  }, [open, initialMode]);

  React.useEffect(() => {
    setGenericName('');
    setGenericBrand(catalog.brands[0] ?? template.storeName);
    setGenericCondition(catalog.conditions[0] ?? 'Padrão');
    setGenericSerialCode('');
    setGenericExpiresAt('');
    setGenericStockQty('1');
    setGenericStockUnit('un.');
    setGenericStatus('Disponível');
    setCustomAttrs(buildInitialCustomAttrs(template.primaryFields));
    setCustomFieldExtraOptions({});
    setMultiTagDrafts({});
    setCategory(catalog.accessoryCategories[0] ?? 'Geral');
    setAccExpiresAt('');
    setCompatibleModelIds(
      templateRequiresImeiLuhn(template) && deviceModels.length > 0
        ? [deviceModels[0].id]
        : []
    );
    setTradeInCustomerId(customers[0]?.id ?? '');
    setChecklist(
      (template.defaultChecklist.length > 0
        ? template.defaultChecklist
        : DEFAULT_CHECKLIST_TEMPLATE.map((c) => c.label)
      ).map((label, idx) => ({ id: `chk-${idx + 1}`, label, checked: true }))
    );
  }, [template.id]);

  const phoneModels = React.useMemo(
    () => deviceModels.filter((m) => m.brand !== 'Universal'),
    [deviceModels]
  );

  const brandModels = React.useMemo(() => {
    const byBrand = phoneModels.filter(
      (m) => m.brand.toLowerCase() === brand.toLowerCase()
    );
    return byBrand.length > 0 ? byBrand : phoneModels;
  }, [phoneModels, brand]);

  const activeModel =
    phoneModels.find((m) => m.id === selectedModelId) ?? brandModels[0];

  const handleBrandChange = (nextBrand: string) => {
    setBrand(nextBrand);
    const matching = phoneModels.filter(
      (m) => m.brand.toLowerCase() === nextBrand.toLowerCase()
    );
    if (matching.length > 0) {
      setSelectedModelId(matching[0].id);
    }
  };

  if (!open) return null;

  const imei1Result = validateIMEI(imei1);
  const imei2Result = imei2.trim().length > 0 ? validateIMEI(imei2) : null;

  const parsedSale = Number(salePrice) || 0;
  const parsedCost = Number(costPrice) || 0;
  const estimatedMargin =
    parsedSale > 0 && parsedCost > 0 ? parsedSale - parsedCost : null;
  const estimatedMarginPct =
    estimatedMargin !== null && parsedSale > 0
      ? Math.round((estimatedMargin / parsedSale) * 100)
      : null;

  const toggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleAddChecklistItem = (label: string) => {
    const id = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setChecklist((prev) => [...prev, { id, label, checked: true }]);
  };

  const handleSubmitSmartphone = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!usesSmartphoneImeiForm) {
      if (!genericName.trim()) {
        setErrorMsg(`Informe o nome do ${labels.primaryItemSingular.toLowerCase()}.`);
        return;
      }
      if (!parsedSale || parsedSale <= 0) {
        setErrorMsg('Informe um preço de venda válido.');
        return;
      }

      for (const field of template.primaryFields) {
        if (!field.required) continue;
        const val = customAttrs[field.key];
        const empty =
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0);
        if (empty) {
          setErrorMsg(`Preencha o campo obrigatório "${field.label}".`);
          return;
        }
      }

      const dateField = template.primaryFields.find((f) => f.type === 'date');
      const derivedExpiresAt =
        genericExpiresAt.trim() ||
        (dateField && typeof customAttrs[dateField.key] === 'string'
          ? (customAttrs[dateField.key] as string).trim()
          : '');

      const normalizedId = genericName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const firstSelectOrText = template.primaryFields.find(
        (f) => f.type === 'select' || f.type === 'text'
      );
      const secondaryHighlight =
        firstSelectOrText && typeof customAttrs[firstSelectOrText.key] === 'string'
          ? (customAttrs[firstSelectOrText.key] as string)
          : '—';

      const parsedStockQty = !features.hasSerializedItems
        ? Number(genericStockQty)
        : undefined;
      if (
        !features.hasSerializedItems &&
        (genericStockQty.trim() === '' ||
          Number.isNaN(parsedStockQty) ||
          (parsedStockQty ?? -1) < 0)
      ) {
        setErrorMsg('Informe uma quantidade em estoque válida (0 ou maior).');
        return;
      }

      try {
        onCreateSmartphone({
          modelId: normalizedId || `item-${Date.now()}`,
          brand: genericBrand.trim() || template.storeName,
          model: genericName.trim(),
          storage: secondaryHighlight || '—',
          color: '—',
          condition: genericCondition.trim() || 'Padrão',
          batteryHealth: 100,
          origin: 'Fornecedor',
          initialStatus: genericStatus,
          imei1: '',
          serialNumber:
            genericSerialCode.trim().toUpperCase() ||
            `REF-${Date.now().toString().slice(-6)}`,
          costPrice: isAdmin ? parsedCost || Math.round(parsedSale * 0.55) : 0,
          salePrice: parsedSale,
          stockQty: !features.hasSerializedItems ? parsedStockQty : undefined,
          stockUnit: !features.hasSerializedItems
            ? genericStockUnit.trim() || 'un.'
            : undefined,
          checklist: features.hasEntryChecklist ? checklist : [],
          notes,
          expiresAt: derivedExpiresAt || undefined,
          customAttributes: { ...customAttrs },
        });

        setGenericName('');
        setGenericSerialCode('');
        setGenericExpiresAt('');
        setGenericStockQty('1');
        setGenericStockUnit('un.');
        setGenericStatus('Disponível');
        setCostPrice('');
        setSalePrice('');
        setNotes('');
        setCustomAttrs(buildInitialCustomAttrs(template.primaryFields));
        onClose();
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : `Erro ao cadastrar ${labels.primaryItemSingular.toLowerCase()}.`
        );
      }
      return;
    }

    if (!imei1Result.valid) {
      setErrorMsg(imei1Result.reason ?? 'IMEI 1 inválido.');
      return;
    }
    if (imei2Result && !imei2Result.valid) {
      setErrorMsg(`IMEI 2: ${imei2Result.reason ?? 'inválido.'}`);
      return;
    }
    if (!serialNumber.trim()) {
      setErrorMsg('Informe o número de série do aparelho.');
      return;
    }
    if (!parsedSale || parsedSale <= 0) {
      setErrorMsg('Informe um preço de venda válido.');
      return;
    }

    const resolvedModelName = activeModel?.name ?? selectedModelId;
    const resolvedModelId = activeModel?.id ?? selectedModelId;

    try {
      onCreateSmartphone({
        modelId: resolvedModelId,
        brand,
        model: resolvedModelName,
        storage,
        ram: ram || undefined,
        color,
        condition,
        batteryHealth,
        batteryCycles: batteryCycles.trim() ? Number(batteryCycles) : undefined,
        origin,
        tradeInCustomerId:
          origin === 'Troca de Cliente (Trade-in)' ? tradeInCustomerId : undefined,
        initialStatus:
          origin === 'Troca de Cliente (Trade-in)' && markAsEvaluating
            ? 'Em Avaliação'
            : 'Disponível',
        imei1: imei1Result.cleaned,
        imei2: imei2Result?.cleaned,
        serialNumber: serialNumber.trim(),
        costPrice: isAdmin ? parsedCost || Math.round(parsedSale * 0.78) : 0,
        salePrice: parsedSale,
        checklist: features.hasEntryChecklist ? checklist : [],
        notes,
      });

      setImei1('');
      setImei2('');
      setSerialNumber('');
      setBatteryCycles('');
      setCostPrice('');
      setSalePrice('');
      setNotes('');
      setOrigin('Fornecedor');
      setChecklist(DEFAULT_CHECKLIST_TEMPLATE.map((c) => ({ ...c })));
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao cadastrar aparelho.');
    }
  };

  const handleSubmitAccessory = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedAccPrice = Number(accPrice);
    if (!accName.trim()) {
      setErrorMsg(
        `Informe o nome do ${labels.secondaryItemSingular.toLowerCase()}.`
      );
      return;
    }
    if (usesSmartphoneImeiForm && !sku.trim()) {
      setErrorMsg(
        `Preencha o código SKU do ${labels.secondaryItemSingular.toLowerCase()}.`
      );
      return;
    }
    if (!parsedAccPrice || parsedAccPrice <= 0) {
      setErrorMsg('Informe um preço unitário válido.');
      return;
    }

    const requiresStrictCompat =
      features.hasCompatibilityCrossSell &&
      usesSmartphoneImeiForm &&
      deviceModels.length > 0;

    if (requiresStrictCompat && compatibleModelIds.length === 0) {
      setErrorMsg('Selecione ao menos um modelo compatível.');
      return;
    }

    const autoSkuPrefix = accName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 4) || 'INS';
    const resolvedSku =
      sku.trim().toUpperCase() ||
      `${autoSkuPrefix}-${String(Date.now()).slice(-4)}`;

    try {
      onCreateAccessory({
        sku: resolvedSku,
        name: accName.trim(),
        brand: accBrand.trim() || undefined,
        ean: accEan.trim() || undefined,
        category: category.trim() || 'Geral',
        compatibleModelIds:
          features.hasCompatibilityCrossSell && compatibleModelIds.length > 0
            ? compatibleModelIds
            : ['usb-c-universal'],
        stock: Math.max(0, Number(stock) || 0),
        minStock: Math.max(1, Number(minStock) || 1),
        costPrice: isAdmin ? Number(accCostPrice) || 0 : 0,
        price: parsedAccPrice,
        expiresAt:
          features.hasExpirationDate && accExpiresAt.trim()
            ? accExpiresAt.trim()
            : undefined,
      });

      setSku('');
      setAccName('');
      setAccBrand('');
      setAccEan('');
      setStock('10');
      setMinStock('5');
      setAccCostPrice('');
      setAccPrice('');
      setAccExpiresAt('');
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : `Erro ao cadastrar ${labels.secondaryItemSingular.toLowerCase()}.`
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1F1E1B]/40 backdrop-blur-[2px] flex justify-end no-print"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cadastrar item no estoque"
        className="w-full max-w-2xl bg-[#F4F2EC] h-full shadow-2xl border-l border-[#DFDDD3] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-0 bg-white border-b border-[#E5E2D9] shrink-0">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
                <h2 className="font-serif text-2xl text-[#1F1E1B]">
                  Novo Cadastro · {template.storeName}
                </h2>
                <p className="text-xs text-[#6E6B63] mt-0.5">
                  {usesSmartphoneImeiForm
                    ? 'Busque ou crie marcas, modelos, cores e categorias dinamicamente na sessão.'
                    : `Formulário dinâmico gerado a partir do template de ${template.segment}.`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar formulário de cadastro"
                className="p-1.5 rounded-lg text-[#6E6B63] hover:bg-[#EFECE6] hover:text-[#1F1E1B] cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Clean Underlined Tabs */}
            <div className="flex items-center gap-6" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'smartphones'}
                onClick={() => {
                  setMode('smartphones');
                  setErrorMsg(null);
                }}
                className={`pb-3 text-[13px] font-medium border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                  mode === 'smartphones'
                    ? 'border-[#4F5A47] text-[#1F1E1B]'
                    : 'border-transparent text-[#6E6B63] hover:text-[#1F1E1B]'
                }`}
              >
                {usesSmartphoneImeiForm ? (
                  <SmartphoneIcon className="h-3.5 w-3.5" />
                ) : (
                  <Package className="h-3.5 w-3.5" />
                )}
                {labels.primaryItemSingular}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'accessories'}
                onClick={() => {
                  setMode('accessories');
                  setErrorMsg(null);
                }}
                className={`pb-3 text-[13px] font-medium border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                  mode === 'accessories'
                    ? 'border-[#4F5A47] text-[#1F1E1B]'
                    : 'border-transparent text-[#6E6B63] hover:text-[#1F1E1B]'
                }`}
              >
                <Package className="h-3.5 w-3.5" />
                {labels.secondaryItemSingular} / SKU
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {errorMsg && (
              <div
                role="alert"
                className="mb-5 rounded-xl bg-[#F8E5E2] border border-[#EAC5BF] px-4 py-3 text-xs text-[#9B3B2B] flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {mode === 'smartphones' ? (
              usesSmartphoneImeiForm ? (
                <form
                  id="add-smartphone-form"
                  onSubmit={handleSubmitSmartphone}
                  className="space-y-5"
                >
              {/* Brand, Model, Storage, RAM, Color, Condition (all CreatableSelects) */}
              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <CreatableSelect
                    id="sp-brand"
                    label="Marca *"
                    value={brand}
                    options={catalog.brands.map((b) => ({ value: b, label: b }))}
                    searchPlaceholder="Buscar ou criar marca..."
                    onChange={handleBrandChange}
                    onCreateOption={(label) => onAddCatalogOption('brands', label)}
                  />

                  <CreatableSelect
                    id="sp-model"
                    label="Modelo *"
                    value={selectedModelId}
                    options={brandModels.map((m) => ({
                      value: m.id,
                      label: m.name,
                      sublabel: m.brand,
                    }))}
                    searchPlaceholder="Buscar ou criar modelo..."
                    onChange={(val) => setSelectedModelId(val)}
                    onCreateOption={(label) => {
                      const created = onAddDeviceModel({ name: label, brand });
                      return created.id;
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <CreatableSelect
                    id="sp-storage"
                    label="Armazenamento *"
                    value={storage}
                    options={catalog.storages.map((s) => ({ value: s, label: s }))}
                    searchPlaceholder="Ex: 256GB, 2TB..."
                    onChange={setStorage}
                    onCreateOption={(label) => onAddCatalogOption('storages', label)}
                  />

                  <CreatableSelect
                    id="sp-ram"
                    label="Memória RAM (opcional)"
                    value={ram}
                    options={catalog.ramOptions.map((r) => ({ value: r, label: r }))}
                    placeholder="Opcional"
                    searchPlaceholder="Ex: 8GB, 12GB..."
                    onChange={setRam}
                    onCreateOption={(label) => onAddCatalogOption('ramOptions', label)}
                  />

                  <CreatableSelect
                    id="sp-color"
                    label="Cor / Acabamento *"
                    value={color}
                    options={catalog.colors.map((c) => ({ value: c, label: c }))}
                    searchPlaceholder="Buscar ou criar cor..."
                    onChange={setColor}
                    onCreateOption={(label) => onAddCatalogOption('colors', label)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
                  <CreatableSelect
                    id="sp-condition"
                    label="Condição *"
                    value={condition}
                    options={catalog.conditions.map((c) => ({ value: c, label: c }))}
                    searchPlaceholder="Buscar ou criar condição..."
                    onChange={setCondition}
                    onCreateOption={(label) => onAddCatalogOption('conditions', label)}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="sp-battery"
                        className="text-xs font-medium text-[#4A4842]"
                      >
                        Saúde da Bateria
                      </label>
                      <span className="text-xs font-semibold tabular-nums text-[#2E472D]">
                        {batteryHealth}%
                      </span>
                    </div>
                    <input
                      id="sp-battery"
                      type="range"
                      min={65}
                      max={100}
                      value={batteryHealth}
                      onChange={(e) => setBatteryHealth(Number(e.target.value))}
                      className="w-full accent-[#4F5A47] h-10 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="sp-cycles"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Ciclos de Bateria
                    </label>
                    <input
                      id="sp-cycles"
                      type="number"
                      min={0}
                      placeholder="Ex: 140 (opcional)"
                      value={batteryCycles}
                      onChange={(e) => setBatteryCycles(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm tabular-nums text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>
                </div>
              </div>

              {/* Origem do Aparelho & Trade-in Customer Link */}
              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 space-y-3.5">
                <p className="text-xs font-medium text-[#4A4842]">
                  Origem do Aparelho
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {ORIGINS.map((opt) => {
                    const active = origin === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setOrigin(opt)}
                        className={`h-9 px-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-[#4F5A47] text-white border-[#4F5A47]'
                            : 'bg-[#FAF9F6] text-[#4A4842] border-[#DDDAD0] hover:border-[#ABA596]'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {origin === 'Troca de Cliente (Trade-in)' && (
                  <div className="pt-2 border-t border-[#EFECE6] space-y-3">
                    <CreatableSelect
                      id="sp-tradein-customer"
                      label="Vincular Cliente do CRM (Trade-in)"
                      value={tradeInCustomerId}
                      creatable={false}
                      searchPlaceholder="Buscar cliente por nome, e-mail, telefone ou tag..."
                      options={customers.map((cu) => ({
                        value: cu.id,
                        label: cu.name,
                        sublabel: `${cu.city} · ${cu.email}`,
                        searchKeywords: `${cu.phone} ${cu.phone.replace(/\D/g, '')} ${cu.tags.join(' ')}`,
                      }))}
                      onChange={setTradeInCustomerId}
                    />
                    <AuraToggle
                      id="sp-evaluating-toggle"
                      label="Marcar status inicial como Em Avaliação"
                      checked={markAsEvaluating}
                      onChange={setMarkAsEvaluating}
                    />
                  </div>
                )}
              </div>

              {/* Technical Identifiers + Pricing (Cost & Margin strictly hidden for VENDEDOR) */}
              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="sp-imei1"
                      className="text-xs font-medium text-[#4A4842]"
                    >
                      IMEI 1 (15 dígitos · Algoritmo de Luhn) *
                    </label>
                    {imei1.length > 0 && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          imei1Result.valid
                            ? 'bg-[#E6ECE3] text-[#2E472D]'
                            : 'bg-[#F8E5E2] text-[#9B3B2B]'
                        }`}
                      >
                        {imei1Result.valid ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            Luhn válido
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            Inválido ({imei1Result.cleaned.length}/15)
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <input
                    id="sp-imei1"
                    type="text"
                    inputMode="numeric"
                    maxLength={17}
                    placeholder="Ex: 490154203237518"
                    value={imei1}
                    onChange={(e) => setImei1(e.target.value)}
                    className={`w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border font-mono text-[13px] text-[#1F1E1B] focus:outline-none ${
                      imei1.length > 0 && !imei1Result.valid
                        ? 'border-[#C96B5E] focus:border-[#9B3B2B]'
                        : 'border-[#DDDAD0] focus:border-[#4F5A47]'
                    }`}
                  />
                  {imei1.length > 0 && !imei1Result.valid && (
                    <p className="text-[11px] text-[#9B3B2B] mt-1">
                      {imei1Result.reason}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="sp-imei2"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      IMEI 2 (opcional)
                    </label>
                    <input
                      id="sp-imei2"
                      type="text"
                      inputMode="numeric"
                      maxLength={17}
                      placeholder="15 dígitos (eSIM)"
                      value={imei2}
                      onChange={(e) => setImei2(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] font-mono text-[13px] text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                    {imei2Result && !imei2Result.valid && (
                      <p className="text-[11px] text-[#9B3B2B] mt-1">
                        {imei2Result.reason}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="sp-serial"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Número de Série *
                    </label>
                    <input
                      id="sp-serial"
                      type="text"
                      placeholder="Ex: F2LZN94K0P9X"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] font-mono text-[13px] uppercase text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>
                </div>

                <div
                  className={`grid grid-cols-1 ${
                    isAdmin ? 'sm:grid-cols-2' : ''
                  } gap-3.5`}
                >
                  {isAdmin && (
                    <div>
                      <label
                        htmlFor="sp-cost"
                        className="block text-xs font-medium text-[#4A4842] mb-1.5"
                      >
                        Custo de Entrada (R$)
                      </label>
                      <input
                        id="sp-cost"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="4200"
                        value={costPrice}
                        onChange={(e) => setCostPrice(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm tabular-nums text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                      />
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="sp-price"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Preço de Venda (R$) *
                    </label>
                    <input
                      id="sp-price"
                      type="number"
                      min={1}
                      step="0.01"
                      placeholder="5490"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm tabular-nums text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>
                </div>

                {isAdmin && estimatedMargin !== null && (
                  <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#F8F7F3] border border-[#EFECE6] text-xs">
                    <span className="text-[#6E6B63]">Margem bruta estimada</span>
                    <span className="font-semibold text-[#2E472D] tabular-nums">
                      {formatCurrencyBRL(estimatedMargin)} ({estimatedMarginPct}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic 9-Item Physical Inspection Checklist + Inline Add Item */}
              <AuraChecklist
                title="Checklist Físico de Entrada"
                items={checklist}
                onToggle={toggleChecklist}
                onAddItem={handleAddChecklistItem}
              />

              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4">
                <label
                  htmlFor="sp-notes"
                  className="block text-xs font-medium text-[#4A4842] mb-1.5"
                >
                  Observações Técnicas (opcional)
                </label>
                <textarea
                  id="sp-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Procedência de troca, detalhes estéticos, garantia de fábrica..."
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47] resize-none"
                />
              </div>
                </form>
              ) : (
                <form
                  id="add-smartphone-form"
                  onSubmit={handleSubmitSmartphone}
                  className="space-y-5"
                >
                  {/* Dynamic Non-Serialized Item Core Details */}
                  <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 space-y-4">
                    <div>
                      <label
                        htmlFor="gen-name"
                        className="block text-xs font-medium text-[#4A4842] mb-1.5"
                      >
                        Nome do {labels.primaryItemSingular} *
                      </label>
                      <input
                        id="gen-name"
                        type="text"
                        value={genericName}
                        onChange={(e) => setGenericName(e.target.value)}
                        placeholder={`Ex: ${labels.primaryItemSingular} exclusivo da casa`}
                        className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <CreatableSelect
                        id="gen-brand"
                        label="Linha / Marca"
                        value={genericBrand}
                        options={catalog.brands.map((b) => ({ value: b, label: b }))}
                        searchPlaceholder="Buscar ou criar linha..."
                        onChange={setGenericBrand}
                        onCreateOption={(label) => onAddCatalogOption('brands', label)}
                      />

                      <CreatableSelect
                        id="gen-condition"
                        label="Categoria / Destaque"
                        value={genericCondition}
                        options={catalog.conditions.map((c) => ({ value: c, label: c }))}
                        searchPlaceholder="Buscar ou criar categoria..."
                        onChange={setGenericCondition}
                        onCreateOption={(label) => onAddCatalogOption('conditions', label)}
                      />
                    </div>

                    {features.hasSerializedItems && (
                      <div>
                        <label
                          htmlFor="gen-serial-code"
                          className="block text-xs font-medium text-[#4A4842] mb-1.5"
                        >
                          Código Único / Nº de Série ou Certificado
                        </label>
                        <input
                          id="gen-serial-code"
                          type="text"
                          value={genericSerialCode}
                          onChange={(e) => setGenericSerialCode(e.target.value)}
                          placeholder="Ex: CERT-2026-0841, LOTE-09A (opcional — gerado se vazio)"
                          className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm font-mono text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Metadata-Driven Custom Fields from template.primaryFields */}
                  {template.primaryFields.length > 0 && (
                    <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-[#1F1E1B]">
                          Campos Personalizados · {template.segment}
                        </p>
                        <span className="text-[11px] text-[#7A776E]">
                          {template.primaryFields.length} atributo(s)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {template.primaryFields.map((field) => {
                          const currentVal = customAttrs[field.key];
                          const fieldId = `custom-field-${field.key}`;

                          if (field.type === 'boolean') {
                            return (
                              <div
                                key={field.id}
                                className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl bg-[#FAF9F6] border border-[#EFECE6]"
                              >
                                <AuraToggle
                                  id={fieldId}
                                  label={`${field.label}${field.required ? ' *' : ''}`}
                                  checked={Boolean(currentVal)}
                                  onChange={(checked) =>
                                    setCustomAttrs((prev) => ({
                                      ...prev,
                                      [field.key]: checked,
                                    }))
                                  }
                                />
                              </div>
                            );
                          }

                          if (field.type === 'select') {
                            const mergedOptions = Array.from(
                              new Set([
                                ...(field.options ?? []),
                                ...(customFieldExtraOptions[field.key] ?? []),
                              ])
                            );
                            return (
                              <CreatableSelect
                                key={field.id}
                                id={fieldId}
                                label={`${field.label}${field.required ? ' *' : ''}`}
                                value={typeof currentVal === 'string' ? currentVal : ''}
                                options={mergedOptions.map((o) => ({
                                  value: o,
                                  label: o,
                                }))}
                                searchPlaceholder={`Buscar ou criar ${field.label.toLowerCase()}...`}
                                onChange={(val) =>
                                  setCustomAttrs((prev) => ({
                                    ...prev,
                                    [field.key]: val,
                                  }))
                                }
                                onCreateOption={(newLabel) => {
                                  setCustomFieldExtraOptions((prev) => ({
                                    ...prev,
                                    [field.key]: [...(prev[field.key] ?? []), newLabel],
                                  }));
                                  return newLabel;
                                }}
                              />
                            );
                          }

                          if (field.type === 'multiselect') {
                            const selectedList = Array.isArray(currentVal)
                              ? (currentVal as string[])
                              : [];
                            const allOpts = Array.from(
                              new Set([
                                ...(field.options ?? []),
                                ...(customFieldExtraOptions[field.key] ?? []),
                                ...selectedList,
                              ])
                            );
                            const draft = multiTagDrafts[field.key] ?? '';
                            const toggleOption = (opt: string) => {
                              setCustomAttrs((prev) => {
                                const curr = Array.isArray(prev[field.key])
                                  ? (prev[field.key] as string[])
                                  : [];
                                const next = curr.includes(opt)
                                  ? curr.filter((x) => x !== opt)
                                  : [...curr, opt];
                                return { ...prev, [field.key]: next };
                              });
                            };
                            const addCustomTag = () => {
                              const trimmed = draft.trim();
                              if (!trimmed) return;
                              setCustomFieldExtraOptions((prev) => ({
                                ...prev,
                                [field.key]: [...(prev[field.key] ?? []), trimmed],
                              }));
                              setCustomAttrs((prev) => {
                                const curr = Array.isArray(prev[field.key])
                                  ? (prev[field.key] as string[])
                                  : [];
                                return {
                                  ...prev,
                                  [field.key]: curr.includes(trimmed)
                                    ? curr
                                    : [...curr, trimmed],
                                };
                              });
                              setMultiTagDrafts((prev) => ({
                                ...prev,
                                [field.key]: '',
                              }));
                            };

                            return (
                              <div key={field.id} className="sm:col-span-2 space-y-2">
                                <label
                                  htmlFor={fieldId}
                                  className="block text-xs font-medium text-[#4A4842]"
                                >
                                  {field.label}
                                  {field.required ? ' *' : ''}
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                  {allOpts.map((opt) => {
                                    const active = selectedList.includes(opt);
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => toggleOption(opt)}
                                        className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                                          active
                                            ? 'bg-[#4F5A47] text-white border-[#4F5A47]'
                                            : 'bg-[#FAF9F6] text-[#4A4842] border-[#DDDAD0] hover:border-[#ABA596]'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <input
                                    id={fieldId}
                                    type="text"
                                    value={draft}
                                    onChange={(e) =>
                                      setMultiTagDrafts((prev) => ({
                                        ...prev,
                                        [field.key]: e.target.value,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addCustomTag();
                                      }
                                    }}
                                    placeholder="Adicionar nova tag..."
                                    className="flex-1 h-8 px-2.5 rounded-lg bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                                  />
                                  <button
                                    type="button"
                                    onClick={addCustomTag}
                                    className="h-8 px-2.5 rounded-lg bg-[#EFECE6] hover:bg-[#E4DFD4] text-xs font-medium text-[#2C2A25] inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Incluir
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={field.id}>
                              <label
                                htmlFor={fieldId}
                                className="block text-xs font-medium text-[#4A4842] mb-1.5"
                              >
                                {field.label}
                                {field.required ? ' *' : ''}
                              </label>
                              <input
                                id={fieldId}
                                type={
                                  field.type === 'number'
                                    ? 'number'
                                    : field.type === 'date'
                                      ? 'date'
                                      : 'text'
                                }
                                value={
                                  typeof currentVal === 'string' ||
                                  typeof currentVal === 'number'
                                    ? String(currentVal)
                                    : ''
                                }
                                placeholder={field.placeholder}
                                onChange={(e) =>
                                  setCustomAttrs((prev) => ({
                                    ...prev,
                                    [field.key]:
                                      field.type === 'number' && e.target.value !== ''
                                        ? Number(e.target.value)
                                        : e.target.value,
                                  }))
                                }
                                className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pricing & Optional Expiration Date */}
                  <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 space-y-4">
                    <div
                      className={`grid grid-cols-1 ${
                        isAdmin ? 'sm:grid-cols-2' : ''
                      } gap-3.5`}
                    >
                      {isAdmin && (
                        <div>
                          <label
                            htmlFor="gen-cost"
                            className="block text-xs font-medium text-[#4A4842] mb-1.5"
                          >
                            Custo Unitário (R$)
                          </label>
                          <input
                            id="gen-cost"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="18.00"
                            value={costPrice}
                            onChange={(e) => setCostPrice(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm tabular-nums text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                          />
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="gen-price"
                          className="block text-xs font-medium text-[#4A4842] mb-1.5"
                        >
                          Preço de Venda (R$) *
                        </label>
                        <input
                          id="gen-price"
                          type="number"
                          min={0.01}
                          step="0.01"
                          placeholder="42.00"
                          value={salePrice}
                          onChange={(e) => setSalePrice(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm tabular-nums text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                        />
                      </div>
                    </div>

                    {!features.hasSerializedItems && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 border-t border-[#EFECE6]">
                        <div>
                          <label
                            htmlFor="gen-stock-qty"
                            className="block text-xs font-medium text-[#4A4842] mb-1.5"
                          >
                            Quantidade em Estoque *
                          </label>
                          <input
                            id="gen-stock-qty"
                            type="number"
                            min={0}
                            step="any"
                            placeholder="1"
                            value={genericStockQty}
                            onChange={(e) => setGenericStockQty(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm tabular-nums text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                          />
                        </div>

                        <CreatableSelect
                          id="gen-stock-unit"
                          label="Unidade"
                          value={genericStockUnit}
                          options={stockUnitOptions.map((u) => ({
                            value: u,
                            label: u,
                          }))}
                          searchPlaceholder="Ex: un., kg, cx..."
                          onChange={setGenericStockUnit}
                          onCreateOption={(newUnit) => {
                            const clean = newUnit.trim();
                            setStockUnitOptions((prev) =>
                              prev.includes(clean) ? prev : [...prev, clean]
                            );
                            return clean;
                          }}
                        />

                        <CreatableSelect
                          id="gen-initial-status"
                          label="Status Inicial"
                          creatable={false}
                          value={genericStatus}
                          options={[
                            { value: 'Disponível', label: 'Disponível' },
                            { value: 'Reservado', label: 'Reservado' },
                            { value: 'Em Avaliação', label: 'Em Avaliação' },
                          ]}
                          searchPlaceholder="Escolher status..."
                          onChange={(val) => setGenericStatus(val as SmartphoneStatus)}
                        />
                      </div>
                    )}

                    {features.hasExpirationDate &&
                      !template.primaryFields.some((f) => f.type === 'date') && (
                        <div>
                          <label
                            htmlFor="gen-expires"
                            className="block text-xs font-medium text-[#4A4842] mb-1.5"
                          >
                            Validade do Lote (opcional)
                          </label>
                          <input
                            id="gen-expires"
                            type="date"
                            value={genericExpiresAt}
                            onChange={(e) => setGenericExpiresAt(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                          />
                        </div>
                      )}

                    {isAdmin && estimatedMargin !== null && (
                      <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#F8F7F3] border border-[#EFECE6] text-xs">
                        <span className="text-[#6E6B63]">Margem bruta estimada</span>
                        <span className="font-semibold text-[#2E472D] tabular-nums">
                          {formatCurrencyBRL(estimatedMargin)} ({estimatedMarginPct}%)
                        </span>
                      </div>
                    )}
                  </div>

                  {features.hasEntryChecklist && (
                    <AuraChecklist
                      title={`Checklist de ${labels.primaryItemSingular}`}
                      items={checklist}
                      onToggle={toggleChecklist}
                      onAddItem={handleAddChecklistItem}
                    />
                  )}

                  <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4">
                    <label
                      htmlFor="gen-notes"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Observações (opcional)
                    </label>
                    <textarea
                      id="gen-notes"
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Anotações internas sobre preparo, fornecedor ou destaque..."
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47] resize-none"
                    />
                  </div>
                </form>
              )
            ) : (
            <form
              id="add-accessory-form"
              onSubmit={handleSubmitAccessory}
              className="space-y-5"
            >
              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="acc-sku"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      {usesSmartphoneImeiForm
                        ? 'Código SKU *'
                        : 'Código SKU (opcional)'}
                    </label>
                    <input
                      id="acc-sku"
                      type="text"
                      placeholder={
                        usesSmartphoneImeiForm
                          ? 'Ex: CAP-MS-16P-AR'
                          : 'Gerado automaticamente se vazio'
                      }
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] font-mono text-[13px] uppercase text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>

                  <CreatableSelect
                    id="acc-category"
                    label="Categoria *"
                    value={category}
                    options={catalog.accessoryCategories.map((c) => ({
                      value: c,
                      label: c,
                    }))}
                    searchPlaceholder="Buscar ou criar categoria..."
                    onChange={setCategory}
                    onCreateOption={(label) =>
                      onAddCatalogOption('accessoryCategories', label)
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="acc-name"
                    className="block text-xs font-medium text-[#4A4842] mb-1.5"
                  >
                    Nome do {labels.secondaryItemSingular} *
                  </label>
                  <input
                    id="acc-name"
                    type="text"
                    placeholder={
                      usesSmartphoneImeiForm
                        ? 'Ex: Capa Silicone MagSafe Areia'
                        : `Ex: ${labels.secondaryItemSingular} padrão`
                    }
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="acc-brand"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Marca / Fabricante
                    </label>
                    <input
                      id="acc-brand"
                      type="text"
                      placeholder="Ex: Anker, Baseus, Spigen, HPrime..."
                      value={accBrand}
                      onChange={(e) => setAccBrand(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="acc-ean"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Código de Barras (EAN / opcional)
                    </label>
                    <input
                      id="acc-ean"
                      type="text"
                      inputMode="numeric"
                      placeholder="Ex: 7898641200999"
                      value={accEan}
                      onChange={(e) => setAccEan(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] font-mono text-[13px] text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>
                </div>

                <div
                  className={`grid grid-cols-2 ${
                    isAdmin ? 'sm:grid-cols-4' : 'sm:grid-cols-3'
                  } gap-3`}
                >
                  <div>
                    <label
                      htmlFor="acc-stock"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Qtd. Inicial
                    </label>
                    <input
                      id="acc-stock"
                      type="number"
                      min={0}
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm tabular-nums text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="acc-min-stock"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Alerta Mínimo
                    </label>
                    <input
                      id="acc-min-stock"
                      type="number"
                      min={1}
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm tabular-nums text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>

                  {isAdmin && (
                    <div>
                      <label
                        htmlFor="acc-cost"
                        className="block text-xs font-medium text-[#4A4842] mb-1.5"
                      >
                        Custo Unitário (R$)
                      </label>
                      <input
                        id="acc-cost"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="55"
                        value={accCostPrice}
                        onChange={(e) => setAccCostPrice(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm tabular-nums text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                      />
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="acc-price"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Preço Venda (R$) *
                    </label>
                    <input
                      id="acc-price"
                      type="number"
                      min={1}
                      step="0.01"
                      placeholder="169"
                      value={accPrice}
                      onChange={(e) => setAccPrice(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm tabular-nums text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>
                </div>
                {features.hasExpirationDate && (
                  <div>
                    <label
                      htmlFor="acc-expires"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Validade do Lote (opcional)
                    </label>
                    <input
                      id="acc-expires"
                      type="date"
                      value={accExpiresAt}
                      onChange={(e) => setAccExpiresAt(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>
                )}
              </div>

              {/* Searchable + Creatable Multi-Select for Compatible Models (only when enabled) */}
              {features.hasCompatibilityCrossSell && (
                <CreatableMultiSelect
                  label={
                    usesSmartphoneImeiForm
                      ? 'Modelos Compatíveis *'
                      : 'Itens Compatíveis / Combos (opcional)'
                  }
                  selectedValues={compatibleModelIds}
                  options={deviceModels.map((m) => ({
                    value: m.id,
                    label: m.tagLabel,
                    sublabel: m.brand,
                  }))}
                  onChange={setCompatibleModelIds}
                  onCreateOption={(newLabel) => {
                    const created = onAddDeviceModel({
                      name: newLabel,
                      brand: 'Universal',
                    });
                    return created.id;
                  }}
                />
              )}
            </form>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-6 py-4 bg-white border-t border-[#E5E2D9] flex items-center justify-end gap-2.5 shrink-0">
          <AuraButton variant="ghost" onClick={onClose}>
            Cancelar
          </AuraButton>
          <AuraButton
            variant="primary"
            type="submit"
            form={mode === 'smartphones' ? 'add-smartphone-form' : 'add-accessory-form'}
          >
            {mode === 'smartphones'
              ? `Cadastrar ${labels.primaryItemSingular}`
              : `Cadastrar ${labels.secondaryItemSingular}`}
          </AuraButton>
        </div>
      </div>
    </div>
  );
}
