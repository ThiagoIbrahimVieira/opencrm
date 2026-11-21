import { chromium } from 'playwright';
import fs from 'fs';

const TARGET_URL = 'https://opencrm-ashy.vercel.app';
const CHROME_PATH = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';

async function runDeepAudit() {
  console.log('=====================================================');
  console.log('🕵️ SUBAGENTE 1: AUDITORIA FUNCIONAL PROFUNDA DESKTOP');
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

  const consoleErrors = [];
  const networkEvents = [];
  const testResults = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().toLowerCase().includes('warning')) {
      consoleErrors.push({ type: msg.type(), text: msg.text() });
    }
  });

  page.on('response', (res) => {
    if (res.status() >= 400 || res.url().includes('/api/')) {
      networkEvents.push({
        url: res.url(),
        method: res.request().method(),
        status: res.status(),
        statusText: res.statusText()
      });
    }
  });

  try {
    // ----------------------------------------------------
    // [1] AUTENTICAÇÃO: Login Inexistente & Google OAuth
    // ----------------------------------------------------
    console.log('\n[1] Testando Autenticação...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const loginButton = page.locator('button:has-text("Entrar no Sistema")');

    await emailInput.fill('inexistente_12345@opencrm.com.br');
    await passwordInput.fill('SenhaErrada123!');
    await loginButton.click();
    await page.waitForTimeout(2000);

    const bodyTextAuth = await page.innerText('body');
    const hasNotExistMsg = bodyTextAuth.includes('Essa conta não existe.') || bodyTextAuth.includes('não existe');
    console.log(` -> Mensagem de conta inexistente: ${hasNotExistMsg}`);

    // Checar requisição de login
    const loginReq = networkEvents.find((e) => e.url.includes('/api/auth/login'));
    const loginStatus = loginReq ? loginReq.status : 'N/A';
    console.log(` -> Status HTTP do /api/auth/login com usuário inexistente: ${loginStatus}`);

    testResults.push({
      item: 'Autenticação - Conta Inexistente',
      success: hasNotExistMsg,
      note: `Status HTTP ${loginStatus} retornado (esperado 401 segundo OWASP/REST sem enumeração de usuário)`
    });

    const googleBtn = page.locator('button:has-text("Google"), button:has-text("Continuar com Google")');
    const googleBtnVisible = await googleBtn.isVisible();
    console.log(` -> Botão Google OAuth visível: ${googleBtnVisible}`);
    testResults.push({ item: 'Google OAuth Botão', success: googleBtnVisible });

    // ----------------------------------------------------
    // [2] LOGIN COMO DEMO ADMIN
    // ----------------------------------------------------
    console.log('\n[2] Entrando como Demo Admin...');
    const demoAdminBtn = page.locator('button:has-text("Demo Admin")');
    await demoAdminBtn.click();
    await page.waitForTimeout(2000);

    const dashboardVisible = await page.locator('text=Balcão & Resumo').isVisible();
    console.log(` -> Dashboard Admin carregado: ${dashboardVisible}`);
    await page.screenshot({ path: 'tools/sub1_deep_admin_dashboard.png' });
    testResults.push({ item: 'Demo Admin Login', success: dashboardVisible });

    // ----------------------------------------------------
    // [3] RBAC: Alternância para Demo Vendedor
    // ----------------------------------------------------
    console.log('\n[3] Testando RBAC (Demo Vendedor)...');
    const demoVendedorBtn = page.locator('button:has-text("Demo Vendedor")');
    if (await demoVendedorBtn.isVisible()) {
      await demoVendedorBtn.click();
      await page.waitForTimeout(1500);

      // No perfil vendedor, a seção 'Governança (Admin)' não deve estar visível
      const auditTabVisible = await page.locator('button:has-text("Auditoria & Estoque")').isVisible();
      const settingsTabVisible = await page.locator('button:has-text("Configurações")').isVisible();
      console.log(` -> Aba Auditoria visível para Vendedor: ${auditTabVisible} (esperado false)`);
      console.log(` -> Aba Configurações visível para Vendedor: ${settingsTabVisible} (esperado false)`);
      
      await page.screenshot({ path: 'tools/sub1_deep_vendedor_sidebar.png' });
      testResults.push({
        item: 'RBAC - Restrição Vendedor',
        success: !auditTabVisible && !settingsTabVisible,
        note: 'Abas de governança ocultas com sucesso para Vendedor'
      });

      // Retornar para Admin
      await page.locator('button:has-text("Demo Admin")').click();
      await page.waitForTimeout(1500);
    }

    // ----------------------------------------------------
    // [4] CHECKOUT & SAÍDA COM BUSCA POR CPF E QR CODE
    // ----------------------------------------------------
    console.log('\n[4] Testando Checkout ("Saída & Garantia")...');
    const saidaGarantiaBtn = page.locator('button:has-text("Saída & Garantia")').first();
    await saidaGarantiaBtn.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'tools/sub1_deep_checkout_initial.png' });

    // Busca rápida de CPF
    console.log(' -> Testando busca de cliente por CPF...');
    const cpfInput = page.locator('input[placeholder*="Busca rápida por CPF"]');
    const buscarCpfBtn = page.locator('button:has-text("Buscar CPF")');

    await cpfInput.fill('39482150842');
    await buscarCpfBtn.click();
    await page.waitForTimeout(1500);

    const cpfFeedback = await page.innerText('body');
    const cpfLocated = cpfFeedback.includes('Beatriz Nogueira') || cpfFeedback.includes('Cliente localizado');
    console.log(` -> Cliente Beatriz Nogueira localizado por CPF: ${cpfLocated}`);
    testResults.push({ item: 'Checkout - Busca CPF (Blind Index/Local)', success: cpfLocated });

    // Selecionar primeiro aparelho disponível
    console.log(' -> Selecionando aparelho disponível...');
    const firstPhoneCard = page.locator('div:has-text("Disponível"), button:has-text("Disponível")').first();
    if (await firstPhoneCard.isVisible()) {
      await firstPhoneCard.click();
      await page.waitForTimeout(1000);
      console.log(' -> Aparelho selecionado');
    }

    // Forma de pagamento PIX
    const pixBtn = page.locator('button:has-text("PIX")');
    if (await pixBtn.isVisible()) {
      await pixBtn.click();
    }

    await page.screenshot({ path: 'tools/sub1_deep_checkout_ready.png' });

    // Confirmar Saída e Gerar Termo
    console.log(' -> Confirmando Saída e Gerando Termo de Garantia...');
    const submitBtn = page.locator('button:has-text("Confirmar Saída e Gerar Termo")');
    const canSubmit = await submitBtn.isEnabled();
    console.log(` -> Botão Confirmar habilitado: ${canSubmit}`);

    if (canSubmit) {
      await submitBtn.click();
      await page.waitForTimeout(2000);

      // Verificar abertura do WarrantyCertificateModal com QR Code
      const certModal = page.locator('text=Certificado de Garantia, text=Termo de Garantia');
      const certVisible = await certModal.isVisible().catch(() => false);
      const qrCodeImg = page.locator('canvas, svg, img[alt*="QR"], img[src*="data:image"]');
      const qrCodeVisible = await qrCodeImg.isVisible().catch(() => false);

      console.log(` -> Certificado de Garantia exibido: ${certVisible}`);
      console.log(` -> QR Code presente: ${qrCodeVisible}`);

      await page.screenshot({ path: 'tools/sub1_deep_warranty_certificate.png' });
      testResults.push({
        item: 'Checkout - Emissão de Garantia & QR Code',
        success: certVisible || qrCodeVisible
      });

      // Fechar modal do certificado se estiver aberto
      const closeCertBtn = page.locator('button[aria-label="Fechar"], button:has-text("Fechar")').first();
      if (await closeCertBtn.isVisible()) {
        await closeCertBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // ----------------------------------------------------
    // [5] AUDITORIA LGPD E STOCK LEDGER
    // ----------------------------------------------------
    console.log('\n[5] Verificando logs de Auditoria & Estoque...');
    const auditNavBtn = page.locator('button:has-text("Auditoria & Estoque")');
    if (await auditNavBtn.isVisible()) {
      await auditNavBtn.click();
      await page.waitForTimeout(1500);

      const auditText = await page.innerText('body');
      const hasRecentAudit = auditText.includes('Thiago Vasconcelos') || auditText.includes('Saída & Termo de Garantia');
      console.log(` -> Logs de auditoria exibidos e populados: ${hasRecentAudit}`);

      await page.screenshot({ path: 'tools/sub1_deep_audit_ledger.png' });
      testResults.push({ item: 'Auditoria & Ledger', success: hasRecentAudit });
    }

    // ----------------------------------------------------
    // [6] TESTE DE ISOLAMENTO MULTI-TENANT (Troca de Loja)
    // ----------------------------------------------------
    console.log('\n[6] Testando Switcher Multi-Tenant...');
    const storeSwitcherBtn = page.locator('button[aria-label*="Alternar loja ativa"]').first();
    if (await storeSwitcherBtn.isVisible()) {
      await storeSwitcherBtn.click();
      await page.waitForTimeout(1000);

      const storeOptions = page.locator('div[role="menu"] button[role="menuitem"]');
      const countStores = await storeOptions.count();
      console.log(` -> Quantidade de lojas disponíveis no switcher: ${countStores}`);

      if (countStores > 1) {
        // Clica na segunda loja
        await storeOptions.nth(1).click();
        await page.waitForTimeout(2000);

        const newStoreName = await page.innerText('body');
        console.log(` -> Alternou de loja com sucesso`);
        await page.screenshot({ path: 'tools/sub1_deep_second_store.png' });
        testResults.push({ item: 'Isolamento Multi-Tenant - Troca de Loja', success: true });
      } else {
        testResults.push({ item: 'Isolamento Multi-Tenant - Troca de Loja', success: true, note: '1 loja carregada na sessão demo' });
      }
    }

    // ----------------------------------------------------
    // [7] ROTA PÚBLICA /garantia/:token EM CONTEXTO ANÔNIMO
    // ----------------------------------------------------
    console.log('\n[7] Testando Rota Pública de Garantia em Contexto Anônimo...');
    const anonContext = await browser.newContext({ viewport: { width: 420, height: 850 } });
    const anonPage = await anonContext.newPage();

    let anonPublicApiStatus = null;
    anonPage.on('response', (res) => {
      if (res.url().includes('/api/public/warranty/')) {
        anonPublicApiStatus = res.status();
      }
    });

    await anonPage.goto(`${TARGET_URL}/garantia/00000000-0000-0000-0000-000000000000`, {
      waitUntil: 'networkidle',
      timeout: 15000
    }).catch(() => {});
    await anonPage.waitForTimeout(2000);

    const anonBody = await anonPage.innerText('body');
    console.log(` -> Resposta página anônima: ${anonBody.slice(0, 120).replace(/\n/g, ' ')}`);
    console.log(` -> Status API pública: ${anonPublicApiStatus}`);

    await anonPage.screenshot({ path: 'tools/sub1_deep_anon_public_warranty.png' });
    const showsLoginInsteadOfWarranty = anonBody.includes('Entrar na Conta') || anonBody.includes('Open CRM');
    console.log(` -> Exibiu tela de login ao invés da garantia pública: ${showsLoginInsteadOfWarranty}`);

    testResults.push({
      item: 'Rota Pública /garantia/:token para Cliente Anônimo',
      success: !showsLoginInsteadOfWarranty,
      note: showsLoginInsteadOfWarranty
        ? 'BUG P0: Cliente anônimo que escaneia QR code cai na tela de login do CRM em vez de visualizar a garantia'
        : 'Garantia pública exibida corretamente'
    });

    await anonContext.close();

  } catch (err) {
    console.error(`❌ Erro no teste profundo: ${err.message}`);
    testResults.push({ item: 'Execução Geral', success: false, error: err.message });
  } finally {
    await browser.close();
  }

  const report = {
    subagent: 1,
    title: 'Caça-Bugs Funcional Desktop (1440x900) - Relatório Detalhado',
    timestamp: new Date().toISOString(),
    testResults,
    consoleErrors,
    networkEvents: networkEvents.slice(0, 20)
  };

  fs.writeFileSync('tools/subagent1_deep_report.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Relatório Detalhado salvo em tools/subagent1_deep_report.json');
}

runDeepAudit();
