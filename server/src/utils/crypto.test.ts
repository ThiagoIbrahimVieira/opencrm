import { describe, it, expect } from 'vitest';
import {
  encryptPii,
  decryptPii,
  blindIndex,
  hashPassword,
  verifyPassword,
  maskCpf,
  maskPhone,
  maskImei,
} from './crypto.js';
import { validateIMEI, buildValidIMEI } from './luhn.js';
import { buildCustomAttributesSchema } from './templateValidator.js';

describe('AppSec & Crypto Utilities', () => {
  it('should encrypt and decrypt sensitive PII via AES-256-GCM', () => {
    const originalCpf = '394.821.508-42';
    const encrypted = encryptPii(originalCpf);

    expect(encrypted).not.toBe(originalCpf);
    expect(encrypted).toContain(':'); // iv:tag:ciphertext

    const decrypted = decryptPii(encrypted);
    expect(decrypted).toBe(originalCpf);
  });

  it('should produce deterministic blind index regardless of formatting', () => {
    const phoneFormatted = '(11) 98412-3390';
    const phoneRaw = '11984123390';

    const index1 = blindIndex(phoneFormatted);
    const index2 = blindIndex(phoneRaw);

    expect(index1).toBe(index2);
    expect(index1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should hash and verify passwords with Argon2id', async () => {
    const password = 'SuperSecret123!';
    const hash = await hashPassword(password);

    expect(hash).toContain('$argon2id$');

    const isValid = await verifyPassword(hash, password);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword(hash, 'WrongPassword');
    expect(isInvalid).toBe(false);
  });

  it('should mask CPF, Phone and IMEI safely for LGPD views', () => {
    expect(maskCpf('39482150842')).toBe('•••.821.508-••');
    expect(maskPhone('11984123390')).toBe('(11) 9••••-3390');
    expect(maskImei('354829104821040')).toBe('354829•••••1040');
  });
});

describe('Luhn Algorithm & Dynamic Template Validation', () => {
  it('should validate 15-digit IMEIs with Luhn checksum', () => {
    const validImei = buildValidIMEI('35482910482104');
    expect(validateIMEI(validImei).valid).toBe(true);

    const invalidImei = validImei.slice(0, 14) + (Number(validImei[14]) === 9 ? '0' : '9');
    expect(validateIMEI(invalidImei).valid).toBe(false);
  });

  it('should dynamically build Zod schema enforcing types and Luhn validator', () => {
    const schema = buildCustomAttributesSchema([
      { id: 'f1', key: 'brand', label: 'Marca', type: 'select', required: true, options: ['Apple', 'Samsung'] },
      { id: 'f2', key: 'imei', label: 'IMEI', type: 'text', required: true, validator: 'imei_luhn' },
    ]);

    const validImei = buildValidIMEI('35482910482104');
    const validResult = schema.safeParse({ brand: 'Apple', imei: validImei });
    expect(validResult.success).toBe(true);

    const invalidResult = schema.safeParse({ brand: 'Outra', imei: validImei });
    expect(invalidResult.success).toBe(false);

    const invalidImeiResult = schema.safeParse({ brand: 'Apple', imei: '123456789012345' });
    expect(invalidImeiResult.success).toBe(false);
  });
});
