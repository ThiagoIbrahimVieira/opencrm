import { chromium } from 'playwright';

async function testCheckout() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://opencrm-ashy.vercel.app', { waitUntil: 'networkidle' });
  await page.locator('button:has-text("Demo Admin")').click();
  await page.waitForTimeout(1500);

  // Ir para Saída & Garantia
  await page.locator('button:has-text("Saída & Garantia")').first().click();
  await page.waitForTimeout(1500);

  // Clicar no primeiro aparelho
  const phoneBtn = page.locator('button:has-text("iPhone 16 Pro Max")').first();
  await phoneBtn.click();
  await page.waitForTimeout(500);

  // Clicar Confirmar Saída e Gerar Termo
  const submitBtn = page.locator('button:has-text("Confirmar Saída e Gerar Termo")');
  console.log('Botão habilitado:', await submitBtn.isEnabled());
  await submitBtn.click();
  await page.waitForTimeout(2000);

  // Tirar print do modal de certificado
  await page.screenshot({ path: 'tools/sub1_deep_warranty_certificate.png' });
  const modalText = await page.innerText('body');
  console.log('Certificado visível:', modalText.includes('Termo de Garantia') || modalText.includes('Certificado'));

  await browser.close();
}
testCheckout();
