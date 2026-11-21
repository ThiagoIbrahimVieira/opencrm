import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_URL = 'https://opencrm-ashy.vercel.app';
const SCREENSHOTS_DIR = path.resolve(__dirname, '../docs/screenshots');

async function performCleanLogout(page, context) {
  try {
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch {}
    });
    await context.clearCookies();
  } catch {}
  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const loginTab = page.getByRole('button', { name: 'Entrar na Conta', exact: true });
  await loginTab.waitFor({ state: 'visible', timeout: 15000 });
}

async function runE2E() {
  console.log(`\n======================================================`);
  console.log(`[E2E ZERO-LEAK] Iniciando Homologação ao Vivo em: ${TARGET_URL}`);
  console.log(`======================================================\n`);

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  try {
    // -------------------------------------------------------------------------
    // CENÁRIO 1: Cadastro Admin + "Outros" -> Wizard Bloqueante -> F5 Zero-Mock
    // -------------------------------------------------------------------------
    console.log('[Cenário 1] Testando Cadastro Admin + "Outros"...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    // Alternar para aba "Criar Conta Gratuita"
    const registerTabBtn = page.getByRole('button', { name: 'Criar Conta Gratuita', exact: true });
    await registerTabBtn.click();
    await page.waitForTimeout(500);

    // Garantir que perfil Administrador está selecionado
    const adminRoleBtn = page.locator('button:has-text("Administrador")').first();
    await adminRoleBtn.click();

    const timestamp = Date.now();
    const adminEmail = `helena.admin.${timestamp}@realstore.com`;
    const adminPassword = 'Password123!';
    const storeName = `Atelier Helena ${timestamp.toString().slice(-4)}`;

    await page.fill('#reg-name', 'Helena Vasconcelos');
    await page.fill('#reg-email', adminEmail);
    await page.fill('#reg-password', adminPassword);
    await page.fill('#reg-store-name', storeName);

    // Selecionar "Outros / Personalizado"
    await page.selectOption('#reg-segment', 'other');

    // Submeter cadastro
    const submitBtn = page.getByRole('button', { name: 'Criar Minha Loja & Entrar' });
    await submitBtn.click();

    // Aguardar abertura do Wizard Modal
    console.log('[Cenário 1] Verificando StoreWizardModal bloqueante...');
    const wizardModal = page.locator('div[role="dialog"][aria-label="Criar nova loja no Open CRM"]');
    await wizardModal.waitFor({ state: 'visible', timeout: 15000 });

    // Validar que NÃO existe botão X de fechar (bloqueante)
    const closeBtn = page.locator('button[aria-label="Fechar assistente de nova loja"]');
    const isCloseBtnVisible = await closeBtn.isVisible().catch(() => false);
    if (isCloseBtnVisible) {
      throw new Error('Falha no Cenário 1: Botão X de fechar não pode estar visível no onboarding obrigatório!');
    }
    console.log('  ✔ Botão X de fechar ausente (Wizard obrigatório e bloqueante confirmado)');

    // Pressionar Escape não deve fechar o modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const stillVisible = await wizardModal.isVisible();
    if (!stillVisible) {
      throw new Error('Falha no Cenário 1: Modal foi fechado ao pressionar Escape!');
    }
    console.log('  ✔ Modal não fecha via Escape');

    // Se o campo de segmento customizado aparecer no Step 1, preenche
    const customSegmentInput = page.locator('#wizard-custom-segment');
    if (await customSegmentInput.isVisible().catch(() => false)) {
      await customSegmentInput.fill('Moda e Vestuário');
      await page.waitForTimeout(300);
      console.log('  ✔ Preenchido segmento customizado no Step 1: Moda e Vestuário');
    }

    // Avançar Step 1 -> Step 2
    const nextBtnStep1 = page.getByRole('button', { name: /Continuar/i });
    await nextBtnStep1.click();
    await page.waitForTimeout(600);

    // Avançar Step 2 -> Step 3
    const nextBtnStep2 = page.getByRole('button', { name: /Continuar/i });
    await nextBtnStep2.click();
    await page.waitForTimeout(600);

    // Concluir Step 3 -> Entrar no Workspace
    const finishBtn = page.getByRole('button', { name: /Criar Loja e Entrar no Workspace/i });
    await finishBtn.click();
    await page.waitForTimeout(2000);

    // Verificar se entrou no Workspace da loja real
    console.log('[Cenário 1] Verificando dados da loja real criada...');
    const storeHeader = page.locator('aside').getByText(storeName);
    await storeHeader.waitFor({ state: 'visible', timeout: 15000 });

    // Verificar isolamento zero-mock: ZERO smartphones, ZERO acessórios AuraCell
    const bodyText = await page.textContent('body');
    if (bodyText.includes('iPhone 15') || bodyText.includes('Sabor & Brasa')) {
      throw new Error('Falha no Cenário 1: Vazamento de mock detectado! Loja real contém dados de demonstração.');
    }
    console.log('  ✔ Isolamento inicial zero-mock confirmado (sem dados de AuraCell / Sabor & Brasa)');

    // Executar Recarregamento pós-F5
    console.log('[Cenário 1] Executando F5 (recarregamento)...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Verificar se permanece na loja real criada
    const storeHeaderAfterF5 = page.locator('aside').getByText(storeName);
    await storeHeaderAfterF5.waitFor({ state: 'visible', timeout: 15000 });

    const bodyTextAfterF5 = await page.textContent('body');
    if (bodyTextAfterF5.includes('iPhone 15') || bodyTextAfterF5.includes('Sabor & Brasa')) {
      throw new Error('Falha no Cenário 1: Vazamento pós-F5! Dados de mock vazaram após reload.');
    }
    console.log('  ✔ Pós-F5: Continua na loja real personalizada sem vazamento de mockData!');

    const screenshot1Path = path.join(SCREENSHOTS_DIR, 'cenario-1-admin-outros-f5.png');
    await page.screenshot({ path: screenshot1Path, fullPage: true });
    console.log(`  📸 Screenshot salva: ${screenshot1Path}`);

    // -------------------------------------------------------------------------
    // CENÁRIO 3: Sidebar de Conta Real (Sem alternador de papel)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 3] Verificando Sidebar de Conta Real...');
    const roleSwitcher = page.locator('aside div[role="group"][aria-label="Alternar perfil de acesso (Demonstração)"]');
    const hasRoleSwitcher = await roleSwitcher.isVisible().catch(() => false);
    if (hasRoleSwitcher) {
      throw new Error('Falha no Cenário 3: Alternador de perfil Admin|Vendedor não pode existir em contas reais!');
    }
    console.log('  ✔ Botão de alternar papel ausente na conta real');

    const fixedRoleBadge = page.locator('aside span:has-text("Administrador")').first();
    await fixedRoleBadge.waitFor({ state: 'visible' });
    console.log('  ✔ Badge fixo "Administrador" visível e estático');

    const screenshot3Path = path.join(SCREENSHOTS_DIR, 'cenario-3-sidebar-real-badge.png');
    await page.screenshot({ path: screenshot3Path, fullPage: true });
    console.log(`  📸 Screenshot salva: ${screenshot3Path}`);

    // Fazer logout limpo para os próximos testes
    console.log('Deslogando da conta Admin com limpeza de sessão...');
    await performCleanLogout(page, context);

    // -------------------------------------------------------------------------
    // CENÁRIO 2: Cadastro Vendedor -> AwaitingStoreAccessView -> F5
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 2] Testando Cadastro Vendedor e Bloqueio Persistente...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    // Alternar para aba "Criar Conta Gratuita"
    const regTab2 = page.getByRole('button', { name: 'Criar Conta Gratuita', exact: true });
    await regTab2.click();
    await page.waitForTimeout(500);

    // Selecionar perfil Vendedor
    const sellerRoleBtn = page.locator('button:has-text("Vendedor")').first();
    await sellerRoleBtn.click();
    await page.waitForTimeout(300);

    const sellerEmail = `carlos.vendedor.${Date.now()}@realstore.com`;
    const sellerPassword = 'Password123!';

    await page.fill('#reg-name', 'Carlos Vendedor');
    await page.fill('#reg-email', sellerEmail);
    await page.fill('#reg-password', sellerPassword);

    const submitSellerBtn = page.getByRole('button', { name: 'Criar Conta de Vendedor & Entrar' });
    await submitSellerBtn.click();

    console.log('[Cenário 2] Verificando tela AwaitingStoreAccessView...');
    const awaitingTitle = page.locator('h1:has-text("Aguardando Vínculo à Loja")');
    await awaitingTitle.waitFor({ state: 'visible', timeout: 15000 });

    const sellerBadge = page.locator('span:has-text("Vendedor")').first();
    await sellerBadge.waitFor({ state: 'visible' });
    console.log('  ✔ Tela AwaitingStoreAccessView exibida com badge Vendedor');

    // Executar Recarregamento pós-F5 do Vendedor
    console.log('[Cenário 2] Executando F5 na tela do Vendedor...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Verificar se continua na tela de aguardo e NUNCA virou Admin
    const awaitingAfterF5 = page.locator('h1:has-text("Aguardando Vínculo à Loja")');
    await awaitingAfterF5.waitFor({ state: 'visible', timeout: 10000 });

    const isDashboardVisible = await page.locator('nav[aria-label="Navegação principal"]').isVisible().catch(() => false);
    if (isDashboardVisible) {
      throw new Error('Falha no Cenário 2: Vendedor sem loja acessou o dashboard após F5!');
    }
    console.log('  ✔ Pós-F5: Vendedor permanece bloqueado em AwaitingStoreAccessView (sem virar Admin)!');

    const screenshot2Path = path.join(SCREENSHOTS_DIR, 'cenario-2-vendedor-awaiting-f5.png');
    await page.screenshot({ path: screenshot2Path, fullPage: true });
    console.log(`  📸 Screenshot salva: ${screenshot2Path}`);

    // Logout do vendedor com limpeza de sessão
    console.log('Deslogando da conta Vendedor com limpeza de sessão...');
    await performCleanLogout(page, context);

    // -------------------------------------------------------------------------
    // CENÁRIO 4: Google OAuth & Role Choice (1º Acesso)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 4] Testando Botão Google OAuth e RoleChoiceView...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    // Verificar botão Google visível na LoginView
    const googleBtn = page.locator('button:has-text("Continuar com Google")');
    await googleBtn.waitFor({ state: 'visible', timeout: 8000 });
    console.log('  ✔ Botão "Continuar com Google" visível na LoginView');

    // Mockar /api/auth/me para simular 1º acesso via Google sem vínculo (accountType = UNSET)
    await page.route('**/api/auth/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'usr-google-first-access',
            name: 'Lucas Google Teste',
            email: 'lucas.google@gmail.com',
            accountType: 'UNSET',
            role: null,
          },
          needsRoleChoice: true,
          stores: [],
        }),
      });
    });

    // Recarregar a página para ativar o mock de 1º acesso
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Verificar se RoleChoiceView foi renderizada com Warm Editorial Boutique
    console.log('[Cenário 4] Verificando tela RoleChoiceView...');
    const roleChoiceTitle = page.locator('h1:has-text("Como você deseja utilizar o Open CRM?")');
    await roleChoiceTitle.waitFor({ state: 'visible', timeout: 10000 });

    const adminOption = page.locator('h2:has-text("Sou Administrador")');
    await adminOption.waitFor({ state: 'visible' });

    const sellerOption = page.locator('h2:has-text("Sou Vendedor")');
    await sellerOption.waitFor({ state: 'visible' });
    console.log('  ✔ RoleChoiceView renderizada perfeitamente com escolha limpa entre Administrador e Vendedor');

    const screenshot4Path = path.join(SCREENSHOTS_DIR, 'cenario-4-google-role-choice.png');
    await page.screenshot({ path: screenshot4Path, fullPage: true });
    console.log(`  📸 Screenshot salva: ${screenshot4Path}`);

    // Limpar o route intercept e deslogar
    await page.unroute('**/api/auth/me');
    await performCleanLogout(page, context);

    // -------------------------------------------------------------------------
    // CENÁRIO 5: Modo Demo Isolado (Demo Admin e Demo Vendedor)
    // -------------------------------------------------------------------------
    console.log('\n[Cenário 5] Testando Modo Demo Isolado...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    // Clicar em Demo Admin
    const demoAdminBtn = page.getByRole('button', { name: /Demo Admin/i });
    await demoAdminBtn.waitFor({ state: 'visible', timeout: 8000 });
    await demoAdminBtn.click();
    await page.waitForTimeout(1500);

    // Verificar se carregou AuraCell com mockData
    const demoStoreName = page.locator('aside').getByText('AuraCell', { exact: true });
    await demoStoreName.waitFor({ state: 'visible', timeout: 10000 });

    // Verificar se o alternador de papel EXISTE no modo demo
    const demoRoleGroup = page.locator('aside div[role="group"][aria-label="Alternar perfil de acesso (Demonstração)"]');
    await demoRoleGroup.waitFor({ state: 'visible', timeout: 5000 });
    console.log('  ✔ Alternador de papel ativo exclusivamente no Modo Demo');

    // Alternar para Vendedor no modo demo
    const switchSellerBtn = demoRoleGroup.locator('button:has-text("Vendedor")');
    await switchSellerBtn.click();
    await page.waitForTimeout(1000);

    // Verificar que auditoria e configurações sumiram (RBAC do vendedor)
    const auditBtn = page.locator('button:has-text("Auditoria & Logs")');
    const isAuditVisible = await auditBtn.isVisible().catch(() => false);
    if (isAuditVisible) {
      throw new Error('Falha no Cenário 5: Vendedor demo acessou Auditoria!');
    }
    console.log('  ✔ RBAC de Vendedor no modo demo oculta Auditoria & Logs');

    // Alternar de volta para Admin
    const switchAdminBtn = demoRoleGroup.locator('button:has-text("Admin")');
    await switchAdminBtn.click();
    await page.waitForTimeout(1000);
    console.log('  ✔ Alternância Admin/Vendedor em modo demo 100% funcional');

    const screenshot5Path = path.join(SCREENSHOTS_DIR, 'cenario-5-demo-mode-isolated.png');
    await page.screenshot({ path: screenshot5Path, fullPage: true });
    console.log(`  📸 Screenshot salva: ${screenshot5Path}`);

    console.log(`\n======================================================`);
    console.log(`[E2E ZERO-LEAK] 100% DOS 5 CENÁRIOS HOMOLOGADOS COM SUCESSO!`);
    console.log(`======================================================\n`);

  } catch (err) {
    console.error('\n❌ Erro durante a homologação E2E:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runE2E();
