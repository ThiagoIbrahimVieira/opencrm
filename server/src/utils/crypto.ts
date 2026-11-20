import crypto from 'node:crypto';
import { argon2id } from 'hash-wasm';
import { env } from '../config/env.js';

const ENCRYPTION_KEY = Buffer.from(env.PII_ENCRYPTION_KEY_HEX, 'hex');
const HMAC_KEY = Buffer.from(env.PII_HMAC_KEY_HEX, 'hex');

/**
 * Encrypts a sensitive string (CPF, Phone, etc.) using AES-256-GCM.
 * Output format: iv_hex:auth_tag_hex:encrypted_hex
 */
export function encryptPii(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a sensitive string encrypted with AES-256-GCM.
 */
export function decryptPii(cipherPayload: string): string {
  if (!cipherPayload) return '';
  const parts = cipherPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Payload criptográfico inválido.');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates a deterministic Blind Index (HMAC-SHA256) for exact match lookups
 * without decrypting entire database tables.
 */
export function blindIndex(value: string): string {
  if (!value) return '';
  const normalized = value.replace(/\D/g, '').toLowerCase();
  return crypto.createHmac('sha256', HMAC_KEY).update(normalized).digest('hex');
}

/**
 * Hashes a password using Argon2id via WebAssembly (hash-wasm) with OWASP recommended params.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return await argon2id({
    password,
    salt,
    iterations: 3,
    parallelism: 1,
    memorySize: 65536, // 64 MB
    hashLength: 32,
    outputType: 'encoded',
  });
}

/**
 * Verifies a password against an Argon2id encoded hash string.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    const parts = hash.split('$');
    if (parts.length < 6) return false;
    const params = parts[3]; // m=65536,t=3,p=1
    const saltB64 = parts[4];
    // Base64 unpadded handling
    const padLength = (4 - (saltB64.length % 4)) % 4;
    const paddedSaltB64 = saltB64 + '='.repeat(padLength);
    const salt = Buffer.from(paddedSaltB64, 'base64');

    let memorySize = 65536;
    let iterations = 3;
    params.split(',').forEach((p) => {
      const [k, v] = p.split('=');
      if (k === 'm') memorySize = parseInt(v, 10);
      if (k === 't') iterations = parseInt(v, 10);
    });

    const computed = await argon2id({
      password: plain,
      salt,
      iterations,
      parallelism: 1,
      memorySize,
      hashLength: 32,
      outputType: 'encoded',
    });

    const bufA = Buffer.from(computed);
    const bufB = Buffer.from(hash);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Computes SHA-256 hash of refresh tokens.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function cleanDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function maskCpf(cpf: string): string {
  const digits = cleanDigits(cpf);
  if (digits.length !== 11) return '•••.•••.•••-••';
  return `•••.${digits.slice(3, 6)}.${digits.slice(6, 9)}-••`;
}

export function maskPhone(phone: string): string {
  const digits = cleanDigits(phone);
  if (digits.length < 10) return '••••-••••';
  const ddd = digits.slice(0, 2);
  const first = digits.slice(2, 3);
  const lastFour = digits.slice(-4);
  return `(${ddd}) ${first}••••-${lastFour}`;
}

export function maskImei(imei: string): string {
  const digits = cleanDigits(imei);
  if (digits.length < 10) return imei;
  return `${digits.slice(0, 6)}•••••${digits.slice(-4)}`;
}
