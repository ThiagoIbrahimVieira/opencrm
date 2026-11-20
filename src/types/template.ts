export type CustomFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'date';

export type CustomFieldValidator = 'imei_luhn' | 'none';

/**
 * Metadata definition for dynamic store item fields.
 * Designed to map 1:1 to PostgreSQL JSONB columns (`template_schema` + `custom_attributes`).
 */
export interface CustomFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  validator?: CustomFieldValidator;
}

export interface StoreFeatureFlags {
  hasSerializedItems: boolean;
  hasWarrantyQr: boolean;
  hasExpirationDate: boolean;
  hasEntryChecklist: boolean;
  hasCompatibilityCrossSell: boolean;
  hasTradeIn: boolean;
}

export interface StoreLabels {
  primaryTabName: string;
  secondaryTabName: string;
  primaryItemSingular: string;
  secondaryItemSingular: string;
  orderActionLabel: string;
  crossSellTitle: string;
}

export interface StoreTemplate {
  id: string;
  storeName: string;
  segment: string;
  description: string;
  labels: StoreLabels;
  features: StoreFeatureFlags;
  primaryFields: CustomFieldDefinition[];
  secondaryFields: CustomFieldDefinition[];
  defaultChecklist: string[];
}

export interface StoreSummaryItem {
  storeId: string;
  template: StoreTemplate;
}
