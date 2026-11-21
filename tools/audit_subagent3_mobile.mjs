import { chromium } from 'playwright';
import fs from 'fs';

const TARGET_URL = 'https://opencrm-ashy.vercel.app';
const CHROME_PATH = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';

async function runMobileAudit() {
  console.log('=====================================================');
  console.log('📱 SUBAGENTE 3: AUDITORIA MOBILE & VISUAL (390x844 & 375x812)');
  console.log(`Target: ${TARGET_URL}`);
  console.log('=====================================================');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const viewports = [
    { name: 'iPhone 14 / Modern Mobile', width: 390, height: 844 },
    { name: 'iPhone SE / Compact Mobile', width: 375, height: 812 }
  ];

  const report = {
    subagent: 3,
    name: 'Auditoria Mobile, Responsividade & Visual (impeccable)',
    viewports: [],
    overflowsDetected: [],
    smallTouchTargets: [],
    consoleErrors: [],
    networkErrors: [],
    findings: [],
    timestamp: new Date().toISOString()
  };

  for (const vp of viewports) {
    console.log(`\n--- Testando viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') report.consoleErrors.push({ vp: vp.name, text: msg.text() });
    });

    page.on('response', (res) => {
      if (res.status() >= 400) report.networkErrors.push({ vp: vp.name, url: res.url(), status: res.status() });
    });

    // 1. LOGIN VIEW MOBILE
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const loginOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(` -> Login View Overflow Horizontal: ${loginOverflow}`);
    if (loginOverflow) {
      report.overflowsDetected.push({ view: 'LoginView', vp: vp.name });
    }
    await page.screenshot({ path: `tools/sub3_login_${vp.width}x${vp.height}.png` });

    // 2. ENTRAR EM DEMO ADMIN
    const demoAdminBtn = page.locator('button:has-text("Demo Admin")').first();
    if (await demoAdminBtn.isVisible()) {
      await demoAdminBtn.click();
      await page.waitForTimeout(2000);
    }

    // 3. DASHBOARD MOBILE
    const dashOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    console.log(` -> Dashboard View Overflow Horizontal: ${dashOverflow}`);
    if (dashOverflow) {
      report.overflowsDetected.push({ view: 'DashboardView', vp: vp.name });
    }
    await page.screenshot({ path: `tools/sub3_dashboard_${vp.width}x${vp.height}.png` });

    // 4. TESTAR MENU / SIDEBAR MOBILE
    console.log(' -> Testando abertura do menu mobile...');
    const hamburgerBtn = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"], button:has(svg.lucide-menu)').first();
    if (await hamburgerBtn.isVisible()) {
      await hamburgerBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `tools/sub3_menu_open_${vp.width}x${vp.height}.png` });

      // Fechar menu
      const closeBtn = page.locator('button[aria-label*="fechar"], button:has(svg.lucide-x)').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 5. TESTAR ABAS NO MOBILE
    const mobileTabs = ['Estoque', 'Clientes', 'Checkout'];
    for (const tab of mobileTabs) {
      // Procurar aba no rodapé móvel ou cabeçalho
      const tabBtn = page.locator(`button:has-text("${tab}"), a:has-text("${tab}")`).first();
      if (await tabBtn.isVisible()) {
        await tabBtn.click();
        await page.waitForTimeout(1500);
        const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        console.log(` -> Aba ${tab} Overflow: ${hasOverflow}`);
        if (hasOverflow) {
          report.overflowsDetected.push({ view: tab, vp: vp.name });
        }
        await page.screenshot({ path: `tools/sub3_tab_${tab.toLowerCase()}_${vp.width}x${vp.height}.png` });
      }
    }

    // 6. VERIFICAR ÁREAS DE TOQUE (TOUCH TARGETS < 44px)
    console.log(' -> Verificando tamanhos de botões interativos...');
    const smallTargets = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="button"]'));
      return buttons
        .map((b) => {
          const rect = b.getBoundingClientRect();
          return {
            text: b.innerText?.slice(0, 30) || b.getAttribute('aria-label') || 'unnamed',
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        })
        .filter((b) => (b.width > 0 && b.width < 40) || (b.height > 0 && b.height < 40))
        .slice(0, 10);
    });

    if (smallTargets.length > 0) {
      console.log(` -> Alerta: ${smallTargets.length} botões menores que 40px detectados`);
      report.smallTouchTargets.push({ vp: vp.name, targets: smallTargets });
    }

    await context.close();
  }

  await browser.close();

  fs.writeFileSync('tools/subagent3_report.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Relatório Subagente 3 salvo em tools/subagent3_report.json');
}

runMobileAudit();
