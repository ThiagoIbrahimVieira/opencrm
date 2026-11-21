import React from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Layers,
  Plus,
  Sparkles,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import {
  BUILTIN_TEMPLATES,
  BUILTIN_TEMPLATE_PRESET_CARDS,
  GENERIC_RETAIL_PRESET_ID,
  OTHER_SEGMENT_OPTION,
  STORE_SEGMENT_SUGGESTIONS,
  getBlankScratchPreset,
  getContextualFeatureMeta,
  getSegmentScratchPreset,
  getSimpleCatalogScratchPreset,
  hasDedicatedSegmentPreset,
  isPhoneOrElectronicsSegment,
} from '../data/templates';
import {
  CustomFieldDefinition,
  CustomFieldType,
  StoreFeatureFlags,
  StoreLabels,
  StoreTemplate,
} from '../types/template';
import { AuraButton, AuraToggle, StatusBadge } from './ui/AuraPrimitives';
import { CreatableSelect } from './ui/CreatableSelect';

interface StoreWizardModalProps {
  open: boolean;
  onClose: () => void;
  onCreateStore: (template: StoreTemplate) => void;
  initialStoreName?: string;
  initialStartMode?: 'preset' | 'scratch';
}

type StartMode = 'preset' | 'scratch';
type ScratchVariant = 'preset' | 'blank';

const FIELD_TYPE_OPTIONS: { value: CustomFieldType; label: string; sublabel: string }[] = [
  { value: 'text', label: 'Texto', sublabel: 'Campo livre curto' },
  { value: 'number', label: 'Número', sublabel: 'Valor numérico ou tempo' },
  { value: 'select', label: 'Seleção', sublabel: 'Escolha única pesquisável' },
  { value: 'multiselect', label: 'Multi-tag', sublabel: 'Múltiplas etiquetas' },
  { value: 'date', label: 'Data', sublabel: 'Validade ou previsão' },
  { value: 'boolean', label: 'Sim / Não', sublabel: 'Interruptor tátil oliva' },
];

const INITIAL_SCRATCH_SEGMENT = 'Pet Shop & Clínica';

function slugifyKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function StoreWizardModal({
  open,
  onClose,
  onCreateStore,
  initialStoreName,
  initialStartMode,
}: StoreWizardModalProps) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Step 1: Identity & Start Mode
  const [storeName, setStoreName] = React.useState(initialStoreName ?? '');
  const [segment, setSegment] = React.useState(INITIAL_SCRATCH_SEGMENT);
  const [customSegment, setCustomSegment] = React.useState('');
  const [segmentOptions, setSegmentOptions] = React.useState<string[]>(
    STORE_SEGMENT_SUGGESTIONS
  );
  const [startMode, setStartMode] = React.useState<StartMode>(initialStartMode ?? 'scratch');
  const [scratchVariant, setScratchVariant] = React.useState<ScratchVariant>('preset');
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>(
    GENERIC_RETAIL_PRESET_ID
  );
  const [appliedScratchSegment, setAppliedScratchSegment] = React.useState<string>(
    INITIAL_SCRATCH_SEGMENT
  );

  // Step 2: Feature flags & dynamic labels
  const initialScratchPreset = React.useMemo(
    () => getSegmentScratchPreset(INITIAL_SCRATCH_SEGMENT),
    []
  );
  const [features, setFeatures] = React.useState<StoreFeatureFlags>(
    initialScratchPreset.features
  );
  const [labels, setLabels] = React.useState<StoreLabels>(initialScratchPreset.labels);

  // Step 3: Custom fields builder
  const [primaryFields, setPrimaryFields] = React.useState<CustomFieldDefinition[]>(
    initialScratchPreset.primaryFields
  );

  // New field composer inside Step 3
  const [newFieldLabel, setNewFieldLabel] = React.useState('');
  const [newFieldType, setNewFieldType] = React.useState<CustomFieldType>('text');
  const [newFieldOptionsRaw, setNewFieldOptionsRaw] = React.useState('');
  const [newFieldRequired, setNewFieldRequired] = React.useState(false);

  const isOtherSegment = segment === OTHER_SEGMENT_OPTION;
  const resolvedSegment = isOtherSegment ? customSegment.trim() : segment.trim();

  const applyScratchPresetForSegment = React.useCallback(
    (seg: string, variant: ScratchVariant = 'preset') => {
      const preset =
        variant === 'blank'
          ? getBlankScratchPreset()
          : hasDedicatedSegmentPreset(seg)
            ? getSegmentScratchPreset(seg)
            : getSimpleCatalogScratchPreset();
      setFeatures({ ...preset.features });
      setLabels({ ...preset.labels });
      setPrimaryFields(
        preset.primaryFields.map((f, idx) => ({
          ...f,
          id: `cf-seg-${idx}-${Date.now()}`,
          options: f.options ? [...f.options] : undefined,
        }))
      );
      setAppliedScratchSegment(`${variant}::${seg}`);
    },
    []
  );

  React.useEffect(() => {
    if (open) {
      const preset = getSegmentScratchPreset(INITIAL_SCRATCH_SEGMENT);
      setStep(1);
      setErrorMsg(null);
      setStoreName(initialStoreName ?? '');
      setStartMode(initialStartMode ?? 'scratch');
      setScratchVariant('preset');
      setSelectedPresetId(GENERIC_RETAIL_PRESET_ID);
      setSegment(INITIAL_SCRATCH_SEGMENT);
      setCustomSegment('');
      setFeatures({ ...preset.features });
      setLabels({ ...preset.labels });
      setPrimaryFields(
        preset.primaryFields.map((f, idx) => ({
          ...f,
          id: `cf-init-${idx + 1}`,
          options: f.options ? [...f.options] : undefined,
        }))
      );
      setAppliedScratchSegment(`preset::${INITIAL_SCRATCH_SEGMENT}`);
      setNewFieldLabel('');
      setNewFieldType('text');
      setNewFieldOptionsRaw('');
      setNewFieldRequired(false);
    }
  }, [open, initialStoreName, initialStartMode]);

  if (!open) return null;

  const contextualFeatures = getContextualFeatureMeta(resolvedSegment);
  const segmentHasDedicatedPreset = hasDedicatedSegmentPreset(resolvedSegment);
  const segmentPreviewPreset = segmentHasDedicatedPreset
    ? getSegmentScratchPreset(resolvedSegment)
    : getSimpleCatalogScratchPreset();

  const allSegmentSelectOptions = [
    ...segmentOptions
      .filter((s) => s !== OTHER_SEGMENT_OPTION)
      .map((s) => ({ value: s, label: s })),
    { value: OTHER_SEGMENT_OPTION, label: OTHER_SEGMENT_OPTION },
  ];

  const applyPresetTemplate = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId === GENERIC_RETAIL_PRESET_ID) {
      const generic = getSimpleCatalogScratchPreset();
      setFeatures({ ...generic.features });
      setLabels({ ...generic.labels });
      setPrimaryFields(
        generic.primaryFields.map((f, idx) => ({
          ...f,
          id: `cf-generic-${idx}-${Date.now()}`,
          options: f.options ? [...f.options] : undefined,
        }))
      );
      return;
    }

    const tpl = BUILTIN_TEMPLATES.find((t) => t.id === presetId);
    if (!tpl) return;
    setSegment(tpl.segment);
    setCustomSegment('');
    setFeatures({ ...tpl.features });
    setLabels({ ...tpl.labels });
    setPrimaryFields(
      tpl.primaryFields.map((f, idx) => ({
        ...f,
        id: `cf-preset-${idx}-${Date.now()}`,
        options: f.options ? [...f.options] : undefined,
      }))
    );
  };

  const handleSegmentSelectChange = (nextSegment: string) => {
    setSegment(nextSegment);
    setErrorMsg(null);
    if (nextSegment !== OTHER_SEGMENT_OPTION) {
      setCustomSegment('');
    }

    const targetSeg = nextSegment === OTHER_SEGMENT_OPTION ? '' : nextSegment;
    const matchingBuiltin = BUILTIN_TEMPLATES.find(
      (t) => t.segment.toLowerCase() === targetSeg.toLowerCase()
    );

    if (matchingBuiltin && startMode === 'preset') {
      applyPresetTemplate(matchingBuiltin.id);
      return;
    }

    // If user picks a segment with its own dedicated preset (e.g. Papelaria, Joalheria, Cafeteria, Pet Shop),
    // immediately align to that segment's preset so it is never stuck on Lanchonete or Celulares.
    if (hasDedicatedSegmentPreset(targetSeg)) {
      setStartMode('scratch');
      setScratchVariant('preset');
      applyScratchPresetForSegment(targetSeg, 'preset');
      return;
    }

    // For "Outro (especificar)" or custom generic segment
    if (startMode === 'preset') {
      applyPresetTemplate(GENERIC_RETAIL_PRESET_ID);
    } else {
      setScratchVariant('preset');
      applyScratchPresetForSegment(targetSeg, 'preset');
    }
  };

  const handleSelectStartMode = (mode: StartMode) => {
    setStartMode(mode);
    if (mode === 'preset') {
      const matchingBuiltin = BUILTIN_TEMPLATES.find(
        (t) => t.segment.toLowerCase() === resolvedSegment.toLowerCase()
      );
      applyPresetTemplate(matchingBuiltin ? matchingBuiltin.id : GENERIC_RETAIL_PRESET_ID);
    } else {
      const nextVariant: ScratchVariant = 'preset';
      setScratchVariant(nextVariant);
      applyScratchPresetForSegment(resolvedSegment, nextVariant);
    }
  };

  const handleSelectScratchVariant = (variant: ScratchVariant) => {
    setScratchVariant(variant);
    applyScratchPresetForSegment(resolvedSegment, variant);
  };

  const handleNextStep = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!storeName.trim()) {
        setErrorMsg('Informe o nome da sua loja para avançar.');
        return;
      }
      if (isOtherSegment && !customSegment.trim()) {
        setErrorMsg('Especifique o segmento da sua loja para continuar.');
        return;
      }
      const desiredScratchKey = `${scratchVariant}::${resolvedSegment}`;
      if (startMode === 'scratch' && desiredScratchKey !== appliedScratchSegment) {
        applyScratchPresetForSegment(resolvedSegment, scratchVariant);
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!labels.primaryTabName.trim() || !labels.secondaryTabName.trim()) {
        setErrorMsg('Defina os nomes das duas abas principais do estoque.');
        return;
      }
      setStep(3);
    }
  };

  const handleAddCustomField = () => {
    setErrorMsg(null);
    const cleanLabel = newFieldLabel.trim();
    if (!cleanLabel) {
      setErrorMsg('Digite o nome do campo customizado antes de adicionar.');
      return;
    }

    const parsedOptions =
      newFieldType === 'select' || newFieldType === 'multiselect'
        ? newFieldOptionsRaw
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;

    if (
      (newFieldType === 'select' || newFieldType === 'multiselect') &&
      (!parsedOptions || parsedOptions.length === 0)
    ) {
      setErrorMsg('Informe ao menos uma opção separada por vírgula para campos de seleção.');
      return;
    }

    const key = slugifyKey(cleanLabel) || `campo_${primaryFields.length + 1}`;
    const nextField: CustomFieldDefinition = {
      id: `cf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      key,
      label: cleanLabel,
      type: newFieldType,
      required: newFieldRequired,
      options: parsedOptions,
      placeholder:
        newFieldType === 'number'
          ? 'Ex: 15'
          : newFieldType === 'text'
            ? `Informe ${cleanLabel.toLowerCase()}...`
            : undefined,
      validator: 'none',
    };

    setPrimaryFields((prev) => [...prev, nextField]);
    setNewFieldLabel('');
    setNewFieldOptionsRaw('');
    setNewFieldRequired(false);
  };

  const handleRemoveField = (id: string) => {
    setPrimaryFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleToggleFieldRequired = (id: string) => {
    setPrimaryFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, required: !f.required } : f))
    );
  };

  const handleFinish = () => {
    setErrorMsg(null);
    if (!storeName.trim()) {
      setErrorMsg('Informe o nome da loja.');
      setStep(1);
      return;
    }

    if (isOtherSegment && !customSegment.trim()) {
      setErrorMsg('Especifique o segmento da sua loja.');
      setStep(1);
      return;
    }

    const finalSegment = resolvedSegment || 'Varejo Geral';
    const allowImeiLuhn = isPhoneOrElectronicsSegment(finalSegment);

    // Strip Luhn IMEI validator on non-phone/non-electronics segments and ensure date field when expiration is enabled
    const finalPrimaryFields: CustomFieldDefinition[] = primaryFields.map((f) => ({
      ...f,
      validator: allowImeiLuhn ? f.validator : 'none',
    }));
    if (
      features.hasExpirationDate &&
      !finalPrimaryFields.some((f) => f.type === 'date')
    ) {
      finalPrimaryFields.push({
        id: `cf-auto-exp-${Date.now()}`,
        key: 'validade_lote',
        label: 'Validade do Lote',
        type: 'date',
        required: false,
        validator: 'none',
      });
    }

    const newTemplate: StoreTemplate = {
      id: `store-${slugifyKey(storeName)}-${Date.now().toString().slice(-3)}`,
      storeName: storeName.trim(),
      segment: finalSegment,
      description: `Workspace configurado no Open CRM para ${storeName.trim()} (${finalSegment}).`,
      labels: {
        primaryTabName: labels.primaryTabName.trim() || 'Produtos',
        secondaryTabName: labels.secondaryTabName.trim() || 'Complementos',
        primaryItemSingular: labels.primaryItemSingular.trim() || 'Produto',
        secondaryItemSingular: labels.secondaryItemSingular.trim() || 'Complemento',
        orderActionLabel: labels.orderActionLabel.trim() || 'Novo Pedido',
        crossSellTitle: labels.crossSellTitle.trim() || 'Itens Sugeridos',
      },
      features: { ...features },
      primaryFields: finalPrimaryFields,
      secondaryFields: features.hasExpirationDate
        ? [
            {
              id: `cf-sec-exp-${Date.now()}`,
              key: 'validade_lote',
              label: 'Validade do Lote',
              type: 'date',
              required: false,
              validator: 'none',
            },
          ]
        : [],
      defaultChecklist: features.hasEntryChecklist
        ? [
            'Embalagem e integridade conferidas',
            'Etiqueta de preço e SKU aplicada',
            'Qualidade visual aprovada no balcão',
          ]
        : [],
    };

    onCreateStore(newTemplate);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1F1E1B]/45 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto no-print"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Criar nova loja no Open CRM"
        className="w-full max-w-4xl bg-[#F4F2EC] rounded-2xl border border-[#DFDDD3] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header + Stepper */}
        <div className="px-6 py-5 bg-white border-b border-[#E5E2D9] shrink-0 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#4F5A47] text-[#F4F2EC] flex items-center justify-center shrink-0">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#7A776E]">
                  Open CRM · Construtor de Template
                </p>
                <h2 className="font-serif text-[26px] leading-tight text-[#1F1E1B]">
                  Criar Nova Loja / Segmento
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar assistente de nova loja"
              className="p-1.5 rounded-lg text-[#6E6B63] hover:bg-[#EFECE6] hover:text-[#1F1E1B] cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* 3-Step Editorial Progress Indicator */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { num: 1, title: '1. Identidade da Loja' },
                { num: 2, title: '2. Módulos & Rótulos' },
                { num: 3, title: '3. Campos & Preview' },
              ] as const
            ).map((item) => {
              const isCurrent = step === item.num;
              const isDone = step > item.num;
              return (
                <button
                  key={item.num}
                  type="button"
                  onClick={() => {
                    if (
                      item.num < step ||
                      (item.num === 2 &&
                        storeName.trim() &&
                        (!isOtherSegment || customSegment.trim()))
                    ) {
                      if (
                        item.num === 2 &&
                        startMode === 'scratch' &&
                        `${scratchVariant}::${resolvedSegment}` !== appliedScratchSegment
                      ) {
                        applyScratchPresetForSegment(resolvedSegment, scratchVariant);
                      }
                      setStep(item.num);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors text-left cursor-pointer ${
                    isCurrent
                      ? 'bg-[#F4F6F1] border-[#4F5A47] text-[#1F1E1B]'
                      : isDone
                        ? 'bg-[#FAF9F6] border-[#DFDDD3] text-[#2E472D]'
                        : 'bg-[#FAF9F6] border-[#EFECE6] text-[#8C887E]'
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] shrink-0 ${
                      isCurrent || isDone
                        ? 'bg-[#4F5A47] text-white'
                        : 'bg-[#E5E2D9] text-[#6E6B63]'
                    }`}
                  >
                    {isDone ? <Check className="h-3 w-3 stroke-[2.5]" /> : item.num}
                  </span>
                  <span className="truncate">{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-[#F8E5E2] border border-[#EAC5BF] px-4 py-3 text-xs text-[#9B3B2B] flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: IDENTIDADE DA LOJA */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="wizard-store-name"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Nome da Loja / Marca *
                    </label>
                    <input
                      id="wizard-store-name"
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Ex: Casa Pata Pet Shop, Papelaria Traço..."
                      className="w-full h-10 px-3.5 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>

                  <CreatableSelect
                    id="wizard-store-segment"
                    label="Segmento do Negócio *"
                    value={segment}
                    options={allSegmentSelectOptions}
                    searchPlaceholder="Buscar ou digitar segmento..."
                    onChange={handleSegmentSelectChange}
                    onCreateOption={(newLabel) => {
                      const clean = newLabel.trim();
                      if (
                        clean &&
                        clean !== OTHER_SEGMENT_OPTION &&
                        !segmentOptions.some(
                          (o) => o.toLowerCase() === clean.toLowerCase()
                        )
                      ) {
                        setSegmentOptions((prev) => [...prev, clean]);
                      }
                      return clean;
                    }}
                  />
                </div>

                {isOtherSegment && (
                  <div className="pt-1">
                    <label
                      htmlFor="wizard-custom-segment"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Qual o segmento da sua loja? *
                    </label>
                    <input
                      id="wizard-custom-segment"
                      type="text"
                      required
                      value={customSegment}
                      onChange={(e) => {
                        setCustomSegment(e.target.value);
                        setErrorMsg(null);
                      }}
                      placeholder="Ex: Joalheria, Barbearia, Floricultura, Adega..."
                      className="w-full h-10 px-3.5 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-sm text-[#1F1E1B] placeholder:text-[#9A968D] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>
                )}
              </div>

              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#1F1E1B]">
                    Como deseja configurar os módulos e campos?
                  </h3>
                  <p className="text-xs text-[#6E6B63] mt-0.5">
                    Cada loja nasce com base de estoque, clientes e pedidos 100% isolada.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    aria-pressed={startMode === 'scratch'}
                    onClick={() => handleSelectStartMode('scratch')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                      startMode === 'scratch'
                        ? 'bg-[#F4F6F1] border-[#4F5A47] ring-1 ring-[#4F5A47]'
                        : 'bg-[#FAF9F6] border-[#E5E2D9] hover:border-[#C5C0B3]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F1E1B]">
                        <Sparkles className="h-3.5 w-3.5 text-[#4F5A47]" />
                        Montar do zero
                      </span>
                      {startMode === 'scratch' && (
                        <Check className="h-4 w-4 text-[#4F5A47]" />
                      )}
                    </div>
                    <p className="text-xs text-[#6E6B63] leading-relaxed">
                      Escolha livremente os módulos ativos, rótulos de menu e campos customizados do seu balcão.
                    </p>
                  </button>

                  <button
                    type="button"
                    aria-pressed={startMode === 'preset'}
                    onClick={() => handleSelectStartMode('preset')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                      startMode === 'preset'
                        ? 'bg-[#F4F6F1] border-[#4F5A47] ring-1 ring-[#4F5A47]'
                        : 'bg-[#FAF9F6] border-[#E5E2D9] hover:border-[#C5C0B3]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F1E1B]">
                        <Layers className="h-3.5 w-3.5 text-[#4F5A47]" />
                        Começar de um modelo pronto
                      </span>
                      {startMode === 'preset' && (
                        <Check className="h-4 w-4 text-[#4F5A47]" />
                      )}
                    </div>
                    <p className="text-xs text-[#6E6B63] leading-relaxed">
                      Herde a estrutura de Celulares, Lanchonete ou Moda e personalize como preferir nas próximas etapas.
                    </p>
                  </button>
                </div>

                {startMode === 'scratch' && (
                  <div className="pt-3 border-t border-[#EFECE6] space-y-2.5">
                    <p className="text-[11px] font-medium text-[#7A776E]">
                      Ponto de partida para{' '}
                      <strong className="text-[#2C2A25]">
                        {resolvedSegment || 'seu segmento'}
                      </strong>
                      :
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {segmentHasDedicatedPreset ? (
                        <>
                          <button
                            type="button"
                            aria-pressed={scratchVariant === 'preset'}
                            onClick={() => handleSelectScratchVariant('preset')}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                              scratchVariant === 'preset'
                                ? 'bg-[#F4F6F1] border-[#4F5A47] ring-1 ring-[#4F5A47]/30'
                                : 'bg-white border-[#E5E2D9] hover:border-[#BDB8AA]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-[#1F1E1B] leading-snug">
                                Preset {resolvedSegment}
                              </p>
                              {scratchVariant === 'preset' && (
                                <Check className="h-3.5 w-3.5 text-[#4F5A47] shrink-0 mt-0.5" />
                              )}
                            </div>
                            <p className="text-[11px] text-[#6E6B63] leading-relaxed">
                              {segmentPreviewPreset.labels.primaryTabName} ·{' '}
                              {segmentPreviewPreset.labels.secondaryTabName} ·{' '}
                              {segmentPreviewPreset.primaryFields.length} campos sugeridos
                            </p>
                          </button>

                          <button
                            type="button"
                            aria-pressed={scratchVariant === 'blank'}
                            onClick={() => handleSelectScratchVariant('blank')}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                              scratchVariant === 'blank'
                                ? 'bg-[#F4F6F1] border-[#4F5A47] ring-1 ring-[#4F5A47]/30'
                                : 'bg-white border-[#E5E2D9] hover:border-[#BDB8AA]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-[#1F1E1B] leading-snug">
                                Em branco do zero
                              </p>
                              {scratchVariant === 'blank' && (
                                <Check className="h-3.5 w-3.5 text-[#4F5A47] shrink-0 mt-0.5" />
                              )}
                            </div>
                            <p className="text-[11px] text-[#6E6B63] leading-relaxed">
                              Comece sem campos extras e monte 100% manualmente nas próximas etapas.
                            </p>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-pressed={scratchVariant === 'blank'}
                            onClick={() => handleSelectScratchVariant('blank')}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                              scratchVariant === 'blank'
                                ? 'bg-[#F4F6F1] border-[#4F5A47] ring-1 ring-[#4F5A47]/30'
                                : 'bg-white border-[#E5E2D9] hover:border-[#BDB8AA]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-[#1F1E1B] leading-snug">
                                Em branco do zero
                              </p>
                              {scratchVariant === 'blank' && (
                                <Check className="h-3.5 w-3.5 text-[#4F5A47] shrink-0 mt-0.5" />
                              )}
                            </div>
                            <p className="text-[11px] text-[#6E6B63] leading-relaxed">
                              Comece sem campos extras e monte 100% manualmente nas próximas etapas.
                            </p>
                          </button>

                          <button
                            type="button"
                            aria-pressed={scratchVariant === 'preset'}
                            onClick={() => handleSelectScratchVariant('preset')}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                              scratchVariant === 'preset'
                                ? 'bg-[#F4F6F1] border-[#4F5A47] ring-1 ring-[#4F5A47]/30'
                                : 'bg-white border-[#E5E2D9] hover:border-[#BDB8AA]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-[#1F1E1B] leading-snug">
                                Catálogo + Estoque Simples
                              </p>
                              {scratchVariant === 'preset' && (
                                <Check className="h-3.5 w-3.5 text-[#4F5A47] shrink-0 mt-0.5" />
                              )}
                            </div>
                            <p className="text-[11px] text-[#6E6B63] leading-relaxed">
                              Produtos Principais · Complementos &amp; Insumos · 2 campos essenciais prontos.
                            </p>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {startMode === 'preset' && (
                  <div className="pt-3 border-t border-[#EFECE6] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {BUILTIN_TEMPLATE_PRESET_CARDS.map((card) => {
                      const active = selectedPresetId === card.templateId;
                      return (
                        <button
                          key={card.templateId}
                          type="button"
                          aria-pressed={active}
                          onClick={() => applyPresetTemplate(card.templateId)}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                            active
                              ? 'bg-[#F4F6F1] border-[#4F5A47] ring-1 ring-[#4F5A47]/30'
                              : 'bg-white border-[#E5E2D9] hover:border-[#BDB8AA]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-[#1F1E1B] leading-snug">
                              {card.title}
                            </p>
                            {active && (
                              <Check className="h-3.5 w-3.5 text-[#4F5A47] shrink-0 mt-0.5" />
                            )}
                          </div>
                          <p className="text-[11px] text-[#6E6B63] leading-relaxed">
                            {card.subtitle}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: MÓDULOS & RÓTULOS */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#1F1E1B]">
                    Módulos Ativos da Loja
                  </h3>
                  <p className="text-xs text-[#6E6B63] mt-0.5">
                    Ative apenas o que faz sentido para a operação de{' '}
                    <strong className="text-[#1F1E1B]">{storeName || 'sua loja'}</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {contextualFeatures.map((item) => (
                    <div
                      key={item.key}
                      className={`p-3.5 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                        features[item.key]
                          ? 'bg-[#F4F6F1] border-[#C9D3C3]'
                          : 'bg-[#FAF9F6] border-[#ECE9E1]'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-[#1F1E1B]">
                          {item.label}
                        </p>
                        <p className="text-[11px] text-[#6E6B63] leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <AuraToggle
                          id={`wizard-flag-${item.key}`}
                          label=""
                          checked={features[item.key]}
                          onChange={(checked) =>
                            setFeatures((prev) => ({ ...prev, [item.key]: checked }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#1F1E1B]">
                    Nomenclatura Dinâmica do Menu & Balcão
                  </h3>
                  <p className="text-xs text-[#6E6B63] mt-0.5">
                    Personalize como as abas do Estoque, Checkout e Cross-sell aparecem para sua equipe.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="lbl-primary-tab"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Aba Principal do Estoque *
                    </label>
                    <input
                      id="lbl-primary-tab"
                      type="text"
                      value={labels.primaryTabName}
                      onChange={(e) =>
                        setLabels((p) => ({ ...p, primaryTabName: e.target.value }))
                      }
                      placeholder="Ex: Rações & Produtos, Cardápio, Peças"
                      className="w-full h-9 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lbl-secondary-tab"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Aba Secundária (Lotes / SKU) *
                    </label>
                    <input
                      id="lbl-secondary-tab"
                      type="text"
                      value={labels.secondaryTabName}
                      onChange={(e) =>
                        setLabels((p) => ({ ...p, secondaryTabName: e.target.value }))
                      }
                      placeholder="Ex: Petiscos & Acessórios, Bebidas & Insumos"
                      className="w-full h-9 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lbl-primary-singular"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Item Principal (Singular)
                    </label>
                    <input
                      id="lbl-primary-singular"
                      type="text"
                      value={labels.primaryItemSingular}
                      onChange={(e) =>
                        setLabels((p) => ({ ...p, primaryItemSingular: e.target.value }))
                      }
                      placeholder="Ex: Produto, Lanche, Peça"
                      className="w-full h-9 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lbl-secondary-singular"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Item Secundário (Singular)
                    </label>
                    <input
                      id="lbl-secondary-singular"
                      type="text"
                      value={labels.secondaryItemSingular}
                      onChange={(e) =>
                        setLabels((p) => ({ ...p, secondaryItemSingular: e.target.value }))
                      }
                      placeholder="Ex: Petisco, Bebida, Acessório"
                      className="w-full h-9 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lbl-order-action"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Rótulo da Tela de Saída / Venda
                    </label>
                    <input
                      id="lbl-order-action"
                      type="text"
                      value={labels.orderActionLabel}
                      onChange={(e) =>
                        setLabels((p) => ({ ...p, orderActionLabel: e.target.value }))
                      }
                      placeholder="Ex: Novo Pedido, Balcão & Venda"
                      className="w-full h-9 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lbl-cross-sell"
                      className="block text-xs font-medium text-[#4A4842] mb-1.5"
                    >
                      Título do Cross-sell
                    </label>
                    <input
                      id="lbl-cross-sell"
                      type="text"
                      value={labels.crossSellTitle}
                      onChange={(e) =>
                        setLabels((p) => ({ ...p, crossSellTitle: e.target.value }))
                      }
                      placeholder="Ex: Sugestões Complementares"
                      className="w-full h-9 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CONSTRUTOR DE CAMPOS + PREVIEW AO VIVO */}
          {step === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left 7 cols: Interactive Field Builder */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1F1E1B]">
                      Campos Customizados de &ldquo;{labels.primaryItemSingular}&rdquo;
                    </h3>
                    <p className="text-xs text-[#6E6B63] mt-0.5">
                      Salvos em metadados JSONB e renderizados automaticamente no cadastro de estoque.
                    </p>
                  </div>

                  {/* Existing Fields List */}
                  <div className="space-y-2">
                    {primaryFields.map((field) => {
                      const typeLabel =
                        FIELD_TYPE_OPTIONS.find((t) => t.value === field.type)?.label ??
                        field.type;
                      return (
                        <div
                          key={field.id}
                          className="px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#EAE7DF] flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-[#1F1E1B]">
                                {field.label}
                              </span>
                              <StatusBadge label={typeLabel} tone="stone" />
                              {field.required && (
                                <StatusBadge label="Obrigatório" tone="olive" />
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-[#7A776E] mt-0.5 truncate">
                              key: {field.key}
                              {field.options && field.options.length > 0
                                ? ` · [${field.options.join(', ')}]`
                                : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleFieldRequired(field.id)}
                              className="px-2.5 py-1 rounded-lg border border-[#DDDAD0] bg-white text-[11px] font-medium text-[#4A4842] hover:bg-[#ECEAE2] hover:border-[#C5C0B3] transition-colors cursor-pointer"
                              title="Alternar obrigatoriedade"
                            >
                              {field.required ? 'Tornar opcional' : 'Tornar obrigatório'}
                            </button>
                            <button
                              type="button"
                              aria-label={`Remover campo ${field.label}`}
                              onClick={() => handleRemoveField(field.id)}
                              className="p-1.5 rounded-lg text-[#8C887E] hover:text-[#9B3B2B] hover:bg-[#F8E5E2] cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {primaryFields.length === 0 && (
                      <p className="text-xs text-[#7A776E] py-4 text-center border border-dashed border-[#DDDAD0] rounded-xl">
                        Nenhum campo extra configurado. Adicione campos abaixo conforme seu segmento.
                      </p>
                    )}
                  </div>

                  {/* Inline New Field Form */}
                  <div className="pt-4 border-t border-[#EFECE6] space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#7A776E]">
                      Adicionar Novo Campo
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="new-field-label"
                          className="block text-xs font-medium text-[#4A4842] mb-1"
                        >
                          Nome do Campo
                        </label>
                        <input
                          id="new-field-label"
                          type="text"
                          value={newFieldLabel}
                          onChange={(e) => setNewFieldLabel(e.target.value)}
                          placeholder="Ex: Raça / Espécie, Sabor, Voltagem..."
                          className="w-full h-9 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                        />
                      </div>

                      <CreatableSelect
                        id="new-field-type"
                        label="Tipo do Campo"
                        size="sm"
                        creatable={false}
                        value={newFieldType}
                        searchPlaceholder="Selecionar tipo..."
                        options={FIELD_TYPE_OPTIONS}
                        onChange={(val) => setNewFieldType(val as CustomFieldType)}
                      />
                    </div>

                    {(newFieldType === 'select' || newFieldType === 'multiselect') && (
                      <div>
                        <label
                          htmlFor="new-field-options"
                          className="block text-xs font-medium text-[#4A4842] mb-1"
                        >
                          Opções (separadas por vírgula)
                        </label>
                        <input
                          id="new-field-options"
                          type="text"
                          value={newFieldOptionsRaw}
                          onChange={(e) => setNewFieldOptionsRaw(e.target.value)}
                          placeholder="Ex: Filhote, Adulto, Sênior"
                          className="w-full h-9 px-3 rounded-xl bg-[#FAF9F6] border border-[#DDDAD0] text-xs text-[#1F1E1B] focus:outline-none focus:border-[#4F5A47]"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <AuraToggle
                        id="new-field-required"
                        label="Campo obrigatório"
                        checked={newFieldRequired}
                        onChange={setNewFieldRequired}
                      />
                      <AuraButton
                        variant="secondary"
                        size="sm"
                        onClick={handleAddCustomField}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar Campo
                      </AuraButton>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 5 cols: Live Preview of the Store's Counter Form */}
              <div className="lg:col-span-5 bg-white border border-[#E5E2D9] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EFECE6]">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4F5A47] flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      Preview ao Vivo
                    </p>
                    <h4 className="font-serif text-xl text-[#1F1E1B] leading-tight mt-0.5">
                      {storeName || 'Nova Loja'}
                    </h4>
                    <p className="text-[11px] text-[#6E6B63]">
                      {resolvedSegment || 'Segmento personalizado'}
                    </p>
                  </div>
                  <StatusBadge label={labels.primaryItemSingular} tone="olive" />
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#ECE9E1]">
                    <p className="text-[10px] text-[#7A776E]">
                      Nome do {labels.primaryItemSingular} *
                    </p>
                    <p className="text-[#9A968D] mt-0.5">
                      Ex: {labels.primaryItemSingular} destaque da loja
                    </p>
                  </div>

                  {primaryFields.map((field) => (
                    <div
                      key={field.id}
                      className="p-2.5 rounded-xl bg-[#FAF9F6] border border-[#ECE9E1]"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium text-[#4A4842]">
                          {field.label} {field.required ? '*' : ''}
                        </p>
                        <span className="text-[10px] font-mono text-[#8C887E]">
                          {field.type}
                        </span>
                      </div>

                      {field.type === 'multiselect' && field.options ? (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {field.options.slice(0, 4).map((opt) => (
                            <span
                              key={opt}
                              className="px-2 py-0.5 rounded-full bg-[#EFECE6] text-[10px] text-[#4A4842]"
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      ) : field.type === 'select' && field.options ? (
                        <p className="text-[11px] text-[#6E6B63] mt-1">
                          {field.options[0]} ▾
                        </p>
                      ) : field.type === 'boolean' ? (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-[#4F5A47]">
                          <span className="h-3.5 w-7 rounded-full bg-[#4F5A47] inline-block" />
                          Sim / Não
                        </div>
                      ) : field.type === 'date' ? (
                        <p className="text-[11px] font-mono text-[#8C887E] mt-1">
                          dd / mm / aaaa
                        </p>
                      ) : (
                        <p className="text-[11px] text-[#9A968D] mt-1">
                          {field.placeholder || 'Valor no balcão...'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-[#EFECE6] space-y-1.5 text-[11px] text-[#6E6B63]">
                  <p className="font-medium text-[#2C2A25]">Módulos habilitados:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {contextualFeatures
                      .filter((item) => features[item.key])
                      .map((item) => (
                        <StatusBadge
                          key={item.key}
                          label={item.previewBadge}
                          tone={
                            item.key === 'hasExpirationDate'
                              ? 'amber'
                              : item.key === 'hasWarrantyQr' ||
                                  item.key === 'hasCompatibilityCrossSell'
                                ? 'olive'
                                : 'stone'
                          }
                        />
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-6 py-4 bg-white border-t border-[#E5E2D9] flex items-center justify-between gap-3 shrink-0">
          <div>
            {step > 1 ? (
              <AuraButton
                variant="outline"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </AuraButton>
            ) : (
              <AuraButton variant="ghost" onClick={onClose}>
                Cancelar
              </AuraButton>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {step < 3 ? (
              <AuraButton variant="primary" onClick={handleNextStep}>
                Continuar
                <ArrowRight className="h-4 w-4" />
              </AuraButton>
            ) : (
              <AuraButton variant="primary" onClick={handleFinish}>
                <Check className="h-4 w-4" />
                Criar Loja e Entrar no Workspace
              </AuraButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
