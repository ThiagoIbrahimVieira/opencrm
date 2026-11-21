import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://opencrm-ashy.vercel.app');
  await page.click('button:has-text("Demo Admin")');
  await page.waitForTimeout(2000);
  await page.click('button:has-text("Saída & Garantia")');
  await page.waitForTimeout(1000);

  // Search CPF
  const cpfInput = page.locator('input[placeholder*="digite o CPF"]').first();
  await cpfInput.fill('394.821.508-42');
  await page.click('button:has-text("Buscar CPF")');
  await page.waitForTimeout(500);

  // Click the phone card specifically inside Step 2
  const phoneLocator = page.locator('section:has-text("Escolher") button').first();
  console.log('Phone button text:', (await phoneLocator.innerText()).replace(/\n/g, ' '));
  await phoneLocator.click();
  await page.waitForTimeout(500);

  const confirmBtn = page.locator('button:has-text("Confirmar Saída e Gerar Termo")');
  console.log('Confirm button visible:', await confirmBtn.isVisible(), 'disabled:', await confirmBtn.isDisabled());

  await confirmBtn.click();
  await page.waitForTimeout(1500);

  const modalDialog = page.locator('div[role="dialog"]');
  console.log('Modal visible:', await modalDialog.isVisible());
  if (await modalDialog.isVisible()) {
    console.log('Modal text snippet:', (await modalDialog.innerText()).slice(0, 300).replace(/\n/g, ' '));
  }

  await browser.close();
}

main().catch(console.error);
