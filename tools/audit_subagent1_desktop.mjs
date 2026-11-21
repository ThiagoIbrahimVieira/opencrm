import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TARGET_URL = 'https://opencrm-ashy.vercel.app';
const CHROME_PATH = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';

async function runDesktopAudit() {
  console.log('=====================================================');
  console.log('🕵️ SUBAGENTE 1: CAÇA-BUGS FUNCIONAL DESKTOP (1440x900)');
  console.log(`Target: ${TARGET_URL}`);
  console.log('=====================================================');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const findings = [];
  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().toLowerCase().includes('warning')) {
      consoleErrors.push({ type: msg.type(), text: msg.text() });
    }
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      networkErrors.push({ url: res.url(), status: res.status(), statusText: res.statusText() });
    }
  });

  try {
    // 1. AUTENTICAÇÃO - LOGIN COM EMAIL INEXISTENTE
    console.log('\n[1.1] Testando login com email inexistente...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const loginButton = page.locator('button:has-text("Entrar no Sistema")');

    await emailInput.fill('usuario_inexistente_12345@opencrm.com.br');
    await passwordInput.fill('SenhaErrada123!');
    await loginButton.click();
    await page.waitForTimeout(2000);

    const bodyText1 = await page.innerText('body');
    const hasNotExistMsg = bodyText1.includes('Essa conta não existe.') || bodyText1.includes('não existe');
    console.log(` -> Mensagem de conta inexistente visível: ${hasNotExistMsg}`);
    await page.screenshot({ path: 'tools/sub1_auth_inexistente.png' });

    // 1.2 LOGIN COM SENHA INCORRETA (se houver conta de teste)
    console.log('\n[1.2] Testando botão Google OAuth...');
    const googleBtn = page.locator('button:has-text("Google"), button:has-text("Continuar com Google")');
    const googleBtnVisible = await googleBtn.isVisible().catch(() => false);
    console.log(` -> Botão Google visível: ${googleBtnVisible}`);

    // 1.3 DEMO ADMIN LOGIN & DASHBOARD
    console.log('\n[1.3] Entrando como Demo Admin...');
    const demoAdminBtn = page.locator('button:has-text("Demo Admin"), button:has-text("Entrar como Admin")');
    if (await demoAdminBtn.isVisible()) {
      await demoAdminBtn.click();
      await page.waitForTimeout(2500);
    }
    await page.screenshot({ path: 'tools/sub1_demo_dashboard.png' });

    // Checar se está no Dashboard
    const dashboardText = await page.innerText('body');
    const inDashboard = dashboardText.includes('Dashboard') || dashboardText.includes('Visão Geral') || dashboardText.includes('AuraCell');
    console.log(` -> Entrou no Dashboard: ${inDashboard}`);

    // 1.4 OPERAÇÃO & BALCÃO - TESTANDO ABAS DA SIDEBAR
    console.log('\n[1.4] Testando navegação nas abas da Sidebar...');
    const tabs = ['Estoque', 'Clientes', 'Checkout', 'Garantias', 'Equipe', 'Auditoria'];
    for (const tab of tabs) {
      const tabLocator = page.locator(`button:has-text("${tab}"), a:has-text("${tab}")`).first();
      if (await tabLocator.isVisible()) {
        await tabLocator.click();
        await page.waitForTimeout(1500);
        console.log(` -> Navegou para aba: ${tab}`);
        await page.screenshot({ path: `tools/sub1_tab_${tab.toLowerCase()}.png` });
      } else {
        console.log(` -> Aba não encontrada diretamente: ${tab}`);
      }
    }

    // 1.5 CHECKOUT COM BUSCA DE CPF
    console.log('\n[1.5] Testando tela de Checkout e busca CPF...');
    const checkoutTab = page.locator('button:has-text("Checkout"), a:has-text("Checkout"), button:has-text("PDV")').first();
    if (await checkoutTab.isVisible()) {
      await checkoutTab.click();
      await page.waitForTimeout(1500);

      const cpfInput = page.locator('input[placeholder*="CPF"], input[placeholder*="cpf"], input[name*="cpf"]').first();
      if (await cpfInput.isVisible()) {
        await cpfInput.fill('39482150842');
        await page.waitForTimeout(1500);
        console.log(' -> Preencheu CPF no checkout');
        await page.screenshot({ path: 'tools/sub1_checkout_cpf_search.png' });
      }
    }

    // 1.6 AUDITORIA LGPD E LEDGER
    console.log('\n[1.6] Verificando logs de Auditoria...');
    const auditTab = page.locator('button:has-text("Auditoria"), a:has-text("Auditoria")').first();
    if (await auditTab.isVisible()) {
      await auditTab.click();
      await page.waitForTimeout(1500);
      const auditContent = await page.innerText('body');
      console.log(` -> Logs de auditoria exibidos: ${auditContent.includes('LGPD') || auditContent.includes('Acesso') || auditContent.includes('Log')}`);
      await page.screenshot({ path: 'tools/sub1_audit_log.png' });
    }

    // 1.7 TESTE ROTA PÚBLICA DE GARANTIA
    console.log('\n[1.7] Testando rota pública /garantia/:token...');
    await page.goto(`${TARGET_URL}/garantia/token-teste-invalido-123`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'tools/sub1_garantia_token.png' });
    const garantiaText = await page.innerText('body');
    console.log(` -> Resposta rota garantia: ${garantiaText.slice(0, 100).replace(/\n/g, ' ')}`);

  } catch (err) {
    console.error(`❌ Erro no Subagente 1: ${err.message}`);
    findings.push({ severity: 'P0', title: 'Falha durante execução do Subagente 1', error: err.message });
  } finally {
    await browser.close();
  }

  const report = {
    subagent: 1,
    name: 'Caça-Bugs Funcional Desktop',
    consoleErrors,
    networkErrors,
    findings,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync('tools/subagent1_report.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Relatório Subagente 1 salvo em tools/subagent1_report.json');
}

runDesktopAudit();
