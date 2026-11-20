export interface ImeiValidationResult {
  valid: boolean;
  cleaned: string;
  reason?: string;
}

/**
 * Strips any non-digit characters from a raw IMEI string.
 */
export function cleanDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Computes the Luhn check digit for a 14-digit IMEI prefix.
 */
export function computeLuhnCheckDigit(prefix14: string): number {
  const digits = cleanDigits(prefix14);
  if (digits.length !== 14) {
    throw new Error(`Expected 14 digits for IMEI prefix, received ${digits.length}`);
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

/**
 * Builds a deterministic valid 15-digit IMEI from a 14-digit TAC+SNR prefix.
 */
export function buildValidIMEI(prefix14: string): string {
  const cleaned = cleanDigits(prefix14);
  return `${cleaned}${computeLuhnCheckDigit(cleaned)}`;
}

/**
 * Validates a 15-digit IMEI using the standard Luhn checksum algorithm.
 */
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

  // Reject trivial all-identical digit sequences (e.g. 000000000000000)
  if (/^(\d)\1{14}$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      reason: 'Sequência de dígitos inválida para IMEI.',
    };
  }

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = Number(cleaned[i]);
    // In 15-digit IMEI (0-indexed), odd positions (1,3,5,7,9,11,13) are doubled
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

/**
 * Masks an IMEI for table display: e.g. "354829•••••1042"
 */
export function maskIMEI(imei: string): string {
  const digits = cleanDigits(imei);
  if (digits.length < 10) return imei;
  return `${digits.slice(0, 6)}•••••${digits.slice(-4)}`;
}

/**
 * Formats a 15-digit IMEI into readable groups: "354829 10 482104 0"
 */
export function formatIMEI(imei: string): string {
  const digits = cleanDigits(imei);
  if (digits.length !== 15) return digits;
  return `${digits.slice(0, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 14)} ${digits.slice(14)}`;
}

/**
 * Masks a Brazilian CPF: "394.821.508-42" -> "•••.821.508-••"
 */
export function maskCPF(cpf: string): string {
  const digits = cleanDigits(cpf);
  if (digits.length !== 11) return '•••.•••.•••-••';
  return `•••.${digits.slice(3, 6)}.${digits.slice(6, 9)}-••`;
}

/**
 * Masks a Brazilian mobile phone: "(11) 98412-3390" -> "(11) 9••••-3390"
 */
export function maskPhone(phone: string): string {
  const digits = cleanDigits(phone);
  if (digits.length < 10) return '••••-••••';
  const ddd = digits.slice(0, 2);
  const firstDigit = digits.slice(2, 3);
  const lastFour = digits.slice(-4);
  return `(${ddd}) ${firstDigit}••••-${lastFour}`;
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDateBR(isoDate: string): string {
  const parts = isoDate.split('T')[0].split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function addDaysISO(isoDate: string, days: number): string {
  const base = new Date(`${isoDate.split('T')[0]}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function getDaysRemaining(expiresIso: string, referenceIso?: string): number {
  const ref = referenceIso
    ? new Date(`${referenceIso.split('T')[0]}T12:00:00Z`)
    : new Date();
  const exp = new Date(`${expiresIso.split('T')[0]}T12:00:00Z`);
  const diffMs = exp.getTime() - ref.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getWarrantyPercentRemaining(
  warrantyDays: number,
  expiresIso: string,
  referenceIso?: string
): number {
  if (warrantyDays <= 0) return 0;
  const remaining = Math.max(0, getDaysRemaining(expiresIso, referenceIso));
  return Math.min(100, Math.round((remaining / warrantyDays) * 100));
}
