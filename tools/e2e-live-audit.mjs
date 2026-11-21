import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TARGET_URL = 'https://opencrm-ashy.vercel.app';

async function run() {
  console.log(`[E2E] Iniciando auditoria E2E ao vivo em: ${TARGET_URL}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
  });

  page.on('pageerror', (err) => {
    console.error('[PAGE ERROR]', err.message);
  });

  const auditReport = {
    targetUrl: TARGET_URL,
    timestamp: new Date().toISOString(),
    results: {}
  };

  // 1. Acesso à página
  console.log(`[PASSO 1] Acessando ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(1500);

  // --- ITEM A: Botão 'Continuar com Google' no topo do login ---
  console.log('[PASSO 2] Verificando Item A: Botão Continuar com Google...');
  const googleBtn = page.locator('button:has-text("Continuar com Google")');
  const googleBtnCount = await googleBtn.count();
  const googleBtnVisible = googleBtnCount > 0 && await googleBtn.isVisible();

  console.log(` - googleBtnCount: ${googleBtnCount}, isVisible: ${googleBtnVisible}`);

  let googleClickTriggered = false;
  if (googleBtnVisible) {
    // Clique de teste para verificar se o handler responde
    try {
      await googleBtn.click();
      await page.waitForTimeout(1000);
      googleClickTriggered = true;
    } catch (err) {
      console.warn('Erro ao clicar no botão Google:', err.message);
    }
  }

  await page.screenshot({ path: 'tools/evidence-a-google-login-btn.png', fullPage: false });
  console.log(' - Screenshot salvo: tools/evidence-a-google-login-btn.png');

  auditReport.results.itemA = {
    test: "O botão 'Continuar com Google' no topo da tela de Login está visível e funcional",
    passed: googleBtnVisible,
    buttonCount: googleBtnCount,
    isVisible: googleBtnVisible,
    clickTriggered: googleClickTriggered,
    screenshot: 'tools/evidence-a-google-login-btn.png'
  };

  // --- ITEM B: Opção 'Outros / Personalizado' no seletor de segmento ---
  console.log('[PASSO 3] Verificando Item B: Aba Criar Conta Gratuita e opção Outros / Personalizado...');
  const createAccountTab = page.getByRole('button', { name: 'Criar Conta Gratuita', exact: true });
  await createAccountTab.click();
  await page.waitForTimeout(800);

  // Garantir que perfil Administrador está selecionado
  const adminRoleBtn = page.locator('button:has-text("Administrador")').first();
  if (await adminRoleBtn.isVisible()) {
    await adminRoleBtn.click();
    await page.waitForTimeout(400);
  }

  const segmentSelect = page.locator('select#reg-segment');
  const selectVisible = await segmentSelect.isVisible();

  // Listar todas as opções disponíveis no select
  const options = await segmentSelect.locator('option').allInnerTexts();
  console.log(' - Opções no seletor de segmento:', options);

  const hasOutrosOption = options.some(opt => opt.includes('Outros / Personalizado') || opt.includes('Personalizado'));
  console.log(` - Opção 'Outros / Personalizado' presente: ${hasOutrosOption}`);

  if (hasOutrosOption) {
    // Selecionar a opção
    const matchingOption = options.find(opt => opt.includes('Outros / Personalizado') || opt.includes('Personalizado'));
    await segmentSelect.selectOption({ label: matchingOption });
    await page.waitForTimeout(400);
  }

  await page.screenshot({ path: 'tools/evidence-b-outros-personalizado-option.png', fullPage: false });
  console.log(' - Screenshot salvo: tools/evidence-b-outros-personalizado-option.png');

  auditReport.results.itemB = {
    test: "Na aba 'Criar Conta Gratuita' (Administrador), a opção 'Outros / Personalizado' está presente no seletor de segmento",
    passed: hasOutrosOption && selectVisible,
    selectVisible,
    optionsFound: options,
    hasOutrosOption,
    screenshot: 'tools/evidence-b-outros-personalizado-option.png'
  };

  // --- ITEM C: Fluxo de cadastro abre automaticamente modal 'Criar Nova Loja / Segmento' com nome pré-preenchido ---
  console.log('[PASSO 4] Verificando Item C: Fluxo de cadastro com Outros / Personalizado...');
  const testStoreName = 'Aurora Joias & Design';
  const testEmail = `helena.moreira.${Date.now()}@lojaaurora.com.br`;

  await page.fill('input#reg-name', 'Helena Moreira');
  await page.fill('input#reg-email', testEmail);
  await page.fill('input#reg-password', 'senhaMestra123');
  await page.fill('input#reg-store-name', testStoreName);

  // Garantir que segmento está em Outros / Personalizado
  const matchingOption = options.find(opt => opt.includes('Outros / Personalizado') || opt.includes('Personalizado'));
  if (matchingOption) {
    await segmentSelect.selectOption({ label: matchingOption });
  }

  await page.waitForTimeout(500);

  // Submeter formulário
  const submitBtn = page.locator('button:has-text("Criar Minha Loja & Entrar")');
  console.log(' - Clicando em Criar Minha Loja & Entrar...');
  await submitBtn.click();

  // Aguardar abertura do modal 'Criar Nova Loja / Segmento'
  console.log(' - Aguardando modal Criar Nova Loja / Segmento...');
  const modalHeader = page.locator('h2:has-text("Criar Nova Loja / Segmento")');
  await modalHeader.waitFor({ state: 'visible', timeout: 15000 });

  const isModalVisible = await modalHeader.isVisible();
  console.log(` - Modal 'Criar Nova Loja / Segmento' visível: ${isModalVisible}`);

  // Verificar se o campo de nome da loja no wizard está pré-preenchido
  const wizardStoreNameInput = page.locator('input#wizard-store-name');
  await wizardStoreNameInput.waitFor({ state: 'visible', timeout: 5000 });
  const prefilledValue = await wizardStoreNameInput.inputValue();
  console.log(` - Valor pré-preenchido no input #wizard-store-name: "${prefilledValue}" (Esperado: "${testStoreName}")`);

  const isPrefilledCorrectly = prefilledValue === testStoreName;

  await page.screenshot({ path: 'tools/evidence-c-store-wizard-modal-prefilled.png', fullPage: false });
  console.log(' - Screenshot salvo: tools/evidence-c-store-wizard-modal-prefilled.png');

  auditReport.results.itemC = {
    test: "O fluxo de cadastro com a opção 'Outros / Personalizado' abre automaticamente o modal 'Criar Nova Loja / Segmento' com o nome da loja pré-preenchido",
    passed: isModalVisible && isPrefilledCorrectly,
    isModalVisible,
    expectedStoreName: testStoreName,
    actualStoreName: prefilledValue,
    isPrefilledCorrectly,
    screenshot: 'tools/evidence-c-store-wizard-modal-prefilled.png'
  };

  // Copiar screenshots para docs/screenshots/ se a pasta existir
  const docsScreenshotsDir = path.resolve('docs', 'screenshots');
  if (fs.existsSync(docsScreenshotsDir)) {
    fs.copyFileSync('tools/evidence-a-google-login-btn.png', path.join(docsScreenshotsDir, 'evidence-a-google-login-btn.png'));
    fs.copyFileSync('tools/evidence-b-outros-personalizado-option.png', path.join(docsScreenshotsDir, 'evidence-b-outros-personalizado-option.png'));
    fs.copyFileSync('tools/evidence-c-store-wizard-modal-prefilled.png', path.join(docsScreenshotsDir, 'evidence-c-store-wizard-modal-prefilled.png'));
    console.log(' - Evidências espelhadas em docs/screenshots/');
  }

  // Gravar relatório em JSON
  fs.writeFileSync('tools/e2e-live-audit-report.json', JSON.stringify(auditReport, null, 2), 'utf-8');

  console.log('\n=== RESULTADO FINAL DA AUDITORIA ===');
  console.log(`Item A (Botão Google): ${auditReport.results.itemA.passed ? 'APROVADO (PASS)' : 'FALHA (FAIL)'}`);
  console.log(`Item B (Opção Outros / Personalizado): ${auditReport.results.itemB.passed ? 'APROVADO (PASS)' : 'FALHA (FAIL)'}`);
  console.log(`Item C (Modal com nome pré-preenchido): ${auditReport.results.itemC.passed ? 'APROVADO (PASS)' : 'FALHA (FAIL)'}`);

  await browser.close();
}

run().catch((err) => {
  console.error('[ERRO FATAL NA AUDITORIA]', err);
  process.exit(1);
});
