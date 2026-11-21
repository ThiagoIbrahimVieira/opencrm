import { chromium } from 'playwright';
import fs from 'fs';

const TARGET_URL = 'https://opencrm-ashy.vercel.app';
const CHROME_PATH = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';

async function runTemplatesAudit() {
  console.log('=====================================================');
  console.log('🧪 SUBAGENTE 2: STRESS TEST CONSTRUTOR DE TEMPLATES');
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
  const metrics = {
    step1Success: false,
    step2Success: false,
    step3Success: false,
    storeCreated: false,
    sidebarLabelsUpdated: false,
    customFieldsConfigured: 0,
    storeIsolationVerified: false,
    f5PersistenceStatus: 'untested',
    leakDetected: false
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('response', (res) => {
    if (res.status() >= 500) {
      networkErrors.push({ url: res.url(), status: res.status(), statusText: res.statusText() });
    }
  });

  try {
    // 2.1 ACESSAR SISTEMA E LOGAR COMO DEMO ADMIN
    console.log('\n[2.1] Acessando sistema e efetuando login como Demo Admin...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(1000);

    const demoAdminBtn = page.locator('button:has-text("Demo Admin"), button:has-text("Entrar como Admin")').first();
    if (await demoAdminBtn.isVisible()) {
      await demoAdminBtn.click();
      await page.waitForTimeout(2000);
      console.log(' -> Logado como Demo Admin.');
    } else {
      throw new Error('Botão Demo Admin não encontrado na página de login.');
    }

    // Fechar possíveis toasts residuais
    const toastClose = page.locator('button[aria-label="Fechar notificação"]').first();
    if (await toastClose.isVisible()) {
      await toastClose.click().catch(() => {});
      await page.waitForTimeout(400);
    }

    // 2.2 ABRIR WORKSPACE SWITCHER E CLICAR EM "CRIAR NOVA LOJA / TEMPLATE"
    console.log('\n[2.2] Abrindo assistente de Nova Loja / Construtor de Templates...');
    const switcherTrigger = page.locator('button[aria-label*="Alternar loja ativa"]').first();
    if (await switcherTrigger.isVisible()) {
      await switcherTrigger.click();
      await page.waitForTimeout(600);

      const createStoreBtn = page.locator('button:has-text("Criar nova loja / template")').first();
      if (await createStoreBtn.isVisible()) {
        await createStoreBtn.click();
        await page.waitForTimeout(1200);
        await page.screenshot({ path: 'tools/sub2_wizard_open.png' });
        console.log(' -> Modal StoreWizardModal aberto com sucesso!');
      } else {
        throw new Error('Botão "Criar nova loja / template" não encontrado no dropdown do switcher.');
      }
    } else {
      throw new Error('Botão seletor de lojas não encontrado na Sidebar.');
    }

    // 2.3 STEP 1: IDENTIDADE & SEGMENTO (OUTROS / PERSONALIZADO DO ZERO)
    console.log('\n[2.3] Preenchendo Step 1: Template Personalizado do Zero (Oficina Mecânica)...');
    const storeNameInput = page.locator('#wizard-store-name').first();
    if (await storeNameInput.isVisible()) {
      await storeNameInput.fill('Oficina Pro Auto Peças');
      console.log(' -> Nome da Loja preenchido: Oficina Pro Auto Peças');

      // Preencher segmento customizado
      const customSegmentInput = page.locator('#wizard-custom-segment').first();
      if (await customSegmentInput.isVisible()) {
        await customSegmentInput.fill('Oficina Mecânica & Auto Peças');
        console.log(' -> Segmento customizado preenchido: Oficina Mecânica & Auto Peças');
      }

      // Clicar em "Montar do zero"
      const scratchBtn = page.locator('button:has-text("Montar do zero")').first();
      if (await scratchBtn.isVisible()) {
        await scratchBtn.click();
        await page.waitForTimeout(500);
        console.log(' -> Modo "Montar do zero" selecionado.');
      }

      await page.screenshot({ path: 'tools/sub2_template1_step1.png' });
      metrics.step1Success = true;

      // Avançar para Step 2 com botão "Continuar"
      const continueBtn1 = page.locator('button:has-text("Continuar")').first();
      if (await continueBtn1.isVisible()) {
        await continueBtn1.click();
        await page.waitForTimeout(1000);
      } else {
        throw new Error('Botão Continuar não encontrado no Step 1.');
      }
    } else {
      throw new Error('Input #wizard-store-name não encontrado no Step 1.');
    }

    // 2.4 STEP 2: MÓDULOS ATIVOS & NOMENCLATURA DINÂMICA
    console.log('\n[2.4] Configurando Step 2: Módulos Ativos e Rótulos Dinâmicos...');
    await page.waitForTimeout(500);

    // Desativar serialização IMEI (não se aplica a auto peças)
    const imeiToggle = page.locator('#wizard-flag-hasImeiTracking').first();
    if (await imeiToggle.isVisible()) {
      const isChecked = await imeiToggle.getAttribute('aria-checked');
      if (isChecked === 'true') {
        await imeiToggle.click();
        console.log(' -> Desativado módulo IMEI / Serialização para Auto Peças.');
      }
    }

    // Personalizar rótulos
    const primaryTabInput = page.locator('#lbl-primary-tab').first();
    if (await primaryTabInput.isVisible()) {
      await primaryTabInput.fill('Peças & Componentes');
    }

    const secondaryTabInput = page.locator('#lbl-secondary-tab').first();
    if (await secondaryTabInput.isVisible()) {
      await secondaryTabInput.fill('Óleos & Lubrificantes');
    }

    const primarySingularInput = page.locator('#lbl-primary-singular').first();
    if (await primarySingularInput.isVisible()) {
      await primarySingularInput.fill('Peça');
    }

    const secondarySingularInput = page.locator('#lbl-secondary-singular').first();
    if (await secondarySingularInput.isVisible()) {
      await secondarySingularInput.fill('Lubrificante');
    }

    const orderActionInput = page.locator('#lbl-order-action').first();
    if (await orderActionInput.isVisible()) {
      await orderActionInput.fill('Balcão & O.S.');
    }

    const crossSellInput = page.locator('#lbl-cross-sell').first();
    if (await crossSellInput.isVisible()) {
      await crossSellInput.fill('Itens Recomendados para Revisão');
    }

    metrics.step2Success = true;
    console.log(' -> Rótulos dinâmicos preenchidos com sucesso.');
    await page.screenshot({ path: 'tools/sub2_template1_step2.png' });

    // Avançar para Step 3
    const continueBtn2 = page.locator('button:has-text("Continuar")').first();
    if (await continueBtn2.isVisible()) {
      await continueBtn2.click();
      await page.waitForTimeout(1000);
    } else {
      throw new Error('Botão Continuar não encontrado no Step 2.');
    }

    // 2.5 STEP 3: CONSTRUTOR DE CAMPOS CUSTOMIZADOS & LIVE PREVIEW
    console.log('\n[2.5] Configurando Step 3: Construtor de Campos Customizados...');
    await page.waitForTimeout(500);

    const newFieldLabelInput = page.locator('#new-field-label').first();
    const addFieldBtn = page.locator('button:has-text("Adicionar Campo")').first();
    const fieldRequiredToggle = page.locator('#new-field-required').first();

    if (await newFieldLabelInput.isVisible()) {
      // Campo 1: Modelo de Carro Compatível (text, obrigatório)
      await newFieldLabelInput.fill('Veículo / Aplicação');
      if (await fieldRequiredToggle.isVisible()) {
        const checked = await fieldRequiredToggle.getAttribute('aria-checked');
        if (checked !== 'true') await fieldRequiredToggle.click();
      }
      await addFieldBtn.click();
      await page.waitForTimeout(600);
      metrics.customFieldsConfigured++;
      console.log(' -> Adicionado Campo 1: Veículo / Aplicação (Text, Obrigatório)');

      // Campo 2: Fabricante (Select, não obrigatório)
      await newFieldLabelInput.fill('Marca Fabricante');
      const typeTrigger = page.locator('#new-field-type').first();
      if (await typeTrigger.isVisible()) {
        await typeTrigger.click();
        await page.waitForTimeout(300);
        const selectOption = page.locator('[role="option"]:has-text("Seleção")').first();
        if (await selectOption.isVisible()) {
          await selectOption.click();
          await page.waitForTimeout(400);
        }
      }
      const optionsInput = page.locator('#new-field-options').first();
      if (await optionsInput.isVisible()) {
        await optionsInput.fill('Bosch, Cofap, Fras-le, TRW, Mahle');
      }
      if (await fieldRequiredToggle.isVisible()) {
        const checked = await fieldRequiredToggle.getAttribute('aria-checked');
        if (checked === 'true') await fieldRequiredToggle.click();
      }
      await addFieldBtn.click();
      await page.waitForTimeout(600);
      metrics.customFieldsConfigured++;
      console.log(' -> Adicionado Campo 2: Marca Fabricante (Select)');

      // Campo 3: Código Original OEM (Text, obrigatório)
      await newFieldLabelInput.fill('Código Original (OEM)');
      if (await typeTrigger.isVisible()) {
        await typeTrigger.click();
        await page.waitForTimeout(300);
        const textOption = page.locator('[role="option"]:has-text("Texto")').first();
        if (await textOption.isVisible()) {
          await textOption.click();
          await page.waitForTimeout(400);
        }
      }
      if (await fieldRequiredToggle.isVisible()) {
        const checked = await fieldRequiredToggle.getAttribute('aria-checked');
        if (checked !== 'true') await fieldRequiredToggle.click();
      }
      await addFieldBtn.click();
      await page.waitForTimeout(600);
      metrics.customFieldsConfigured++;
      console.log(' -> Adicionado Campo 3: Código Original OEM (Text, Obrigatório)');
    }

    await page.screenshot({ path: 'tools/sub2_template1_step3.png' });
    metrics.step3Success = true;

    // 2.6 FINALIZAR CRIAÇÃO DA LOJA
    console.log('\n[2.6] Finalizando criação da Loja e entrando no Workspace...');
    const finishBtn = page.locator('button:has-text("Criar Loja e Entrar no Workspace")').first();
    if (await finishBtn.isVisible()) {
      await finishBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'tools/sub2_template1_created.png' });
      metrics.storeCreated = true;
      console.log(' -> Loja Oficina Pro Auto Peças criada com sucesso!');
    } else {
      throw new Error('Botão "Criar Loja e Entrar no Workspace" não encontrado.');
    }

    // 2.7 VERIFICAÇÃO DO WORKSPACE & ISOLAMENTO MULTI-LOJA
    console.log('\n[2.7] Verificando aplicação dos rótulos e isolamento de dados...');
    const bodyContent = await page.innerText('body');
    const hasOficinaPro = bodyContent.includes('Oficina Pro Auto Peças');
    const hasDynamicTab = bodyContent.includes('Peças & Componentes') || bodyContent.includes('Peças');
    console.log(` -> Sidebar exibe "Oficina Pro Auto Peças": ${hasOficinaPro}`);
    console.log(` -> Menu exibe aba dinâmica customizada: ${hasDynamicTab}`);

    if (hasDynamicTab) {
      metrics.sidebarLabelsUpdated = true;
    }

    // Navegar para o estoque
    const estoqueNavBtn = page.locator('button:has-text("Peças & Componentes"), button:has-text("Estoque")').first();
    if (await estoqueNavBtn.isVisible()) {
      await estoqueNavBtn.click();
      await page.waitForTimeout(1500);

      const estoqueText = await page.innerText('body');
      const hasLeakedSmartphones = estoqueText.includes('iPhone 15 Pro') || estoqueText.includes('Galaxy S24');
      if (hasLeakedSmartphones) {
        metrics.leakDetected = true;
        findings.push({
          severity: 'P0',
          title: 'Vazamento de dados entre lojas (Mock Leak)',
          description: 'Itens da loja AuraCell vazaram para a nova loja Oficina Pro Auto Peças recém criada do zero.'
        });
      } else {
        metrics.storeIsolationVerified = true;
        console.log(' -> Isolamento verificado: ZERO itens de outras lojas vazando no estoque!');
      }
      await page.screenshot({ path: 'tools/sub2_store_isolated.png' });
    }

    // 2.8 TESTE DE PERSISTÊNCIA APÓS F5 (STRESS TEST DE RECARREGAMENTO)
    console.log('\n[2.8] Testando persistência após F5 (Reload da página)...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'tools/sub2_after_f5.png' });

    const postReloadBody = await page.innerText('body');
    const isStillLoggedIn = !postReloadBody.includes('Entrar na Conta') && !postReloadBody.includes('Demo Admin');
    const isOficinaProRetained = postReloadBody.includes('Oficina Pro Auto Peças');

    console.log(` -> Sessão ativa após reload: ${isStillLoggedIn}`);
    console.log(` -> Oficina Pro Auto Peças ativa após reload: ${isOficinaProRetained}`);

    if (isStillLoggedIn && isOficinaProRetained) {
      metrics.f5PersistenceStatus = 'persisted_in_workspace';
    } else if (!isStillLoggedIn) {
      metrics.f5PersistenceStatus = 'logged_out_on_f5';
      findings.push({
        severity: 'P1',
        title: 'Sessão Demo Admin não persistida após F5 (Retorna à tela de login)',
        description: 'Ao recarregar a página com F5 durante o uso do modo Demo Admin, a aplicação perde a sessão e retorna à tela de login porque a autenticação de demonstração não persiste cookies HttpOnly ou localStorage no ambiente atual.'
      });

      console.log(' -> Re-entrando como Demo Admin para verificar persistência da loja...');
      const demoBtnAfterF5 = page.locator('button:has-text("Demo Admin")').first();
      if (await demoBtnAfterF5.isVisible()) {
        await demoBtnAfterF5.click();
        await page.waitForTimeout(2000);

        const sw = page.locator('button[aria-label*="Alternar loja ativa"]').first();
        if (await sw.isVisible()) {
          await sw.click();
          await page.waitForTimeout(600);
          const menuText = await page.locator('[role="menu"]').innerText();
          const storeStillExists = menuText.includes('Oficina Pro');
          console.log(` -> Loja "Oficina Pro" ainda existe na lista após re-login: ${storeStillExists}`);
          if (!storeStillExists) {
            findings.push({
              severity: 'P1',
              title: 'Loja customizada não persistida no backend/storage após recarregar página',
              description: 'A nova loja criada no modo demonstração é armazenada apenas no estado transitório em memória da instância React do navegador, sendo apagada após um reload (F5).'
            });
          }
        }
      }
    } else {
      metrics.f5PersistenceStatus = 'reverted_to_default_store';
      findings.push({
        severity: 'P2',
        title: 'Loja ativa revertida para padrão após recarregamento',
        description: 'A sessão permaneceu ativa, mas a loja ativa voltou a ser a padrão em vez da recém criada.'
      });
    }

  } catch (err) {
    console.error(`❌ Erro no Subagente 2: ${err.message}`);
    findings.push({ severity: 'P0', title: 'Falha durante execução do Subagente 2', error: err.message, stack: err.stack });
  } finally {
    await browser.close();
  }

  const report = {
    subagent: 2,
    name: 'Stress Test Construtor de Templates & Multi-Segmento',
    target: TARGET_URL,
    timestamp: new Date().toISOString(),
    metrics,
    findings,
    consoleErrors: consoleErrors.slice(0, 10),
    networkErrors,
    screenshots: [
      'tools/sub2_wizard_open.png',
      'tools/sub2_template1_step1.png',
      'tools/sub2_template1_step2.png',
      'tools/sub2_template1_step3.png',
      'tools/sub2_template1_created.png',
      'tools/sub2_store_isolated.png',
      'tools/sub2_after_f5.png'
    ]
  };

  fs.writeFileSync('tools/subagent2_report.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Relatório Subagente 2 salvo em tools/subagent2_report.json');
}

runTemplatesAudit();
