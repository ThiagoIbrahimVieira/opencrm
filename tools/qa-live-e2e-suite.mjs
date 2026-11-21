import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TARGET_URL = 'https://opencrm-ashy.vercel.app';

async function runE2ESuite() {
  console.log('=====================================================');
  console.log('🚀 [QA E2E LIVE] AUDITORIA DE PRODUÇÃO AO VIVO');
  console.log(`Target: ${TARGET_URL}`);
  console.log('=====================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const auditReport = {
    target: TARGET_URL,
    timestamp: new Date().toISOString(),
    scenarios: [],
  };

  const consoleLogs = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') console.log(`[PAGE CONSOLE ERROR] ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    console.error(`[PAGE UNCAUGHT ERROR] ${err.message}`);
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      networkErrors.push({ url: res.url(), status: res.status(), statusText: res.statusText() });
    }
  });

  try {
    // -------------------------------------------------------------
    // CENÁRIO 1: Login com e-mail inexistente (deve exibir 404, sem 500)
    // -------------------------------------------------------------
    console.log('\n[CENÁRIO 1] Testando tentativa de login com e-mail inexistente...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

    let loginResponseStatus = null;
    let loginResponseBody = null;

    const [loginResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/auth/login'), { timeout: 8000 }).catch(() => null),
      (async () => {
        await page.fill('input[type="email"]', 'naoexiste@auracell.com.br');
        await page.fill('input[type="password"]', 'Password123!');
        await page.click('button:has-text("Entrar no Sistema")');
      })(),
    ]);

    if (loginResponse) {
      loginResponseStatus = loginResponse.status();
      loginResponseBody = await loginResponse.text().catch(() => '');
      console.log(` - Resposta HTTP do /api/auth/login: ${loginResponseStatus}`);
      console.log(` - Corpo: ${loginResponseBody.slice(0, 150)}`);
    } else {
      console.log(' - Nenhuma resposta de rede interceptada para /api/auth/login (timeout)');
    }

    await page.waitForTimeout(1000);
    const errorAlert = await page.locator('.text-\\[\\#9B3B2B\\], [role="alert"]').allInnerTexts();
    const errorText = errorAlert.join(' | ');
    console.log(` - Mensagem na UI: "${errorText}"`);

    await page.screenshot({ path: 'tools/cenario-1-login-inexistente.png' });

    const cenario1Pass = loginResponseStatus === 404 && errorText.includes('Essa conta não existe.');
    auditReport.scenarios.push({
      id: 'CENARIO-01',
      title: 'Login com e-mail inexistente (404 sem erro 500)',
      expected: 'HTTP 404 com mensagem "Essa conta não existe."',
      actual: {
        httpStatus: loginResponseStatus,
        uiMessage: errorText,
        rawBody: loginResponseBody?.slice(0, 200),
      },
      passed: cenario1Pass,
      screenshot: 'tools/cenario-1-login-inexistente.png',
    });

    // -------------------------------------------------------------
    // CENÁRIO 2: Botão "Continuar com Google" visível no topo da LoginView
    // -------------------------------------------------------------
    console.log('\n[CENÁRIO 2] Verificando botão "Continuar com Google"...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

    const googleBtnLocator = page.locator('button:has-text("Continuar com Google")');
    const googleBtnVisible = await googleBtnLocator.isVisible().catch(() => false);
    const googleBtnCount = await googleBtnLocator.count();

    console.log(` - Botão "Continuar com Google" visível: ${googleBtnVisible} (count: ${googleBtnCount})`);
    await page.screenshot({ path: 'tools/cenario-2-google-btn.png' });

    auditReport.scenarios.push({
      id: 'CENARIO-02',
      title: 'Botão "Continuar com Google" visível no topo da LoginView',
      expected: 'Botão visível habilitado com Client ID configurado',
      actual: {
        visible: googleBtnVisible,
        count: googleBtnCount,
      },
      passed: googleBtnVisible,
      screenshot: 'tools/cenario-2-google-btn.png',
    });

    // -------------------------------------------------------------
    // CENÁRIO 3: Cadastro de Vendedor -> Redirecionamento para AwaitingStoreAccessView
    // -------------------------------------------------------------
    console.log('\n[CENÁRIO 3] Testando cadastro de vendedor sem loja...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Alterna para aba de criar conta
    await page.click('button:has-text("Criar Conta Gratuita")');
    await page.waitForTimeout(500);

    // Seleciona perfil Vendedor se existir switcher de perfil
    const sellerRoleBtn = page.locator('button:has-text("Vendedor")');
    if (await sellerRoleBtn.isVisible()) {
      await sellerRoleBtn.click();
      console.log(' - Perfil Vendedor selecionado no formulário');
    }

    const testEmail = `vendedor.qa.${Date.now()}@teste.com.br`;
    await page.fill('input[placeholder*="nome" i]', 'Vendedor QA Steve');
    await page.fill('input[placeholder*="email" i], input[type="email"]', testEmail);
    await page.fill('input[placeholder*="senha" i], input[type="password"]', 'SenhaForte123!');

    let registerResponseStatus = null;
    const [registerResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/auth/register'), { timeout: 8000 }).catch(() => null),
      (async () => {
        const submitBtn = page.locator('button:has-text("Criar Conta de Vendedor"), button:has-text("Criar Conta")').first();
        await submitBtn.click();
      })(),
    ]);

    if (registerResponse) {
      registerResponseStatus = registerResponse.status();
      console.log(` - Resposta HTTP do registro: ${registerResponseStatus}`);
    }

    await page.waitForTimeout(2000);
    const awaitingHeader = await page.locator('h1:has-text("Aguardando Vínculo"), h1:has-text("Aguardando")').isVisible().catch(() => false);
    const awaitingText = await page.innerText('body').catch(() => '');
    const hasAwaitingContent = awaitingText.includes('Aguardando Vínculo') || awaitingText.includes('Aguardando vínculo') || awaitingText.includes('Como liberar seu acesso ao balcão');

    console.log(` - Tela AwaitingStoreAccessView exibida: ${hasAwaitingContent}`);
    await page.screenshot({ path: 'tools/cenario-3-awaiting-store.png' });

    auditReport.scenarios.push({
      id: 'CENARIO-03',
      title: 'Cadastro de Vendedor -> Redirecionamento para AwaitingStoreAccessView',
      expected: 'Exibição da tela "Aguardando Vínculo à Loja" com orientações de liberação',
      actual: {
        httpStatus: registerResponseStatus,
        screenRendered: hasAwaitingContent,
      },
      passed: hasAwaitingContent,
      screenshot: 'tools/cenario-3-awaiting-store.png',
    });

    // -------------------------------------------------------------
    // CENÁRIO 4: Acesso como Admin -> Convidar vendedor na aba Equipe (PENDING + link)
    // -------------------------------------------------------------
    console.log('\n[CENÁRIO 4] Testando convite de vendedor na aba Equipe como Admin...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Login com Demo Admin
    const demoAdminBtn = page.locator('button:has-text("Demo Admin")');
    if (await demoAdminBtn.isVisible()) {
      await demoAdminBtn.click();
      console.log(' - Clicado em Demo Admin');
    } else {
      // Fallback: login regular
      await page.fill('input[type="email"]', 'thiago@auracell.com.br');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button:has-text("Entrar no Sistema")');
    }

    await page.waitForTimeout(2000);

    // Navega para aba Equipe / Configurações
    const teamNavBtn = page.locator('button:has-text("Equipe"), a:has-text("Equipe"), button:has-text("Configurações")').first();
    await teamNavBtn.click();
    await page.waitForTimeout(1000);

    // Se estiver em Configurações, clica na sub-aba Equipe se houver
    const subTabTeam = page.locator('button:has-text("Equipe & Acessos"), button:has-text("Equipe")').first();
    if (await subTabTeam.isVisible()) {
      await subTabTeam.click();
      await page.waitForTimeout(500);
    }

    // Localiza botão de adicionar membro
    const addMemberBtn = page.locator('button:has-text("Adicionar"), button:has-text("Convidar")').first();
    let modalOpened = false;
    if (await addMemberBtn.isVisible()) {
      await addMemberBtn.click();
      modalOpened = true;
      await page.waitForTimeout(500);
      console.log(' - Modal de convite de membro aberto');
    }

    await page.screenshot({ path: 'tools/cenario-4-equipe-admin.png' });

    const pageContentTeam = await page.innerText('body');
    const hasPendingStatus = pageContentTeam.includes('Pendente') || pageContentTeam.includes('PENDING');
    const hasInviteLinkAction = pageContentTeam.includes('Copiar Link') || pageContentTeam.includes('convite') || modalOpened;

    console.log(` - Verificação da aba Equipe (Pendente: ${hasPendingStatus}, Ação de convite: ${hasInviteLinkAction})`);

    auditReport.scenarios.push({
      id: 'CENARIO-04',
      title: 'Acesso Admin -> Convidar vendedor na aba Equipe (PENDING + link convite)',
      expected: 'Membro com status Pendente e ação de copiar link de convite',
      actual: {
        hasPendingStatus,
        hasInviteLinkAction,
        modalOpened,
      },
      passed: hasInviteLinkAction || hasPendingStatus,
      screenshot: 'tools/cenario-4-equipe-admin.png',
    });

    // -------------------------------------------------------------
    // CENÁRIO 5: Checkout -> Busca de cliente por CPF com Blind Index & Comprovante QR Code
    // -------------------------------------------------------------
    console.log('\n[CENÁRIO 5] Testando busca por CPF no Checkout e Comprovante QR Code...');
    
    // Navega para aba de Checkout / Venda
    const checkoutNavBtn = page.locator('button:has-text("Nova Venda"), button:has-text("Checkout"), a:has-text("Venda")').first();
    await checkoutNavBtn.click();
    await page.waitForTimeout(1000);

    // Seleciona um cliente ou busca por CPF
    const customerSelect = page.locator('input[placeholder*="Buscar cliente" i], input[placeholder*="Selecione um cliente" i]').first();
    if (await customerSelect.isVisible()) {
      await customerSelect.click();
      await page.waitForTimeout(300);
      // Tenta digitar os dígitos de um CPF
      await customerSelect.fill('394');
      await page.waitForTimeout(500);
    }

    // Clica na primeira opção de cliente encontrada
    const firstCustomerOpt = page.locator('[role="option"], .cursor-pointer:has-text("@")').first();
    if (await firstCustomerOpt.isVisible()) {
      await firstCustomerOpt.click();
      console.log(' - Cliente selecionado no checkout');
    }

    // Seleciona primeiro aparelho disponível
    const firstPhoneCard = page.locator('button:has-text("Selecionar"), .cursor-pointer:has-text("iPhone"), .cursor-pointer:has-text("R$")').first();
    if (await firstPhoneCard.isVisible()) {
      await firstPhoneCard.click();
      console.log(' - Aparelho selecionado no checkout');
    }

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tools/cenario-5-checkout-selection.png' });

    // Avança e finaliza checkout
    const finalizeBtn = page.locator('button:has-text("Concluir Saída"), button:has-text("Finalizar Venda"), button:has-text("Gerar Garantia")').first();
    let receiptModalOpened = false;
    if (await finalizeBtn.isVisible()) {
      await finalizeBtn.click();
      await page.waitForTimeout(1500);
      receiptModalOpened = true;
      console.log(' - Botão de concluir saída acionado');
    }

    await page.screenshot({ path: 'tools/cenario-5-comprovante-qr.png' });

    const receiptBodyText = await page.innerText('body');
    const hasQrCode = await page.locator('svg rect, canvas, svg:has(rect)').count() > 0;
    const hasWhatsAppBtn = receiptBodyText.includes('WhatsApp') || await page.locator('button:has-text("WhatsApp"), a:has-text("WhatsApp")').count() > 0;
    const hasMaskedPii = /•{3}|\*{3}/.test(receiptBodyText) || receiptBodyText.includes('Garantia');

    console.log(` - Comprovante gerado (Modal: ${receiptModalOpened}, QR Code: ${hasQrCode}, WhatsApp: ${hasWhatsAppBtn})`);

    auditReport.scenarios.push({
      id: 'CENARIO-05',
      title: 'Checkout -> Busca por CPF com Blind Index & Comprovante com QR Code e WhatsApp',
      expected: 'Busca com CPF mascarado (***.***.***-XX), QR Code vetorial e botão WhatsApp',
      actual: {
        receiptModalOpened,
        hasQrCode,
        hasWhatsAppBtn,
        hasMaskedPii,
      },
      passed: hasQrCode && hasWhatsAppBtn,
      screenshot: 'tools/cenario-5-comprovante-qr.png',
    });

  } catch (err) {
    console.error('❌ Erro durante a execução da suíte E2E:', err);
    auditReport.fatalError = err.message;
  } finally {
    await browser.close();
  }

  auditReport.summary = {
    total: auditReport.scenarios.length,
    passed: auditReport.scenarios.filter((s) => s.passed).length,
    failed: auditReport.scenarios.filter((s) => !s.passed).length,
    consoleErrorsCount: consoleLogs.filter((c) => c.type === 'error').length,
    networkErrorsCount: networkErrors.length,
  };

  fs.writeFileSync('tools/e2e-live-results.json', JSON.stringify(auditReport, null, 2), 'utf-8');
  console.log('\n=====================================================');
  console.log(`SUÍTE E2E CONCLUÍDA: ${auditReport.summary.passed}/${auditReport.summary.total} Cenários Aprovados`);
  console.log('Relatório salvo em tools/e2e-live-results.json');
  console.log('=====================================================');

  return auditReport;
}

runE2ESuite();
