import { z } from 'zod';
import { validateIMEI } from './luhn.js';

export interface CustomFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date';
  required: boolean;
  options?: string[];
  placeholder?: string;
  validator?: 'imei_luhn' | 'none';
}

export interface StoreTemplateConfig {
  id: string;
  storeName: string;
  segment: string;
  features: {
    hasSerializedItems?: boolean;
    hasWarrantyQr?: boolean;
    hasExpirationDate?: boolean;
    hasEntryChecklist?: boolean;
    hasCompatibilityCrossSell?: boolean;
    hasTradeIn?: boolean;
  };
  primaryFields?: CustomFieldDefinition[];
  secondaryFields?: CustomFieldDefinition[];
}

/**
 * Dynamically builds a Zod schema from a store's template configuration.
 */
export function buildCustomAttributesSchema(
  fields: CustomFieldDefinition[] = []
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case 'number':
        fieldSchema = z.coerce.number();
        break;
      case 'boolean':
        fieldSchema = z.boolean();
        break;
      case 'multiselect':
        fieldSchema = z.array(z.string());
        if (field.options && field.options.length > 0) {
          const validOptions = new Set(field.options);
          fieldSchema = z.array(
            z.string().refine((val) => validOptions.has(val), {
              message: `Opção inválida para o campo ${field.label}.`,
            })
          );
        }
        break;
      case 'select':
        if (field.options && field.options.length > 0) {
          const validOptions = new Set(field.options);
          fieldSchema = z.string().refine((val) => validOptions.has(val), {
            message: `Opção inválida para o campo ${field.label}.`,
          });
        } else {
          fieldSchema = z.string();
        }
        break;
      case 'date':
        fieldSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: `Data inválida para o campo ${field.label}.`,
        });
        break;
      case 'text':
      default:
        fieldSchema = z.string();
        if (field.validator === 'imei_luhn') {
          fieldSchema = z.string().refine(
            (val) => {
              const res = validateIMEI(val);
              return res.valid;
            },
            {
              message: `Dígito verificador de IMEI inválido para ${field.label} (falha no algoritmo de Luhn).`,
            }
          );
        }
        break;
    }

    if (field.required) {
      shape[field.key] = fieldSchema;
    } else {
      shape[field.key] = fieldSchema.optional();
    }
  }

  return z.object(shape).passthrough();
}
