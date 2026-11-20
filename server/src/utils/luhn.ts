export interface ImeiValidationResult {
  valid: boolean;
  cleaned: string;
  reason?: string;
}

export function cleanDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function computeLuhnCheckDigit(prefix14: string): number {
  const digits = cleanDigits(prefix14);
  if (digits.length !== 14) {
    throw new Error(`Esperado prefixo de 14 dígitos para IMEI, recebido ${digits.length}`);
  }
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let n = Number(digits[i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return (10 - (sum % 10)) % 10;
}

export function buildValidIMEI(prefix14: string): string {
  const cleaned = cleanDigits(prefix14);
  return `${cleaned}${computeLuhnCheckDigit(cleaned)}`;
}

export function validateIMEI(raw: string): ImeiValidationResult {
  const cleaned = cleanDigits(raw);

  if (cleaned.length === 0) {
    return { valid: false, cleaned, reason: 'Informe os 15 dígitos do IMEI.' };
  }

  if (cleaned.length !== 15) {
    return {
      valid: false,
      cleaned,
      reason: `O IMEI deve conter exatamente 15 dígitos (${cleaned.length}/15).`,
    };
  }

  if (/^(\d)\1{14}$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      reason: 'Sequência de dígitos idênticos inválida para IMEI.',
    };
  }

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = Number(cleaned[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  if (sum % 10 !== 0) {
    return {
      valid: false,
      cleaned,
      reason: 'Dígito verificador inválido (falha no algoritmo de Luhn).',
    };
  }

  return { valid: true, cleaned };
}
