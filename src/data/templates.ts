import {
  CustomFieldDefinition,
  StoreFeatureFlags,
  StoreLabels,
  StoreTemplate,
} from '../types/template';
import {
  Accessory,
  AuditLogEntry,
  Customer,
  DeviceModel,
  DynamicCatalog,
  Order,
  Smartphone,
  StockLedgerEntry,
  WeeklyMovementPoint,
} from '../types/crm';
import {
  DEFAULT_CHECKLIST_TEMPLATE,
  DEVICE_MODELS,
  INITIAL_ACCESSORIES,
  INITIAL_AUDIT_LOGS,
  INITIAL_CUSTOMERS,
  INITIAL_DYNAMIC_CATALOG,
  INITIAL_ORDERS,
  INITIAL_SMARTPHONES,
  INITIAL_STOCK_LEDGER,
  REFERENCE_TODAY,
  WEEKLY_MOVEMENT,
} from './mockData';

export interface StoreSeedDataset {
  smartphones: Smartphone[];
  accessories: Accessory[];
  customers: Customer[];
  orders: Order[];
  deviceModels: DeviceModel[];
  catalog: DynamicCatalog;
  auditLogs: AuditLogEntry[];
  stockLedger: StockLedgerEntry[];
  weeklyMovement: WeeklyMovementPoint[];
}

export const OTHER_SEGMENT_OPTION = 'Outro (especificar)';

export const STORE_SEGMENT_SUGGESTIONS: string[] = [
  'Celulares & Assistência',
  'Lanchonete & Hamburgueria',
  'Loja de Roupas & Moda',
  'Informática & Eletrônicos',
  'Pet Shop & Clínica',
  'Papelaria & Presentes',
  'Oficina Mecânica',
  'Cafeteria & Padaria',
  'Ótica & Joalheria',
];

/**
 * 1. AuraCell (Default Active Store — Smartphones & Accessories)
 * Preserves 100% of existing IMEI (Luhn), Trade-in, Checklist, and QR Warranty workflows.
 */
export const AURACELL_TEMPLATE: StoreTemplate = {
  id: 'store-auracell',
  storeName: 'AuraCell',
  segment: 'Celulares & Assistência',
  description:
    'Loja física de smartphones seminovos e lacrados com controle serializado por IMEI (Luhn), trade-in, checklist físico e termo de garantia com QR Code.',
  labels: {
    primaryTabName: 'Aparelhos',
    secondaryTabName: 'Acessórios',
    primaryItemSingular: 'Aparelho',
    secondaryItemSingular: 'Acessório',
    orderActionLabel: 'Saída & Garantia',
    crossSellTitle: 'Acessórios Compatíveis',
  },
  features: {
    hasSerializedItems: true,
    hasWarrantyQr: true,
    hasExpirationDate: false,
    hasEntryChecklist: true,
    hasCompatibilityCrossSell: true,
    hasTradeIn: true,
  },
  primaryFields: [
    {
      id: 'ac-f-brand',
      key: 'brand',
      label: 'Marca',
      type: 'select',
      required: true,
      options: ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Google'],
    },
    {
      id: 'ac-f-storage',
      key: 'storage',
      label: 'Armazenamento',
      type: 'select',
      required: true,
      options: ['64GB', '128GB', '256GB', '512GB', '1TB'],
    },
    {
      id: 'ac-f-imei',
      key: 'imei1',
      label: 'IMEI 1 (Luhn)',
      type: 'text',
      required: true,
      placeholder: '15 dígitos numéricos',
      validator: 'imei_luhn',
    },
  ],
  secondaryFields: [
    {
      id: 'ac-s-cat',
      key: 'category',
      label: 'Categoria',
      type: 'select',
      required: true,
      options: ['Capinha', 'Película de Tela', 'Carregador', 'Cabo', 'Fone de Ouvido'],
    },
  ],
  defaultChecklist: DEFAULT_CHECKLIST_TEMPLATE.map((c) => c.label),
};

/**
 * 2. Sabor & Brasa (Lanchonete & Hamburgueria — Demo Pré-populada)
 */
export const SABOR_BRASA_TEMPLATE: StoreTemplate = {
  id: 'store-sabor-brasa',
  storeName: 'Sabor & Brasa',
  segment: 'Lanchonete & Hamburgueria',
  description:
    'Hamburgueria artesanal com controle de tempo de preparo, alergênicos, validade de lote de insumos e sugestão inteligente de combos e bebidas.',
  labels: {
    primaryTabName: 'Cardápio / Lanches',
    secondaryTabName: 'Bebidas & Insumos',
    primaryItemSingular: 'Lanche',
    secondaryItemSingular: 'Bebida / Insumo',
    orderActionLabel: 'Novo Pedido',
    crossSellTitle: 'Combos & Adicionais Sugeridos',
  },
  features: {
    hasSerializedItems: false,
    hasWarrantyQr: false,
    hasExpirationDate: true,
    hasEntryChecklist: false,
    hasCompatibilityCrossSell: true,
    hasTradeIn: false,
  },
  primaryFields: [
    {
      id: 'sb-f-prep',
      key: 'tempo_preparo_min',
      label: 'Tempo de Preparo (min)',
      type: 'number',
      required: true,
      placeholder: 'Ex: 14',
      validator: 'none',
    },
    {
      id: 'sb-f-portion',
      key: 'porcao_peso',
      label: 'Porção / Peso',
      type: 'text',
      required: true,
      placeholder: 'Ex: 220g · Pão brioche',
      validator: 'none',
    },
    {
      id: 'sb-f-allergens',
      key: 'alergenicos',
      label: 'Alergênicos',
      type: 'multiselect',
      required: false,
      options: ['Glúten', 'Lactose', 'Amendoim', 'Ovo', 'Soja', 'Mostarda'],
      validator: 'none',
    },
    {
      id: 'sb-f-exp',
      key: 'validade_lote',
      label: 'Validade do Lote',
      type: 'date',
      required: true,
      validator: 'none',
    },
  ],
  secondaryFields: [
    {
      id: 'sb-s-volume',
      key: 'volume_medida',
      label: 'Volume / Medida',
      type: 'text',
      required: false,
      placeholder: 'Ex: 350ml, Porção 180g',
      validator: 'none',
    },
    {
      id: 'sb-s-temp',
      key: 'temperatura',
      label: 'Temperatura de Serviço',
      type: 'select',
      required: false,
      options: ['Gelado', 'Quente', 'Ambiente'],
      validator: 'none',
    },
    {
      id: 'sb-s-exp',
      key: 'validade_lote',
      label: 'Validade do Lote',
      type: 'date',
      required: false,
      validator: 'none',
    },
  ],
  defaultChecklist: [],
};

/**
 * 3. Atelier Linho (Loja de Roupas — Demo Pré-populada)
 */
export const ATELIER_LINHO_TEMPLATE: StoreTemplate = {
  id: 'store-atelier-linho',
  storeName: 'Atelier Linho',
  segment: 'Loja de Roupas & Moda',
  description:
    'Boutique de vestuário autoral com grade de tamanhos, tecidos, coleções, recomendações de look e garantia de troca em 30 dias via QR Code.',
  labels: {
    primaryTabName: 'Peças Principais',
    secondaryTabName: 'Acessórios & Calçados',
    primaryItemSingular: 'Peça',
    secondaryItemSingular: 'Acessório',
    orderActionLabel: 'Venda & Troca 30d',
    crossSellTitle: 'Recomendações de Look',
  },
  features: {
    hasSerializedItems: false,
    hasWarrantyQr: true,
    hasExpirationDate: false,
    hasEntryChecklist: false,
    hasCompatibilityCrossSell: true,
    hasTradeIn: false,
  },
  primaryFields: [
    {
      id: 'al-f-size',
      key: 'tamanho',
      label: 'Tamanho',
      type: 'select',
      required: true,
      options: ['PP', 'P', 'M', 'G', 'GG'],
      validator: 'none',
    },
    {
      id: 'al-f-fabric',
      key: 'tecido_material',
      label: 'Tecido / Material',
      type: 'select',
      required: true,
      options: ['Linho Puro', 'Algodão Egípcio', 'Seda Natural', 'Lã Fria', 'Sarja Orgânica'],
      validator: 'none',
    },
    {
      id: 'al-f-collection',
      key: 'colecao',
      label: 'Coleção',
      type: 'text',
      required: true,
      placeholder: 'Ex: Primavera / Verão 26',
      validator: 'none',
    },
    {
      id: 'al-f-color',
      key: 'cor',
      label: 'Cor',
      type: 'text',
      required: true,
      placeholder: 'Ex: Off-White, Areia, Oliva',
      validator: 'none',
    },
  ],
  secondaryFields: [
    {
      id: 'al-s-size',
      key: 'numeracao_medida',
      label: 'Numeração / Medida',
      type: 'text',
      required: false,
      placeholder: 'Ex: 37, Único, 90cm',
      validator: 'none',
    },
    {
      id: 'al-s-material',
      key: 'material',
      label: 'Material',
      type: 'text',
      required: false,
      placeholder: 'Ex: Couro legítimo, Palha natural',
      validator: 'none',
    },
  ],
  defaultChecklist: [],
};

export const BUILTIN_TEMPLATES: StoreTemplate[] = [
  AURACELL_TEMPLATE,
  SABOR_BRASA_TEMPLATE,
  ATELIER_LINHO_TEMPLATE,
];

export interface BuiltinPresetCardMeta {
  templateId: string;
  title: string;
  subtitle: string;
}

export const GENERIC_RETAIL_PRESET_ID = 'preset-generic-retail';

export const BUILTIN_TEMPLATE_PRESET_CARDS: BuiltinPresetCardMeta[] = [
  {
    templateId: AURACELL_TEMPLATE.id,
    title: 'Loja de Celulares & Assistência',
    subtitle: 'Aparelhos · Acessórios · IMEI & Garantia',
  },
  {
    templateId: SABOR_BRASA_TEMPLATE.id,
    title: 'Lanchonete & Hamburgueria',
    subtitle: 'Cardápio / Lanches · Bebidas & Insumos · Validade',
  },
  {
    templateId: ATELIER_LINHO_TEMPLATE.id,
    title: 'Loja de Roupas & Moda',
    subtitle: 'Peças Principais · Acessórios & Calçados · Grade',
  },
  {
    templateId: GENERIC_RETAIL_PRESET_ID,
    title: 'Varejo Genérico (Base Limpa)',
    subtitle: 'Produtos Principais · Complementos & Insumos · Base neutra',
  },
];

function normalizeSegmentText(segment: string): string {
  return segment
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Returns true only for mobile/smartphone/electronics segments where
 * IMEI (Luhn) and device Trade-in terminology apply.
 */
export function isPhoneOrElectronicsSegment(segment: string): boolean {
  const norm = normalizeSegmentText(segment);
  return /(celular|smartphone|telefonia|eletronic|informatica|assistencia)/.test(norm);
}

/**
 * Returns true only when a template genuinely enforces mathematical IMEI Luhn validation.
 * Non-phone segments (e.g., Joalheria, Roupas, Pet Shop) never require Luhn IMEI checks.
 */
export function templateRequiresImeiLuhn(template: StoreTemplate): boolean {
  if (!template.features.hasSerializedItems) return false;
  if (!isPhoneOrElectronicsSegment(template.segment)) return false;
  if (template.primaryFields.some((f) => f.validator === 'imei_luhn')) {
    return true;
  }
  const norm = normalizeSegmentText(template.segment);
  return /(celular|smartphone|telefonia)/.test(norm);
}

export interface ContextualFeatureMeta {
  key: keyof StoreFeatureFlags;
  label: string;
  desc: string;
  previewBadge: string;
}

export function getContextualFeatureMeta(segment: string): ContextualFeatureMeta[] {
  const isPhoneOrElec = isPhoneOrElectronicsSegment(segment);

  return [
    {
      key: 'hasSerializedItems',
      label: isPhoneOrElec
        ? 'Controle por Número de Série / IMEI'
        : 'Controle por Código Único / Peça Exclusiva',
      desc: isPhoneOrElec
        ? 'Cada unidade do estoque principal possui identificador único (Luhn / Série).'
        : 'Cada item do estoque principal possui identificação individual (ex: código de série, lote único ou certificado).',
      previewBadge: isPhoneOrElec ? 'IMEI / Série' : 'Código Único',
    },
    {
      key: 'hasWarrantyQr',
      label: 'Emissão de Garantia / Certificado com QR Code',
      desc: 'Gera termo imprimível, prazo de cobertura e página pública de consulta.',
      previewBadge: 'Garantia / Cert. QR',
    },
    {
      key: 'hasExpirationDate',
      label: 'Controle de Validade / Lote',
      desc: 'Destaca itens e insumos com validade próxima no balcão e estoque.',
      previewBadge: 'Validade Lote',
    },
    {
      key: 'hasEntryChecklist',
      label: 'Checklist de Inspeção na Entrada',
      desc: 'Lista tátil de conferência ao cadastrar cada item principal.',
      previewBadge: 'Checklist',
    },
    {
      key: 'hasCompatibilityCrossSell',
      label: 'Cross-sell Inteligente (Combos / Compatíveis)',
      desc: 'Sugere complementos compatíveis no Checkout e no perfil do cliente.',
      previewBadge: 'Cross-sell',
    },
    {
      key: 'hasTradeIn',
      label: isPhoneOrElec
        ? 'Troca de Cliente (Trade-in)'
        : 'Recebimento de Usados / Troca na Compra',
      desc: isPhoneOrElec
        ? 'Permite vincular aparelhos usados recebidos na troca ao cadastro do cliente.'
        : 'Permite registrar e avaliar itens entregues pelo cliente como parte de uma troca.',
      previewBadge: isPhoneOrElec ? 'Trade-in' : 'Troca na Compra',
    },
  ];
}

export interface SegmentScratchPreset {
  labels: StoreLabels;
  features: StoreFeatureFlags;
  primaryFields: CustomFieldDefinition[];
}

export function getSegmentScratchPreset(segment: string): SegmentScratchPreset {
  const norm = normalizeSegmentText(segment);

  if (/(joalher|otica|relogio|bijuteria|semijoia)/.test(norm)) {
    return {
      labels: {
        primaryTabName: 'Joias & Peças',
        secondaryTabName: 'Acessórios & Embalagens',
        primaryItemSingular: 'Joia / Peça',
        secondaryItemSingular: 'Acessório',
        orderActionLabel: 'Venda & Certificado',
        crossSellTitle: 'Complementos & Embalagens',
      },
      features: {
        hasSerializedItems: true,
        hasWarrantyQr: true,
        hasExpirationDate: false,
        hasEntryChecklist: true,
        hasCompatibilityCrossSell: true,
        hasTradeIn: false,
      },
      primaryFields: [
        {
          id: 'cf-joia-1',
          key: 'material_metal',
          label: 'Material / Metal',
          type: 'select',
          required: true,
          options: ['Ouro 18k', 'Prata 925', 'Ouro Branco', 'Aço Cirúrgico', 'Titânio'],
          validator: 'none',
        },
        {
          id: 'cf-joia-2',
          key: 'quilate_pedra',
          label: 'Quilate / Pedra',
          type: 'text',
          required: false,
          placeholder: 'Ex: Diamante 0.5ct, Esmeralda, Zircônia',
          validator: 'none',
        },
        {
          id: 'cf-joia-3',
          key: 'tamanho_aro',
          label: 'Tamanho / Aro',
          type: 'text',
          required: false,
          placeholder: 'Ex: Aro 16, Corrente 45cm, Haste 140mm',
          validator: 'none',
        },
        {
          id: 'cf-joia-4',
          key: 'certificado',
          label: 'Certificado',
          type: 'text',
          required: false,
          placeholder: 'Ex: GIA-2026-0841',
          validator: 'none',
        },
      ],
    };
  }

  if (/(cafeter|padaria|confeit|doceria|bistro|sorveter)/.test(norm)) {
    return {
      labels: {
        primaryTabName: 'Cardápio & Fornada',
        secondaryTabName: 'Bebidas & Insumos',
        primaryItemSingular: 'Item',
        secondaryItemSingular: 'Bebida / Insumo',
        orderActionLabel: 'Novo Pedido',
        crossSellTitle: 'Acompanhamentos Sugeridos',
      },
      features: {
        hasSerializedItems: false,
        hasWarrantyQr: false,
        hasExpirationDate: true,
        hasEntryChecklist: false,
        hasCompatibilityCrossSell: true,
        hasTradeIn: false,
      },
      primaryFields: [
        {
          id: 'cf-cafe-1',
          key: 'categoria_item',
          label: 'Categoria',
          type: 'select',
          required: true,
          options: ['Café Especial', 'Pães Artesanais', 'Confeitaria', 'Salgados'],
          validator: 'none',
        },
        {
          id: 'cf-cafe-2',
          key: 'porcao_peso',
          label: 'Porção / Peso',
          type: 'text',
          required: true,
          placeholder: 'Ex: 240ml, Fatia 150g',
          validator: 'none',
        },
        {
          id: 'cf-cafe-3',
          key: 'alergenicos',
          label: 'Alergênicos',
          type: 'multiselect',
          required: false,
          options: ['Glúten', 'Lactose', 'Amendoim', 'Ovo', 'Castanhas'],
          validator: 'none',
        },
        {
          id: 'cf-cafe-4',
          key: 'validade_lote',
          label: 'Validade do Lote',
          type: 'date',
          required: true,
          validator: 'none',
        },
      ],
    };
  }

  if (/(lanchonete|hamburguer|restaurante|pizzaria|aliment)/.test(norm)) {
    return {
      labels: { ...SABOR_BRASA_TEMPLATE.labels },
      features: { ...SABOR_BRASA_TEMPLATE.features },
      primaryFields: SABOR_BRASA_TEMPLATE.primaryFields.map((f, idx) => ({
        ...f,
        id: `cf-lanch-${idx + 1}`,
        options: f.options ? [...f.options] : undefined,
      })),
    };
  }

  if (/(roupa|moda|vestuario|calcado|boutique)/.test(norm)) {
    return {
      labels: { ...ATELIER_LINHO_TEMPLATE.labels },
      features: { ...ATELIER_LINHO_TEMPLATE.features },
      primaryFields: ATELIER_LINHO_TEMPLATE.primaryFields.map((f, idx) => ({
        ...f,
        id: `cf-moda-${idx + 1}`,
        options: f.options ? [...f.options] : undefined,
      })),
    };
  }

  if (/(informatica|eletronic|computador|gamer)/.test(norm)) {
    return {
      labels: {
        primaryTabName: 'Equipamentos',
        secondaryTabName: 'Periféricos & Cabos',
        primaryItemSingular: 'Equipamento',
        secondaryItemSingular: 'Periférico',
        orderActionLabel: 'Saída & Garantia',
        crossSellTitle: 'Periféricos Compatíveis',
      },
      features: {
        hasSerializedItems: true,
        hasWarrantyQr: true,
        hasExpirationDate: false,
        hasEntryChecklist: true,
        hasCompatibilityCrossSell: true,
        hasTradeIn: true,
      },
      primaryFields: [
        {
          id: 'cf-info-1',
          key: 'categoria_equip',
          label: 'Categoria',
          type: 'select',
          required: true,
          options: ['Notebook', 'Desktop', 'Monitor', 'Tablet', 'Console'],
          validator: 'none',
        },
        {
          id: 'cf-info-2',
          key: 'configuracao_spec',
          label: 'Configuração / Spec',
          type: 'text',
          required: true,
          placeholder: 'Ex: 16GB RAM · 512GB SSD',
          validator: 'none',
        },
        {
          id: 'cf-info-3',
          key: 'voltagem',
          label: 'Voltagem / Padrão',
          type: 'select',
          required: false,
          options: ['Bivolt', '110V', '220V', 'USB-C PD'],
          validator: 'none',
        },
        {
          id: 'cf-info-4',
          key: 'numero_serie',
          label: 'Número de Série',
          type: 'text',
          required: true,
          placeholder: 'Ex: SN-BR-2026-9041',
          validator: 'none',
        },
      ],
    };
  }

  if (/(celular|smartphone|telefonia|assistencia)/.test(norm)) {
    return {
      labels: { ...AURACELL_TEMPLATE.labels },
      features: { ...AURACELL_TEMPLATE.features },
      primaryFields: AURACELL_TEMPLATE.primaryFields.map((f, idx) => ({
        ...f,
        id: `cf-cel-${idx + 1}`,
        options: f.options ? [...f.options] : undefined,
      })),
    };
  }

  if (/(pet|veterin|clinica)/.test(norm)) {
    return {
      labels: {
        primaryTabName: 'Rações & Produtos',
        secondaryTabName: 'Petiscos & Acessórios',
        primaryItemSingular: 'Produto',
        secondaryItemSingular: 'Acessório',
        orderActionLabel: 'Novo Pedido',
        crossSellTitle: 'Complementos para o Pet',
      },
      features: {
        hasSerializedItems: false,
        hasWarrantyQr: false,
        hasExpirationDate: true,
        hasEntryChecklist: false,
        hasCompatibilityCrossSell: true,
        hasTradeIn: false,
      },
      primaryFields: [
        {
          id: 'cf-pet-1',
          key: 'categoria_especie',
          label: 'Categoria / Espécie',
          type: 'select',
          required: true,
          options: ['Cães', 'Gatos', 'Aves', 'Geral'],
          validator: 'none',
        },
        {
          id: 'cf-pet-2',
          key: 'peso_embalagem',
          label: 'Peso / Embalagem',
          type: 'text',
          required: false,
          placeholder: 'Ex: 3kg, 500ml',
          validator: 'none',
        },
        {
          id: 'cf-pet-3',
          key: 'validade_lote',
          label: 'Validade do Lote',
          type: 'date',
          required: false,
          validator: 'none',
        },
      ],
    };
  }

  if (/(papelaria|presente|livraria|escritorio)/.test(norm)) {
    return {
      labels: {
        primaryTabName: 'Papelaria & Cadernos',
        secondaryTabName: 'Canetas & Acessórios',
        primaryItemSingular: 'Item',
        secondaryItemSingular: 'Acessório',
        orderActionLabel: 'Novo Pedido',
        crossSellTitle: 'Combos & Presentes',
      },
      features: {
        hasSerializedItems: false,
        hasWarrantyQr: false,
        hasExpirationDate: false,
        hasEntryChecklist: false,
        hasCompatibilityCrossSell: true,
        hasTradeIn: false,
      },
      primaryFields: [
        {
          id: 'cf-pap-1',
          key: 'colecao_linha',
          label: 'Coleção / Linha',
          type: 'text',
          required: false,
          placeholder: 'Ex: Minimalista Linho 2026',
          validator: 'none',
        },
        {
          id: 'cf-pap-2',
          key: 'formato_gramatura',
          label: 'Formato / Gramatura',
          type: 'select',
          required: false,
          options: ['A4', 'A5', '90g/m²', '120g/m²', 'Especial'],
          validator: 'none',
        },
        {
          id: 'cf-pap-3',
          key: 'cor_acabamento',
          label: 'Cor / Acabamento',
          type: 'text',
          required: false,
          placeholder: 'Ex: Capa dura areia',
          validator: 'none',
        },
      ],
    };
  }

  if (/(oficina|mecanica|auto|veicul|peca)/.test(norm)) {
    return {
      labels: {
        primaryTabName: 'Serviços & Peças',
        secondaryTabName: 'Lubrificantes & Insumos',
        primaryItemSingular: 'Peça / Serviço',
        secondaryItemSingular: 'Insumo',
        orderActionLabel: 'Ordem de Serviço',
        crossSellTitle: 'Itens de Revisão',
      },
      features: {
        hasSerializedItems: false,
        hasWarrantyQr: true,
        hasExpirationDate: false,
        hasEntryChecklist: true,
        hasCompatibilityCrossSell: true,
        hasTradeIn: false,
      },
      primaryFields: [
        {
          id: 'cf-ofi-1',
          key: 'aplicacao_veiculo',
          label: 'Aplicação / Veículo',
          type: 'text',
          required: true,
          placeholder: 'Ex: Sedan, SUV, Moto',
          validator: 'none',
        },
        {
          id: 'cf-ofi-2',
          key: 'codigo_peca',
          label: 'Código da Peça',
          type: 'text',
          required: false,
          placeholder: 'Ex: OEM-4421-BR',
          validator: 'none',
        },
        {
          id: 'cf-ofi-3',
          key: 'garantia_dias',
          label: 'Garantia do Serviço (dias)',
          type: 'number',
          required: false,
          placeholder: 'Ex: 90',
          validator: 'none',
        },
      ],
    };
  }

  // Default neutral retail preset (used for "Outro (especificar)" and any custom segment)
  return getSimpleCatalogScratchPreset();
}

const DEDICATED_SEGMENT_REGEX =
  /(joalher|otica|relogio|bijuteria|semijoia|cafeter|padaria|confeit|doceria|bistro|sorveter|lanchonete|hamburguer|restaurante|pizzaria|aliment|roupa|moda|vestuario|calcado|boutique|informatica|eletronic|computador|gamer|celular|smartphone|telefonia|assistencia|pet|veterin|clinica|papelaria|presente|livraria|escritorio|oficina|mecanica|auto|veicul|peca)/;

/**
 * Returns true if the given segment name maps to a tailored segment preset
 * (e.g. Papelaria & Presentes, Ótica & Joalheria, Cafeteria & Padaria, etc.).
 */
export function hasDedicatedSegmentPreset(segment: string): boolean {
  const norm = normalizeSegmentText(segment);
  if (!norm) return false;
  return DEDICATED_SEGMENT_REGEX.test(norm);
}

/**
 * Clean neutral catalog + simple inventory base (2 essential fields).
 */
export function getSimpleCatalogScratchPreset(): SegmentScratchPreset {
  return {
    labels: {
      primaryTabName: 'Produtos Principais',
      secondaryTabName: 'Complementos & Insumos',
      primaryItemSingular: 'Produto',
      secondaryItemSingular: 'Complemento',
      orderActionLabel: 'Novo Pedido',
      crossSellTitle: 'Itens Sugeridos',
    },
    features: {
      hasSerializedItems: false,
      hasWarrantyQr: false,
      hasExpirationDate: false,
      hasEntryChecklist: false,
      hasCompatibilityCrossSell: true,
      hasTradeIn: false,
    },
    primaryFields: [
      {
        id: 'cf-gen-1',
        key: 'categoria',
        label: 'Categoria',
        type: 'text',
        required: true,
        placeholder: 'Ex: Linha Premium, Essencial',
        validator: 'none',
      },
      {
        id: 'cf-gen-2',
        key: 'especificacao_medida',
        label: 'Especificação / Medida',
        type: 'text',
        required: false,
        placeholder: 'Ex: Tamanho, peso ou volume',
        validator: 'none',
      },
    ],
  };
}

/**
 * Completely blank starting point (zero pre-added custom fields).
 */
export function getBlankScratchPreset(): SegmentScratchPreset {
  return {
    labels: {
      primaryTabName: 'Produtos Principais',
      secondaryTabName: 'Complementos & Insumos',
      primaryItemSingular: 'Produto',
      secondaryItemSingular: 'Complemento',
      orderActionLabel: 'Novo Pedido',
      crossSellTitle: 'Itens Sugeridos',
    },
    features: {
      hasSerializedItems: false,
      hasWarrantyQr: false,
      hasExpirationDate: false,
      hasEntryChecklist: false,
      hasCompatibilityCrossSell: false,
      hasTradeIn: false,
    },
    primaryFields: [],
  };
}

/**
 * Builds a ready-to-use StoreTemplate for self-registration or instant store creation.
 */
export function buildDefaultTemplateForStore(storeName: string, segment: string): StoreTemplate {
  const cleanName = storeName.trim() || 'Minha Loja';
  const cleanSegment = segment.trim() || 'Varejo Geral';
  const preset = getSegmentScratchPreset(cleanSegment);
  const slug = cleanName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'loja';

  return {
    id: `store-${slug}-${Date.now().toString().slice(-4)}`,
    storeName: cleanName,
    segment: cleanSegment,
    description: `Workspace configurado no Open CRM para ${cleanName} (${cleanSegment}).`,
    labels: { ...preset.labels },
    features: { ...preset.features },
    primaryFields: [...preset.primaryFields],
    secondaryFields: preset.features.hasExpirationDate
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
    defaultChecklist: preset.features.hasEntryChecklist
      ? [
          'Embalagem e integridade conferidas',
          'Etiqueta e identificação aplicadas',
          'Qualidade aprovada no recebimento',
        ]
      : [],
  };
}

// --- Isolated Seed Datasets per Store ---

const SABOR_BRASA_MODELS: DeviceModel[] = [
  {
    id: 'sb-smash-duplo',
    brand: 'Artesanal',
    name: 'Smash Duplo Brasa',
    tagLabel: 'Smash Duplo',
    storages: ['220g'],
    colors: ['Pão Brioche'],
  },
  {
    id: 'sb-classic-bacon',
    brand: 'Artesanal',
    name: 'Classic Bacon Defumado',
    tagLabel: 'Classic Bacon',
    storages: ['240g'],
    colors: ['Pão Australiano'],
  },
  {
    id: 'sb-veggie-brie',
    brand: 'Veggie',
    name: 'Veggie Cogumelos & Brie',
    tagLabel: 'Veggie Brie',
    storages: ['200g'],
    colors: ['Pão Brioche'],
  },
  {
    id: 'sb-chicken-crispy',
    brand: 'Frango',
    name: 'Chicken Crispy Mel Picante',
    tagLabel: 'Chicken Crispy',
    storages: ['210g'],
    colors: ['Pão Batata'],
  },
  {
    id: 'sb-costela-12h',
    brand: 'Especial',
    name: 'Costela Defumada 12h',
    tagLabel: 'Costela 12h',
    storages: ['260g'],
    colors: ['Pão Ciabatta'],
  },
  {
    id: 'usb-c-universal',
    brand: 'Universal',
    name: 'Qualquer Lanche (Combo)',
    tagLabel: 'Combo Geral',
    storages: [],
    colors: [],
  },
];

export function buildSaborBrasaSeed(): StoreSeedDataset {
  return {
    deviceModels: SABOR_BRASA_MODELS.map((m) => ({
      ...m,
      storages: [...m.storages],
      colors: [...m.colors],
    })),
    catalog: {
      brands: ['Artesanal', 'Veggie', 'Frango', 'Especial', 'Chef'],
      storages: ['180g', '200g', '220g', '240g', '260g', '300g'],
      ramOptions: ['10 min', '12 min', '15 min', '18 min'],
      colors: ['Pão Brioche', 'Pão Australiano', 'Pão Batata', 'Pão Ciabatta'],
      conditions: ['Pronto para preparo', 'Edição Limitada', 'Mais Pedido'],
      accessoryCategories: ['Bebidas', 'Acompanhamentos', 'Molhos', 'Sobremesas', 'Insumos'],
    },
    smartphones: [
      {
        id: 'sb-item-01',
        sku: 'LAN-SMASH-220',
        modelId: 'sb-smash-duplo',
        brand: 'Artesanal',
        model: 'Smash Duplo Brasa',
        storage: '220g',
        color: 'Pão Brioche',
        condition: 'Mais Pedido',
        batteryHealth: 100,
        origin: 'Fornecedor',
        imei1: '',
        serialNumber: 'LOTE-SB-1101',
        costPrice: 14.5,
        salePrice: 38.9,
        stockQty: 25,
        stockUnit: 'un.',
        status: 'Disponível',
        checklist: [],
        acquiredAt: '2026-11-18',
        expiresAt: '2026-11-22',
        customAttributes: {
          tempo_preparo_min: 12,
          porcao_peso: '220g · 2 blends 90g',
          alergenicos: ['Glúten', 'Lactose'],
          validade_lote: '2026-11-22',
        },
        notes: 'Blend angus fresco moído no dia · lote refrigerado.',
      },
      {
        id: 'sb-item-02',
        sku: 'LAN-BACON-240',
        modelId: 'sb-classic-bacon',
        brand: 'Artesanal',
        model: 'Classic Bacon Defumado',
        storage: '240g',
        color: 'Pão Australiano',
        condition: 'Mais Pedido',
        batteryHealth: 100,
        origin: 'Fornecedor',
        imei1: '',
        serialNumber: 'LOTE-SB-1102',
        costPrice: 16.0,
        salePrice: 42.5,
        stockQty: 20,
        stockUnit: 'un.',
        status: 'Disponível',
        checklist: [],
        acquiredAt: '2026-11-18',
        expiresAt: '2026-11-23',
        customAttributes: {
          tempo_preparo_min: 15,
          porcao_peso: '240g · Bacon artesanal',
          alergenicos: ['Glúten', 'Lactose', 'Ovo'],
          validade_lote: '2026-11-23',
        },
      },
      {
        id: 'sb-item-03',
        sku: 'LAN-VEG-200',
        modelId: 'sb-veggie-brie',
        brand: 'Veggie',
        model: 'Veggie Cogumelos & Brie',
        storage: '200g',
        color: 'Pão Brioche',
        condition: 'Pronto para preparo',
        batteryHealth: 100,
        origin: 'Fornecedor',
        imei1: '',
        serialNumber: 'LOTE-SB-1103',
        costPrice: 15.2,
        salePrice: 39.9,
        stockQty: 14,
        stockUnit: 'un.',
        status: 'Disponível',
        checklist: [],
        acquiredAt: '2026-11-19',
        expiresAt: '2026-11-21',
        customAttributes: {
          tempo_preparo_min: 14,
          porcao_peso: '200g · Portobello na brasa',
          alergenicos: ['Glúten', 'Lactose'],
          validade_lote: '2026-11-21',
        },
      },
      {
        id: 'sb-item-04',
        sku: 'LAN-CHICK-210',
        modelId: 'sb-chicken-crispy',
        brand: 'Frango',
        model: 'Chicken Crispy Mel Picante',
        storage: '210g',
        color: 'Pão Batata',
        condition: 'Pronto para preparo',
        batteryHealth: 100,
        origin: 'Fornecedor',
        imei1: '',
        serialNumber: 'LOTE-SB-1104',
        costPrice: 12.8,
        salePrice: 35.9,
        stockQty: 18,
        stockUnit: 'un.',
        status: 'Disponível',
        checklist: [],
        acquiredAt: '2026-11-19',
        expiresAt: '2026-11-26',
        customAttributes: {
          tempo_preparo_min: 11,
          porcao_peso: '210g · Sobrecoxa crocante',
          alergenicos: ['Glúten', 'Ovo'],
          validade_lote: '2026-11-26',
        },
      },
      {
        id: 'sb-item-05',
        sku: 'LAN-COST-260',
        modelId: 'sb-costela-12h',
        brand: 'Especial',
        model: 'Costela Defumada 12h',
        storage: '260g',
        color: 'Pão Ciabatta',
        condition: 'Edição Limitada',
        batteryHealth: 100,
        origin: 'Fornecedor',
        imei1: '',
        serialNumber: 'LOTE-SB-1105',
        costPrice: 19.5,
        salePrice: 48.0,
        stockQty: 10,
        stockUnit: 'un.',
        status: 'Disponível',
        checklist: [],
        acquiredAt: '2026-11-19',
        expiresAt: '2026-11-24',
        customAttributes: {
          tempo_preparo_min: 16,
          porcao_peso: '260g · Costela desfiada',
          alergenicos: ['Glúten', 'Mostarda'],
          validade_lote: '2026-11-24',
        },
      },
    ],
    accessories: [
      {
        id: 'sb-acc-01',
        sku: 'BEB-LIM-400',
        name: 'Limonada Siciliana da Casa (400ml)',
        brand: 'Sabor & Brasa',
        category: 'Bebidas',
        compatibleModelIds: ['sb-smash-duplo', 'sb-classic-bacon', 'sb-veggie-brie', 'usb-c-universal'],
        stock: 22,
        minStock: 8,
        costPrice: 4.2,
        price: 14.9,
        soldThisMonth: 94,
        expiresAt: '2026-11-22',
        customAttributes: { volume_medida: '400ml', temperatura: 'Gelado', validade_lote: '2026-11-22' },
      },
      {
        id: 'sb-acc-02',
        sku: 'ACO-BAT-RUST',
        name: 'Batata Rústica com Alecrim e Páprica',
        brand: 'Sabor & Brasa',
        category: 'Acompanhamentos',
        compatibleModelIds: ['sb-smash-duplo', 'sb-classic-bacon', 'sb-chicken-crispy', 'sb-costela-12h', 'usb-c-universal'],
        stock: 18,
        minStock: 10,
        costPrice: 5.5,
        price: 18.0,
        soldThisMonth: 118,
        expiresAt: '2026-11-25',
        customAttributes: { volume_medida: 'Porção 200g', temperatura: 'Quente', validade_lote: '2026-11-25' },
      },
      {
        id: 'sb-acc-03',
        sku: 'MOL-MAIO-DEF',
        name: 'Maionese Defumada da Casa (Pote 60g)',
        brand: 'Sabor & Brasa',
        category: 'Molhos',
        compatibleModelIds: ['sb-smash-duplo', 'sb-classic-bacon', 'sb-costela-12h', 'usb-c-universal'],
        stock: 4,
        minStock: 10,
        costPrice: 1.5,
        price: 6.5,
        soldThisMonth: 142,
        expiresAt: '2026-11-21',
        customAttributes: { volume_medida: '60g', temperatura: 'Gelado', validade_lote: '2026-11-21' },
      },
      {
        id: 'sb-acc-04',
        sku: 'SOB-SHAKE-BAU',
        name: 'Milkshake Baunilha Bourbon (350ml)',
        brand: 'Sabor & Brasa',
        category: 'Sobremesas',
        compatibleModelIds: ['sb-smash-duplo', 'sb-classic-bacon', 'sb-chicken-crispy'],
        stock: 12,
        minStock: 6,
        costPrice: 7.0,
        price: 24.0,
        soldThisMonth: 61,
        expiresAt: '2026-11-28',
        customAttributes: { volume_medida: '350ml', temperatura: 'Gelado', validade_lote: '2026-11-28' },
      },
      {
        id: 'sb-acc-05',
        sku: 'BEB-COCA-350',
        name: 'Coca-Cola Zero Lata 350ml',
        brand: 'Coca-Cola',
        category: 'Bebidas',
        compatibleModelIds: ['usb-c-universal'],
        stock: 36,
        minStock: 12,
        costPrice: 3.1,
        price: 9.0,
        soldThisMonth: 130,
        expiresAt: '2027-03-15',
        customAttributes: { volume_medida: '350ml', temperatura: 'Gelado', validade_lote: '2027-03-15' },
      },
    ],
    customers: [
      {
        id: 'sb-cu-01',
        name: 'Rafael Monteiro',
        initials: 'RM',
        email: 'rafael.monteiro@estudiok.com.br',
        phone: '(11) 98210-4411',
        cpf: '214.558.902-11',
        city: 'São Paulo, SP',
        status: 'ATIVO',
        segment: 'VIP',
        tags: ['Sem Cebola', 'Prefere Artesanal', 'Ponto Mal Passado'],
        since: '2025-07-12',
        createdAt: '2025-07-12',
        preferredContact: 'WhatsApp',
        ownedModelIds: ['sb-smash-duplo', 'sb-costela-12h'],
        notes: [
          {
            id: 'sb-nt-01',
            author: 'Thiago V.',
            createdAt: '2026-11-15',
            content: 'Sempre pede Smash Duplo sem cebola roxa + maionese defumada extra.',
          },
        ],
        activities: [
          {
            id: 'sb-act-01',
            type: 'sale',
            title: 'Pedido #SB-2026-0412 concluído',
            detail: 'Smash Duplo Brasa + Batata Rústica + Limonada Siciliana',
            timestamp: '2026-11-18',
            actor: 'Thiago Vasconcelos',
          },
        ],
      },
      {
        id: 'sb-cu-02',
        name: 'Juliana Prado',
        initials: 'JP',
        email: 'juliana.prado@gmail.com',
        phone: '(11) 97431-8890',
        cpf: '389.112.440-77',
        city: 'São Paulo, SP',
        status: 'ATIVO',
        segment: 'Varejo',
        tags: ['Alérgico a Lactose', 'Sem Queijo', 'Delivery'],
        since: '2025-11-02',
        createdAt: '2025-11-02',
        preferredContact: 'WhatsApp',
        ownedModelIds: ['sb-chicken-crispy', 'sb-costela-12h'],
        notes: [
          {
            id: 'sb-nt-02',
            author: 'Camila R.',
            createdAt: '2026-11-12',
            content: 'ATENÇÃO COZINHA: Alérgica a lactose — preparar na chapa limpa sem manteiga.',
          },
        ],
        activities: [
          {
            id: 'sb-act-02',
            type: 'note',
            title: 'Restrição alimentar confirmada',
            detail: 'Tag Alérgico a Lactose destacada no perfil',
            timestamp: '2026-11-12',
            actor: 'Camila Rocha',
          },
        ],
      },
      {
        id: 'sb-cu-03',
        name: 'Bruno Castilho',
        initials: 'BC',
        email: 'bruno@castilhoarq.com.br',
        phone: '(11) 99105-7732',
        cpf: '451.908.331-04',
        city: 'São Paulo, SP',
        status: 'LEAD',
        segment: 'Corporativo',
        tags: ['Prefere Artesanal', 'Eventos Sexta'],
        since: '2026-10-28',
        createdAt: '2026-10-28',
        preferredContact: 'WhatsApp',
        ownedModelIds: ['sb-classic-bacon'],
        notes: [
          {
            id: 'sb-nt-03',
            author: 'Thiago V.',
            createdAt: '2026-11-10',
            content: 'Interessado em combo corporativo para 20 pessoas na sexta-feira.',
          },
        ],
        activities: [
          {
            id: 'sb-act-03',
            type: 'profile',
            title: 'Lead corporativo cadastrado',
            detail: 'Solicitou cardápio de combos para escritório',
            timestamp: '2026-10-28',
            actor: 'Thiago Vasconcelos',
          },
        ],
      },
    ],
    orders: [
      {
        id: 'sb-ord-01',
        code: 'SB-2026-0412',
        publicToken: 'sb-pub-0412',
        customerId: 'sb-cu-01',
        smartphoneId: 'sb-item-01',
        smartphoneSnapshot: {
          brand: 'Artesanal',
          model: 'Smash Duplo Brasa',
          storage: '220g',
          color: 'Pão Brioche',
          condition: 'Mais Pedido',
          batteryHealth: 100,
          imei1: '',
          serialNumber: 'LOTE-SB-1101',
          checklist: [],
          unitPrice: 38.9,
        },
        accessories: [
          {
            accessoryId: 'sb-acc-02',
            sku: 'ACO-BAT-RUST',
            name: 'Batata Rústica com Alecrim e Páprica',
            quantity: 1,
            unitPrice: 18.0,
          },
          {
            accessoryId: 'sb-acc-01',
            sku: 'BEB-LIM-400',
            name: 'Limonada Siciliana da Casa (400ml)',
            quantity: 1,
            unitPrice: 14.9,
          },
        ],
        totalAmount: 71.8,
        paymentMethod: 'PIX',
        warrantyDays: 90,
        issuedAt: '2026-11-18',
        warrantyExpiresAt: '2026-11-18',
        sellerName: 'Thiago Vasconcelos',
      },
    ],
    auditLogs: [
      {
        id: 'sb-aud-01',
        timestamp: '2026-11-20 09:15',
        actor: 'Thiago Vasconcelos',
        actorRole: 'ADMIN',
        actionType: 'CREATE_STORE',
        actionLabel: 'Loja Sabor & Brasa inicializada',
        targetLabel: 'Template Lanchonete & Hamburgueria',
        detail: 'Módulos ativos: Validade de Lote e Combos/Adicionais',
      },
    ],
    stockLedger: [
      {
        id: 'sb-led-01',
        timestamp: '2026-11-19 10:00',
        actor: 'Thiago Vasconcelos',
        itemType: 'Acessório',
        itemId: 'sb-acc-01',
        itemLabel: 'Limonada Siciliana da Casa (400ml)',
        sku: 'BEB-LIM-400',
        delta: 25,
        resultingStock: 22,
        reason: 'Entrada',
        note: 'Produção fresca da manhã · Lote 22/11',
      },
    ],
    weeklyMovement: [
      { day: 'Seg', aparelhos: 24, acessorios: 38, revenue: 1520 },
      { day: 'Ter', aparelhos: 31, acessorios: 49, revenue: 2040 },
      { day: 'Qua', aparelhos: 29, acessorios: 44, revenue: 1890 },
      { day: 'Qui', aparelhos: 42, acessorios: 68, revenue: 2780 },
      { day: 'Sex', aparelhos: 64, acessorios: 102, revenue: 4320 },
      { day: 'Sáb', aparelhos: 78, acessorios: 124, revenue: 5190 },
    ],
  };
}

const ATELIER_LINHO_MODELS: DeviceModel[] = [
  {
    id: 'al-camisa-linho',
    brand: 'Atelier Linho',
    name: 'Camisa Linho Puro Areia',
    tagLabel: 'Camisa Linho',
    storages: ['PP', 'P', 'M', 'G', 'GG'],
    colors: ['Areia', 'Off-White', 'Oliva'],
  },
  {
    id: 'al-calca-alfaiataria',
    brand: 'Atelier Linho',
    name: 'Calça Alfaiataria Pregas',
    tagLabel: 'Calça Alfaiataria',
    storages: ['36', '38', '40', '42'],
    colors: ['Pedra', 'Preto'],
  },
  {
    id: 'al-vestido-midi',
    brand: 'Atelier Linho',
    name: 'Vestido Midi Linho Oliva',
    tagLabel: 'Vestido Midi',
    storages: ['P', 'M', 'G'],
    colors: ['Verde Oliva', 'Cru'],
  },
  {
    id: 'al-blazer-estruturado',
    brand: 'Atelier Linho',
    name: 'Blazer Estruturado Lã Fria',
    tagLabel: 'Blazer Lã Fria',
    storages: ['P', 'M', 'G'],
    colors: ['Taupe', 'Chumbo'],
  },
  {
    id: 'usb-c-universal',
    brand: 'Universal',
    name: 'Combina com todos os looks',
    tagLabel: 'Look Versátil',
    storages: [],
    colors: [],
  },
];

export function buildAtelierLinhoSeed(): StoreSeedDataset {
  return {
    deviceModels: ATELIER_LINHO_MODELS.map((m) => ({
      ...m,
      storages: [...m.storages],
      colors: [...m.colors],
    })),
    catalog: {
      brands: ['Atelier Linho', 'Essencial', 'Resort 26'],
      storages: ['PP', 'P', 'M', 'G', 'GG'],
      ramOptions: ['Linho Puro', 'Algodão Egípcio', 'Seda Natural', 'Lã Fria'],
      colors: ['Areia', 'Off-White', 'Verde Oliva', 'Taupe', 'Pedra', 'Preto'],
      conditions: ['Coleção Atual', 'Edição Cápsula', 'Últimas Peças'],
      accessoryCategories: ['Cintos', 'Calçados', 'Bolsas', 'Lenços', 'Joias'],
    },
    smartphones: [
      {
        id: 'al-item-01',
        sku: 'PEC-CAM-LIN-M',
        modelId: 'al-camisa-linho',
        brand: 'Atelier Linho',
        model: 'Camisa Linho Puro Areia',
        storage: 'M',
        color: 'Areia',
        condition: 'Coleção Atual',
        batteryHealth: 100,
        origin: 'Fornecedor',
        imei1: '',
        serialNumber: 'AL-26-001',
        costPrice: 185,
        salePrice: 490,
        stockQty: 8,
        stockUnit: 'un.',
        status: 'Disponível',
        checklist: [],
        acquiredAt: '2026-11-12',
        customAttributes: {
          tamanho: 'M',
          tecido_material: 'Linho Puro',
          colecao: 'Primavera / Verão 26',
          cor: 'Areia',
        },
      },
      {
        id: 'al-item-02',
        sku: 'PEC-CAL-ALF-40',
        modelId: 'al-calca-alfaiataria',
        brand: 'Atelier Linho',
        model: 'Calça Alfaiataria Pregas',
        storage: 'M',
        color: 'Pedra',
        condition: 'Coleção Atual',
        batteryHealth: 100,
        origin: 'Fornecedor',
        imei1: '',
        serialNumber: 'AL-26-002',
        costPrice: 230,
        salePrice: 640,
        stockQty: 6,
        stockUnit: 'un.',
        status: 'Disponível',
        checklist: [],
        acquiredAt: '2026-11-14',
        customAttributes: {
          tamanho: 'M',
          tecido_material: 'Sarja Orgânica',
          colecao: 'Primavera / Verão 26',
          cor: 'Pedra',
        },
      },
      {
        id: 'al-item-03',
        sku: 'PEC-VES-OLI-P',
        modelId: 'al-vestido-midi',
        brand: 'Atelier Linho',
        model: 'Vestido Midi Linho Oliva',
        storage: 'P',
        color: 'Verde Oliva',
        condition: 'Edição Cápsula',
        batteryHealth: 100,
        origin: 'Fornecedor',
        imei1: '',
        serialNumber: 'AL-26-003',
        costPrice: 290,
        salePrice: 780,
        stockQty: 10,
        stockUnit: 'un.',
        status: 'Disponível',
        checklist: [],
        acquiredAt: '2026-11-15',
        customAttributes: {
          tamanho: 'P',
          tecido_material: 'Linho Puro',
          colecao: 'Cápsula Botânica',
          cor: 'Verde Oliva',
        },
      },
      {
        id: 'al-item-04',
        sku: 'PEC-BLA-LAF-G',
        modelId: 'al-blazer-estruturado',
        brand: 'Atelier Linho',
        model: 'Blazer Estruturado Lã Fria',
        storage: 'G',
        color: 'Taupe',
        condition: 'Últimas Peças',
        batteryHealth: 100,
        origin: 'Fornecedor',
        imei1: '',
        serialNumber: 'AL-26-004',
        costPrice: 440,
        salePrice: 1190,
        stockQty: 4,
        stockUnit: 'un.',
        status: 'Disponível',
        checklist: [],
        acquiredAt: '2026-11-16',
        customAttributes: {
          tamanho: 'G',
          tecido_material: 'Lã Fria',
          colecao: 'Alfaiataria Essencial',
          cor: 'Taupe',
        },
      },
    ],
    accessories: [
      {
        id: 'al-acc-01',
        sku: 'ACC-CIN-COU-90',
        name: 'Cinto Couro Fivela Escovada Caramelo',
        brand: 'Atelier Linho',
        category: 'Cintos',
        compatibleModelIds: ['al-camisa-linho', 'al-calca-alfaiataria', 'al-vestido-midi', 'usb-c-universal'],
        stock: 9,
        minStock: 4,
        costPrice: 85,
        price: 260,
        soldThisMonth: 18,
        customAttributes: { numeracao_medida: '90cm', material: 'Couro legítimo' },
      },
      {
        id: 'al-acc-02',
        sku: 'ACC-MOC-CAM-37',
        name: 'Mocassim Camurça Areia',
        brand: 'Atelier Linho',
        category: 'Calçados',
        compatibleModelIds: ['al-calca-alfaiataria', 'al-blazer-estruturado', 'al-camisa-linho'],
        stock: 3,
        minStock: 4,
        costPrice: 210,
        price: 590,
        soldThisMonth: 11,
        customAttributes: { numeracao_medida: '37', material: 'Camurça italiana' },
      },
      {
        id: 'al-acc-03',
        sku: 'ACC-BOL-PAL-UN',
        name: 'Bolsa Estruturada Palha & Couro',
        brand: 'Resort 26',
        category: 'Bolsas',
        compatibleModelIds: ['al-vestido-midi', 'al-camisa-linho', 'usb-c-universal'],
        stock: 6,
        minStock: 3,
        costPrice: 170,
        price: 480,
        soldThisMonth: 14,
        customAttributes: { numeracao_medida: 'Único', material: 'Palha natural e couro' },
      },
    ],
    customers: [
      {
        id: 'al-cu-01',
        name: 'Clara Mendonça',
        initials: 'CM',
        email: 'clara.mendonca@arquiteturaluz.com.br',
        phone: '(11) 98344-1920',
        cpf: '312.765.490-28',
        city: 'São Paulo, SP',
        status: 'ATIVO',
        segment: 'VIP',
        tags: ['Prefere Linho', 'Tamanho M', 'Tons Neutros'],
        since: '2025-05-20',
        createdAt: '2025-05-20',
        preferredContact: 'WhatsApp',
        ownedModelIds: ['al-camisa-linho', 'al-calca-alfaiataria'],
        notes: [
          {
            id: 'al-nt-01',
            author: 'Camila R.',
            createdAt: '2026-11-10',
            content: 'Gosta de peças em linho puro tamanho M e sempre combina com acessórios em couro caramelo.',
          },
        ],
        activities: [
          {
            id: 'al-act-01',
            type: 'sale',
            title: 'Compra registrada · Troca garantida 30d',
            detail: 'Camisa Linho Puro Areia + Cinto Couro',
            timestamp: '2026-11-10',
            actor: 'Camila Rocha',
          },
        ],
      },
      {
        id: 'al-cu-02',
        name: 'Sofia Albuquerque',
        initials: 'SA',
        email: 'sofia.albuquerque@gmail.com',
        phone: '(11) 99511-2304',
        cpf: '405.882.119-55',
        city: 'São Paulo, SP',
        status: 'ATIVO',
        segment: 'Varejo',
        tags: ['Tamanho P', 'Estilo Minimalista'],
        since: '2026-02-14',
        createdAt: '2026-02-14',
        preferredContact: 'WhatsApp',
        ownedModelIds: ['al-vestido-midi'],
        notes: [],
        activities: [
          {
            id: 'al-act-02',
            type: 'profile',
            title: 'Perfil de cliente criado',
            detail: 'Preferência por vestidos midi e tons oliva',
            timestamp: '2026-02-14',
            actor: 'Thiago Vasconcelos',
          },
        ],
      },
      {
        id: 'al-cu-03',
        name: 'Renata Queiroz',
        initials: 'RQ',
        email: 'renata@queirozdesign.com',
        phone: '(11) 97812-6640',
        cpf: '519.204.773-91',
        city: 'Campinas, SP',
        status: 'LEAD',
        segment: 'Varejo',
        tags: ['Cápsula Botânica', 'Tamanho G'],
        since: '2026-11-05',
        createdAt: '2026-11-05',
        preferredContact: 'WhatsApp',
        ownedModelIds: ['al-blazer-estruturado'],
        notes: [],
        activities: [],
      },
    ],
    orders: [
      {
        id: 'al-ord-01',
        code: 'AL-2026-0089',
        publicToken: 'al-troca-0089',
        customerId: 'al-cu-01',
        smartphoneId: 'al-item-01',
        smartphoneSnapshot: {
          brand: 'Atelier Linho',
          model: 'Camisa Linho Puro Areia',
          storage: 'M',
          color: 'Areia',
          condition: 'Coleção Atual',
          batteryHealth: 100,
          imei1: '',
          serialNumber: 'AL-26-001',
          checklist: [],
          unitPrice: 490,
        },
        accessories: [
          {
            accessoryId: 'al-acc-01',
            sku: 'ACC-CIN-COU-90',
            name: 'Cinto Couro Fivela Escovada Caramelo',
            quantity: 1,
            unitPrice: 260,
          },
        ],
        totalAmount: 750,
        paymentMethod: 'Cartão de Crédito',
        warrantyDays: 90,
        issuedAt: '2026-11-10',
        warrantyExpiresAt: '2026-12-10',
        sellerName: 'Camila Rocha',
      },
    ],
    auditLogs: [
      {
        id: 'al-aud-01',
        timestamp: '2026-11-20 09:20',
        actor: 'Thiago Vasconcelos',
        actorRole: 'ADMIN',
        actionType: 'CREATE_STORE',
        actionLabel: 'Loja Atelier Linho inicializada',
        targetLabel: 'Template Loja de Roupas & Moda',
        detail: 'Módulos ativos: Recomendações de Look e Garantia/Troca via QR Code',
      },
    ],
    stockLedger: [
      {
        id: 'al-led-01',
        timestamp: '2026-11-14 11:30',
        actor: 'Thiago Vasconcelos',
        itemType: 'Aparelho',
        itemId: 'al-item-01',
        itemLabel: 'Camisa Linho Puro Areia (M)',
        sku: 'PEC-CAM-LIN-M',
        delta: 1,
        resultingStock: 1,
        reason: 'Entrada',
        note: 'Coleção Primavera / Verão 26',
      },
    ],
    weeklyMovement: [
      { day: 'Seg', aparelhos: 4, acessorios: 6, revenue: 3250 },
      { day: 'Ter', aparelhos: 6, acessorios: 9, revenue: 4910 },
      { day: 'Qua', aparelhos: 5, acessorios: 7, revenue: 4120 },
      { day: 'Qui', aparelhos: 7, acessorios: 11, revenue: 5890 },
      { day: 'Sex', aparelhos: 11, acessorios: 16, revenue: 9420 },
      { day: 'Sáb', aparelhos: 14, acessorios: 21, revenue: 12180 },
    ],
  };
}

export function buildAuraCellSeed(): StoreSeedDataset {
  return {
    smartphones: INITIAL_SMARTPHONES.map((s) => ({
      ...s,
      checklist: s.checklist.map((c) => ({ ...c })),
    })),
    accessories: INITIAL_ACCESSORIES.map((a) => ({
      ...a,
      compatibleModelIds: [...a.compatibleModelIds],
    })),
    customers: INITIAL_CUSTOMERS.map((c) => ({
      ...c,
      tags: [...c.tags],
      ownedModelIds: [...c.ownedModelIds],
      notes: c.notes.map((n) => ({ ...n })),
      activities: c.activities.map((a) => ({ ...a })),
    })),
    orders: INITIAL_ORDERS.map((o) => ({
      ...o,
      accessories: o.accessories.map((a) => ({ ...a })),
      smartphoneSnapshot: o.smartphoneSnapshot
        ? {
            ...o.smartphoneSnapshot,
            checklist: o.smartphoneSnapshot.checklist.map((c) => ({ ...c })),
          }
        : undefined,
    })),
    deviceModels: DEVICE_MODELS.map((m) => ({
      ...m,
      storages: [...m.storages],
      colors: [...m.colors],
    })),
    catalog: {
      brands: [...INITIAL_DYNAMIC_CATALOG.brands],
      storages: [...INITIAL_DYNAMIC_CATALOG.storages],
      ramOptions: [...INITIAL_DYNAMIC_CATALOG.ramOptions],
      colors: [...INITIAL_DYNAMIC_CATALOG.colors],
      conditions: [...INITIAL_DYNAMIC_CATALOG.conditions],
      accessoryCategories: [...INITIAL_DYNAMIC_CATALOG.accessoryCategories],
    },
    auditLogs: INITIAL_AUDIT_LOGS.map((l) => ({ ...l })),
    stockLedger: INITIAL_STOCK_LEDGER.map((l) => ({ ...l })),
    weeklyMovement: WEEKLY_MOVEMENT.map((w) => ({ ...w })),
  };
}

export function buildEmptyStoreSeed(template: StoreTemplate): StoreSeedDataset {
  return {
    smartphones: [],
    accessories: [],
    customers: [],
    orders: [],
    deviceModels: [
      {
        id: 'usb-c-universal',
        brand: 'Universal',
        name: 'Compatível com todos os itens',
        tagLabel: 'Universal',
        storages: [],
        colors: [],
      },
    ],
    catalog: {
      brands: [template.storeName, 'Própria', 'Parceiro'],
      storages: ['Padrão', 'P', 'M', 'G'],
      ramOptions: ['Padrão'],
      colors: ['Padrão', 'Neutro'],
      conditions: ['Novo', 'Ativo', 'Destaque'],
      accessoryCategories: [template.labels.secondaryItemSingular, 'Complementos', 'Outros'],
    },
    auditLogs: [
      {
        id: `aud-init-${Date.now()}`,
        timestamp: `${REFERENCE_TODAY} 10:00`,
        actor: 'Administrador',
        actorRole: 'ADMIN',
        actionType: 'CREATE_STORE',
        actionLabel: 'Workspace criado no Open CRM',
        targetLabel: template.storeName,
        detail: `Segmento: ${template.segment} · ${template.primaryFields.length} campo(s) customizado(s)`,
      },
    ],
    stockLedger: [],
    weeklyMovement: [
      { day: 'Seg', aparelhos: 0, acessorios: 0, revenue: 0 },
      { day: 'Ter', aparelhos: 0, acessorios: 0, revenue: 0 },
      { day: 'Qua', aparelhos: 0, acessorios: 0, revenue: 0 },
      { day: 'Qui', aparelhos: 0, acessorios: 0, revenue: 0 },
      { day: 'Sex', aparelhos: 0, acessorios: 0, revenue: 0 },
      { day: 'Sáb', aparelhos: 0, acessorios: 0, revenue: 0 },
    ],
  };
}
