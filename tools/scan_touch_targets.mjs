import { chromium } from 'playwright';
import fs from 'fs';

const TARGET_URL = 'https://opencrm-ashy.vercel.app';
const CHROME_PATH = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';

async function scanTouchTargets() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();

  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const targetsByPage = {};

  const scanCurrentPage = async (pageName) => {
    const targets = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="tab"], [role="menuitem"]'));
      return elements.map(el => {
        const rect = el.getBoundingClientRect();
        const text = el.innerText?.slice(0, 40).replace(/\s+/g, ' ').trim() || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName;
        return {
          text,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden'
        };
      }).filter(el => el.visible && (el.width < 44 || el.height < 44));
    });
    targetsByPage[pageName] = targets;
  };

  // 1. Login View
  await scanCurrentPage('Login');

  // 2. Demo Admin Dashboard
  await page.locator('button:has-text("Demo Admin")').click();
  await page.waitForTimeout(2000);
  await scanCurrentPage('Dashboard');

  // 3. Mobile Menu / Sidebar Open
  await page.locator('button:has(svg.lucide-menu):visible').click();
  await page.waitForTimeout(600);
  await scanCurrentPage('SidebarMenu');
  await page.locator('button[aria-label="Fechar menu"]:visible').click();
  await page.waitForTimeout(500);

  // 4. Inventory
  await page.locator('button:has(svg.lucide-menu):visible').click();
  await page.waitForTimeout(500);
  await page.locator('.fixed button:has-text("Aparelhos"):visible').click();
  await page.waitForTimeout(1500);
  await scanCurrentPage('Inventory');

  // 5. Customers
  await page.locator('button:has(svg.lucide-menu):visible').click();
  await page.waitForTimeout(500);
  await page.locator('.fixed button:has-text("Clientes"):visible').first().click();
  await page.waitForTimeout(1500);
  await scanCurrentPage('Customers');

  // 6. Checkout
  await page.locator('button:has(svg.lucide-menu):visible').click();
  await page.waitForTimeout(500);
  await page.locator('.fixed button:has-text("Saída & Garantia"):visible').click();
  await page.waitForTimeout(1500);
  await scanCurrentPage('Checkout');

  // 7. Audit
  await page.locator('button:has(svg.lucide-menu):visible').click();
  await page.waitForTimeout(500);
  await page.locator('.fixed button:has-text("Auditoria & Estoque"):visible').click();
  await page.waitForTimeout(1500);
  await scanCurrentPage('AuditLedger');

  fs.writeFileSync('tools/touch_targets_audit.json', JSON.stringify(targetsByPage, null, 2));
  console.log('✅ Touch targets audit complete! Results saved in tools/touch_targets_audit.json');

  await browser.close();
}

scanTouchTargets().catch(console.error);
