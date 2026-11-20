import { cleanDigits } from './imei';

/**
 * Generates a deterministic 25x25 QR-style binary matrix for crisp inline SVG rendering
 * with standard 7x7 finder patterns, timing tracks, alignment square, and UUID-derived payload modules.
 */
export function generateQrMatrix(payload: string): boolean[][] {
  const size = 25;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const placeFinder = (rowOffset: number, colOffset: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          grid[rr][cc] = false;
        } else {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[rr][cc] = isBorder || isCenter;
        }
      }
    }
  };

  // Three standard QR finder patterns
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment pattern at (18, 18) for 25x25 Version 2 QR geometry
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = 18 + r;
      const cc = 18 + c;
      reserved[rr][cc] = true;
      grid[rr][cc] =
        Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    grid[6][i] = i % 2 === 0;
    reserved[i][6] = true;
    grid[i][6] = i % 2 === 0;
  }

  // Deterministic bit stream derived from payload string (FNV-1a seeded PRNG)
  let seed = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    seed ^= payload.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }

  const nextBit = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return ((seed >>> 16) & 1) === 1;
  };

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        grid[r][c] = nextBit();
      }
    }
  }

  return grid;
}

/**
 * Formats a Brazilian phone number into international E.164 digits for wa.me links.
 */
export function formatBrazilWhatsAppDigits(phone: string): string {
  const digits = cleanDigits(phone);
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
}

/**
 * Builds a personalized wa.me link for an expiring warranty reminder.
 */
export function buildWhatsAppWarrantyUrl(params: {
  phone: string;
  customerName: string;
  modelName: string;
  daysLeft: number;
}): string {
  const firstName = params.customerName.trim().split(/\s+/)[0] ?? params.customerName;
  const digits = formatBrazilWhatsAppDigits(params.phone);
  const daysText =
    params.daysLeft === 1 ? '1 dia' : `${params.daysLeft} dias`;
  const text = `Olá ${firstName}, tudo bem? Aqui é da AuraCell! Passando para avisar que a garantia do seu ${params.modelName} vence em ${daysText}. Se quiser agendar uma revisão preventiva gratuita no balcão antes do vencimento, é só nos avisar por aqui.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Builds a personalized wa.me link offering an in-stock compatible accessory.
 */
export function buildWhatsAppAccessoryUrl(params: {
  phone: string;
  customerName: string;
  modelName: string;
  accessoryName: string;
  priceFormatted: string;
}): string {
  const firstName = params.customerName.trim().split(/\s+/)[0] ?? params.customerName;
  const digits = formatBrazilWhatsAppDigits(params.phone);
  const text = `Olá ${firstName}, tudo bem? Aqui é da AuraCell! Recebemos em estoque o acessório "${params.accessoryName}" (${params.priceFormatted}), 100% compatível com o seu ${params.modelName}. Quer que eu deixe uma unidade reservada para você no balcão?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Builds a direct wa.me link for initiating a personalized customer conversation.
 */
export function buildWhatsAppDirectCustomerUrl(params: {
  phone: string;
  customerName: string;
}): string {
  const firstName = params.customerName.trim().split(/\s+/)[0] ?? params.customerName;
  const digits = formatBrazilWhatsAppDigits(params.phone);
  const text = `Olá ${firstName}, tudo bem? Aqui é da equipe AuraCell Boutique. Como posso ajudar hoje?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Generates a clean UUID v4-style public token for warranty QR codes.
 */
export function generateWarrantyUuid(seedSuffix?: string): string {
  const hex = (len: number) =>
    Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  if (seedSuffix) {
    return seedSuffix;
  }
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}
