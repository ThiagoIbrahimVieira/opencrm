import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildValidIMEI,
  computeLuhnCheckDigit,
  maskCPF,
  maskIMEI,
  maskPhone,
  validateIMEI,
} from './imei';
import {
  buildWhatsAppAccessoryUrl,
  buildWhatsAppWarrantyUrl,
  formatBrazilWhatsAppDigits,
  generateQrMatrix,
  generateWarrantyUuid,
} from './qrAndWhatsapp';
import { INITIAL_SMARTPHONES } from '../data/mockData';

test('validateIMEI accepts standard valid 15-digit Luhn IMEIs', () => {
  const known = validateIMEI('490154203237518');
  assert.equal(known.valid, true);
  assert.equal(known.cleaned, '490154203237518');

  const built = buildValidIMEI('35482910482104');
  assert.equal(built.length, 15);
  assert.equal(validateIMEI(built).valid, true);
});

test('validateIMEI rejects wrong lengths, non-Luhn digits, and repeated zeros', () => {
  assert.equal(validateIMEI('').valid, false);
  assert.equal(validateIMEI('3548291048').valid, false);
  assert.equal(validateIMEI('000000000000000').valid, false);

  const validImei = buildValidIMEI('35482910482104');
  const badCheck = (Number(validImei[14]) + 1) % 10;
  const tampered = `${validImei.slice(0, 14)}${badCheck}`;
  assert.equal(validateIMEI(tampered).valid, false);
});

test('computeLuhnCheckDigit returns expected single check digit', () => {
  assert.equal(computeLuhnCheckDigit('49015420323751'), 8);
});

test('every smartphone in mockData has mathematically valid Luhn IMEIs', () => {
  for (const phone of INITIAL_SMARTPHONES) {
    const r1 = validateIMEI(phone.imei1);
    assert.equal(r1.valid, true, `IMEI 1 invalid for ${phone.sku}: ${phone.imei1}`);
    if (phone.imei2) {
      const r2 = validateIMEI(phone.imei2);
      assert.equal(r2.valid, true, `IMEI 2 invalid for ${phone.sku}: ${phone.imei2}`);
    }
  }
});

test('masking helpers hide sensitive digits cleanly', () => {
  assert.equal(maskIMEI('354829104821040'), '354829•••••1040');
  assert.equal(maskCPF('394.821.508-42'), '•••.821.508-••');
  assert.equal(maskPhone('(11) 98412-3390'), '(11) 9••••-3390');
});

test('QR matrix generator is deterministic and produces valid 25x25 finder patterns', () => {
  const m1 = generateQrMatrix('https://auracell.com.br/garantia/test-uuid');
  const m2 = generateQrMatrix('https://auracell.com.br/garantia/test-uuid');
  assert.equal(m1.length, 25);
  assert.equal(m1[0].length, 25);
  assert.deepEqual(m1, m2);
  // Top-left 7x7 finder outer ring
  assert.equal(m1[0][0], true);
  assert.equal(m1[1][1], false);
  assert.equal(m1[3][3], true);

  const uuid = generateWarrantyUuid();
  assert.match(uuid, /^[0-9a-f-]{36}$/i);
});

test('WhatsApp wa.me builders normalize BR phone numbers and embed customer name & model', () => {
  assert.equal(formatBrazilWhatsAppDigits('(11) 98412-3390'), '5511984123390');

  const wUrl = buildWhatsAppWarrantyUrl({
    phone: '(11) 98412-3390',
    customerName: 'Helena Vasconcelos',
    modelName: 'iPhone 15 Pro',
    daysLeft: 8,
  });
  assert.ok(wUrl.startsWith('https://wa.me/5511984123390?text='));
  assert.ok(decodeURIComponent(wUrl).includes('Helena'));
  assert.ok(decodeURIComponent(wUrl).includes('iPhone 15 Pro'));

  const aUrl = buildWhatsAppAccessoryUrl({
    phone: '(11) 97231-0482',
    customerName: 'Rafael Mendonça',
    accessoryName: 'Película 3D Vidro Temperado',
    modelName: 'Galaxy S24 Ultra',
    priceFormatted: 'R$ 129,00',
  });
  assert.ok(aUrl.startsWith('https://wa.me/5511972310482?text='));
  assert.ok(decodeURIComponent(aUrl).includes('Rafael'));
  assert.ok(decodeURIComponent(aUrl).includes('Galaxy S24 Ultra'));
});
