import { chromium } from 'playwright';
import fs from 'fs';

const TARGET_URL = 'https://opencrm-ashy.vercel.app';
const CHROME_PATH = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';

async function runDeepMobileAudit() {
  console.log('--- Iniciando Auditoria Aprofundada Mobile (Subagente 3) ---');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const detailedReport = {
    viewportsAudited: ['390x844 (iPhone 14)', '375x812 (iPhone SE)'],
    views: {},
    modals: {},
    touchTargetViolations: [],
    overflowViolations: [],
    visualBugs: []
  };

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

  // Dismiss any existing toast
  const toastClose = page.locator('button[aria-label="Fechar notificação"]:visible').first();
  if (await toastClose.isVisible()) {
    await toastClose.click();
    await page.waitForTimeout(500);
  }

  const checkOverflow = async (name) => {
    return await page.evaluate((n) => {
      const scrollW = document.documentElement.scrollWidth;
      const innerW = window.innerWidth;
      const bodyScrollW = document.body.scrollWidth;
      const elementsWithOverflow = [];
      document.querySelectorAll('*').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth + 1) {
          elementsWithOverflow.push({
            tag: el.tagName,
            cls: el.className?.toString()?.slice(0, 50),
            right: Math.round(rect.right),
            width: Math.round(rect.width)
          });
        }
      });
      return {
        name,
        hasOverflow: scrollW > innerW || bodyScrollW > innerW,
        scrollW,
        innerW,
        bodyScrollW,
        offscreenElements: elementsWithOverflow.slice(0, 5)
      };
    }, name);
  };

  // Helper to open drawer
  const openDrawer = async () => {
    const hamburger = page.locator('button[aria-label*="menu"]:visible, button:has(svg.lucide-menu):visible').first();
    await hamburger.click();
    await page.waitForTimeout(600);
  };

  // 1. Dashboard View
  console.log('Auditing: Dashboard');
  const dashOverflow = await checkOverflow('Dashboard');
  if (dashOverflow.hasOverflow) detailedReport.overflowViolations.push(dashOverflow);
  await page.screenshot({ path: 'tools/sub3_deep_dashboard.png' });

  // 2. Inventory View (Smartphones)
  console.log('Auditing: Inventory (Smartphones)');
  await openDrawer();
  const spLink = page.locator('button:has-text("Aparelhos"):visible').first();
  await spLink.click();
  await page.waitForTimeout(1500);
  const invOverflow = await checkOverflow('Inventory-Smartphones');
  if (invOverflow.hasOverflow) detailedReport.overflowViolations.push(invOverflow);
  await page.screenshot({ path: 'tools/sub3_deep_inventory_sp.png' });

  // Test Add Item Modal in Inventory
  console.log('Auditing: Add Item Modal');
  const addBtn = page.locator('button:has-text("Novo Item"):visible, button:has-text("Entrada de Aparelho"):visible, button:has-text("Cadastrar"):visible').first();
  if (await addBtn.isVisible()) {
    await addBtn.click();
    await page.waitForTimeout(1000);
    const modalOverflow = await checkOverflow('Modal-AddItem');
    if (modalOverflow.hasOverflow) detailedReport.overflowViolations.push(modalOverflow);
    await page.screenshot({ path: 'tools/sub3_deep_modal_additem.png' });

    // Check modal scrollability
    const modalScrollable = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return { found: false };
      const scrollableDiv = modal.querySelector('.overflow-y-auto') || modal;
      return {
        found: true,
        scrollHeight: scrollableDiv.scrollHeight,
        clientHeight: scrollableDiv.clientHeight,
        canScroll: scrollableDiv.scrollHeight > scrollableDiv.clientHeight
      };
    });
    detailedReport.modals['AddItemModal'] = modalScrollable;

    // Close modal
    const closeBtn = page.locator('button[aria-label*="Fechar"]:visible, button:has(svg.lucide-x):visible').last();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // 3. Customers View
  console.log('Auditing: Customers');
  await openDrawer();
  const custLink = page.locator('button:has-text("Clientes"):visible').first();
  await custLink.click();
  await page.waitForTimeout(1500);
  const custOverflow = await checkOverflow('Customers');
  if (custOverflow.hasOverflow) detailedReport.overflowViolations.push(custOverflow);
  await page.screenshot({ path: 'tools/sub3_deep_customers.png' });

  // Test Customer Modal
  console.log('Auditing: Customer Modal');
  const newCustBtn = page.locator('button:has-text("Novo Cliente"):visible, button:has-text("Cadastrar Cliente"):visible').first();
  if (await newCustBtn.isVisible()) {
    await newCustBtn.click();
    await page.waitForTimeout(1000);
    const custModalOverflow = await checkOverflow('Modal-Customer');
    if (custModalOverflow.hasOverflow) detailedReport.overflowViolations.push(custModalOverflow);
    await page.screenshot({ path: 'tools/sub3_deep_modal_customer.png' });

    const custModalScrollable = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return { found: false };
      const scrollableDiv = modal.querySelector('.overflow-y-auto') || modal;
      return {
        found: true,
        scrollHeight: scrollableDiv.scrollHeight,
        clientHeight: scrollableDiv.clientHeight,
        canScroll: scrollableDiv.scrollHeight > scrollableDiv.clientHeight
      };
    });
    detailedReport.modals['CustomerModal'] = custModalScrollable;

    const closeBtn = page.locator('button[aria-label*="Fechar"]:visible, button:has(svg.lucide-x):visible').last();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // 4. Checkout View
  console.log('Auditing: Checkout');
  await openDrawer();
  const checkoutLink = page.locator('button:has-text("Saída & Garantia"):visible').first();
  await checkoutLink.click();
  await page.waitForTimeout(1500);
  const checkOverflowResult = await checkOverflow('Checkout');
  if (checkOverflowResult.hasOverflow) detailedReport.overflowViolations.push(checkOverflowResult);
  await page.screenshot({ path: 'tools/sub3_deep_checkout.png' });

  // 5. Audit & Estoque View
  console.log('Auditing: Audit Ledger');
  await openDrawer();
  const auditLink = page.locator('button:has-text("Auditoria & Estoque"):visible').first();
  await auditLink.click();
  await page.waitForTimeout(1500);
  const auditOverflow = await checkOverflow('AuditLedger');
  if (auditOverflow.hasOverflow) detailedReport.overflowViolations.push(auditOverflow);
  await page.screenshot({ path: 'tools/sub3_deep_audit.png' });

  // 6. Test Quick Search Modal (Command K)
  console.log('Auditing: Command Search Modal');
  const searchBtn = page.locator('button[aria-label*="Busca"]:visible, button:has(svg.lucide-search):visible').first();
  if (await searchBtn.isVisible()) {
    await searchBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'tools/sub3_deep_modal_search.png' });
    const closeBtn = page.locator('button[aria-label*="Fechar"]:visible, button:has(svg.lucide-x):visible').last();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // 7. Test Store Wizard Modal
  console.log('Auditing: Store Wizard Modal');
  await openDrawer();
  const switcherBtn = page.locator('button[aria-label*="Alternar loja ativa"]:visible').first();
  await switcherBtn.click();
  await page.waitForTimeout(600);
  const createStoreBtn = page.locator('button:has-text("Criar nova loja / template"):visible').first();
  if (await createStoreBtn.isVisible()) {
    await createStoreBtn.click();
    await page.waitForTimeout(1000);
    const wizardOverflow = await checkOverflow('Modal-StoreWizard');
    if (wizardOverflow.hasOverflow) detailedReport.overflowViolations.push(wizardOverflow);
    await page.screenshot({ path: 'tools/sub3_deep_modal_wizard.png' });

    const wizardScrollable = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return { found: false };
      const scrollableDiv = modal.querySelector('.overflow-y-auto') || modal;
      return {
        found: true,
        scrollHeight: scrollableDiv.scrollHeight,
        clientHeight: scrollableDiv.clientHeight,
        canScroll: scrollableDiv.scrollHeight > scrollableDiv.clientHeight
      };
    });
    detailedReport.modals['StoreWizardModal'] = wizardScrollable;
  }

  // Touch Target Comprehensive Scan
  console.log('Auditing: Touch Targets');
  const touchTargets = await page.evaluate(() => {
    const interactives = Array.from(document.querySelectorAll('button, a[role="button"], input[type="button"], input[type="checkbox"], [tabindex="0"]'));
    return interactives.map(el => {
      const r = el.getBoundingClientRect();
      return {
        text: el.innerText?.slice(0, 30).trim() || el.getAttribute('aria-label') || el.tagName,
        width: Math.round(r.width),
        height: Math.round(r.height),
        visible: r.width > 0 && r.height > 0
      };
    }).filter(el => el.visible && (el.width < 44 || el.height < 44));
  });
  detailedReport.touchTargetViolations = touchTargets;

  fs.writeFileSync('tools/subagent3_deep_report.json', JSON.stringify(detailedReport, null, 2));
  console.log('✅ Relatório aprofundado salvo em tools/subagent3_deep_report.json');

  await browser.close();
}

runDeepMobileAudit().catch(err => {
  console.error('Erro na auditoria profunda:', err);
  process.exit(1);
});
