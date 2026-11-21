import { chromium } from 'playwright';

const TARGET_URL = 'https://opencrm-ashy.vercel.app';
const CHROME_PATH = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';

async function captureModals() {
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

  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Login Demo Admin
  const demoAdminBtn = page.locator('button:has-text("Demo Admin"):visible').first();
  if (await demoAdminBtn.isVisible()) {
    await demoAdminBtn.click();
    await page.waitForTimeout(2000);
  }

  // Dismiss toast
  const toastClose = page.locator('button[aria-label="Fechar notificação"]:visible').first();
  if (await toastClose.isVisible()) {
    await toastClose.click();
    await page.waitForTimeout(400);
  }

  // Open Drawer
  const hamburger = page.locator('button[aria-label*="menu"]:visible, button:has(svg.lucide-menu):visible').first();
  await hamburger.click();
  await page.waitForTimeout(600);

  // Open store switcher
  const switcherBtn = page.locator('button[aria-label*="Alternar loja ativa"]:visible').first();
  await switcherBtn.click();
  await page.waitForTimeout(500);

  // Click create new store
  const createStoreBtn = page.locator('button:has-text("Criar nova loja / template"):visible').first();
  if (await createStoreBtn.isVisible()) {
    await createStoreBtn.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'tools/sub3_deep_modal_wizard.png' });

    // Let's check wizard internal scroll
    const wizardScroll = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return null;
      const scrollable = modal.querySelector('.overflow-y-auto') || modal;
      return {
        modalHeight: modal.clientHeight,
        scrollHeight: scrollable.scrollHeight,
        clientHeight: scrollable.clientHeight,
        hasVerticalScroll: scrollable.scrollHeight > scrollable.clientHeight,
        hasHorizontalScroll: scrollable.scrollWidth > scrollable.clientWidth
      };
    });
    console.log('Wizard scroll stats:', wizardScroll);
  }

  await browser.close();
}

captureModals().catch(console.error);
