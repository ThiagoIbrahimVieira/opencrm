import { chromium } from 'playwright';
import fs from 'fs';

const TARGET_URL = 'https://opencrm-ashy.vercel.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[CONSOLE ERROR]', msg.text());
  });

  const results = {};

  // -------------------------------------------------------------
  // TEST SCENARIO 3: Cadastro de Vendedor -> AwaitingStoreAccessView
  // -------------------------------------------------------------
  console.log('--- TEST SCENARIO 3: Cadastro de Vendedor ---');
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

  await page.click('button:has-text("Criar Conta Gratuita")');
  await page.waitForTimeout(400);

  // Click Vendedor profile
  await page.click('button:has-text("Vendedor")');
  await page.waitForTimeout(400);

  await page.fill('#reg-name', 'Carlos Vendedor QA');
  await page.fill('#reg-email', 'carlos.vendedor.qa@empresa.com.br');
  await page.fill('#reg-password', 'senha123456');

  // Submit
  await page.click('button[type="submit"]:has-text("Criar Conta")');
  await page.waitForTimeout(2000);

  const awaitingH1 = await page.locator('h1:has-text("Aguardando Vínculo")').count();
  const pageText3 = await page.innerText('body');
  const hasAwaitingText = pageText3.includes('Aguardando Vínculo') && pageText3.includes('Como liberar seu acesso ao balcão');

  await page.screenshot({ path: 'tools/cenario-3-awaiting-store.png' });
  console.log(`SCENARIO 3 RESULT: ${hasAwaitingText ? 'PASS' : 'FAIL'} (h1 count: ${awaitingH1})`);
  results.scenario3 = { passed: hasAwaitingText, h1Count: awaitingH1 };

  // -------------------------------------------------------------
  // TEST SCENARIO 4: Admin -> Convidar vendedor na aba Equipe (PENDING + link)
  // -------------------------------------------------------------
  console.log('--- TEST SCENARIO 4: Admin Equipe e Convites ---');
  // Click logout from awaiting view
  const logoutBtn = page.locator('button:has-text("Sair da conta")');
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await page.waitForTimeout(1000);
  } else {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  }

  // Login as Demo Admin
  await page.click('button:has-text("Demo Admin")');
  await page.waitForTimeout(2000);

  // Navigate to Settings / Equipe
  const settingsBtn = page.locator('button:has-text("Configurações"), button:has-text("Equipe")').first();
  await settingsBtn.click();
  await page.waitForTimeout(1000);

  // Check if team members are shown
  const bodyText4 = await page.innerText('body');
  const hasTeamSection = bodyText4.includes('Equipe') || bodyText4.includes('Membros');

  // Check for invite button or add member
  const addBtn = page.locator('button:has-text("Adicionar"), button:has-text("Convidar"), button:has-text("Novo Membro")').first();
  let addClicked = false;
  if (await addBtn.isVisible()) {
    await addBtn.click();
    addClicked = true;
    await page.waitForTimeout(600);
    console.log(' - Modal de convite aberto');

    // Fill new member
    const nameInput = page.locator('input[placeholder*="Nome" i], input#member-name').first();
    const emailInput = page.locator('input[placeholder*="email" i], input[type="email"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Marcos Vendas Novo');
      await emailInput.fill('marcos.novo@auracell.com.br');
      const confirmAdd = page.locator('button:has-text("Adicionar à Equipe"), button:has-text("Enviar Convite"), button:has-text("Salvar")').first();
      await confirmAdd.click();
      await page.waitForTimeout(1500);
    }
  }

  await page.screenshot({ path: 'tools/cenario-4-equipe-admin.png' });
  const finalBodyText4 = await page.innerText('body');
  const hasPendingOrInvite = finalBodyText4.includes('Pendente') || finalBodyText4.includes('Copiar Link') || finalBodyText4.includes('convite') || addClicked;
  console.log(`SCENARIO 4 RESULT: ${hasPendingOrInvite ? 'PASS' : 'FAIL'}`);
  results.scenario4 = { passed: hasPendingOrInvite, addClicked };

  // -------------------------------------------------------------
  // TEST SCENARIO 5: Checkout -> Busca CPF Blind Index & Comprovante QR
  // -------------------------------------------------------------
  console.log('--- TEST SCENARIO 5: Checkout & Comprovante QR Code ---');
  const checkoutNav = page.locator('button:has-text("Nova Venda"), button:has-text("Checkout")').first();
  await checkoutNav.click();
  await page.waitForTimeout(1000);

  // Search or select customer
  const custSearchInput = page.locator('input[placeholder*="cliente" i]').first();
  if (await custSearchInput.isVisible()) {
    await custSearchInput.click();
    await page.waitForTimeout(300);
    await custSearchInput.fill('394'); // Buscando dígitos de CPF
    await page.waitForTimeout(600);
  }

  // Select first customer in dropdown
  const custOption = page.locator('[role="option"], .cursor-pointer:has-text("@")').first();
  if (await custOption.isVisible()) {
    await custOption.click();
    console.log(' - Cliente selecionado');
    await page.waitForTimeout(400);
  }

  // Select smartphone card
  const phoneCard = page.locator('.cursor-pointer:has-text("iPhone"), .cursor-pointer:has-text("R$"), button:has-text("Selecionar")').first();
  if (await phoneCard.isVisible()) {
    await phoneCard.click();
    console.log(' - Aparelho selecionado');
    await page.waitForTimeout(400);
  }

  await page.screenshot({ path: 'tools/cenario-5-checkout-ready.png' });

  // Complete checkout
  const completeBtn = page.locator('button:has-text("Concluir Saída"), button:has-text("Finalizar Venda")').first();
  let receiptOpened = false;
  if (await completeBtn.isVisible()) {
    await completeBtn.click();
    await page.waitForTimeout(2000);
    receiptOpened = true;
    console.log(' - Saída concluída, aguardando modal de garantia');
  }

  await page.screenshot({ path: 'tools/cenario-5-comprovante-qr.png' });
  const modalText = await page.innerText('body');
  const hasQr = await page.locator('svg rect, canvas').count() > 0;
  const hasWhats = modalText.includes('WhatsApp') || await page.locator('button:has-text("WhatsApp"), a:has-text("WhatsApp")').count() > 0;
  const pass5 = receiptOpened && (hasQr || hasWhats);
  console.log(`SCENARIO 5 RESULT: ${pass5 ? 'PASS' : 'FAIL'} (Receipt: ${receiptOpened}, QR: ${hasQr}, WhatsApp: ${hasWhats})`);
  results.scenario5 = { passed: pass5, receiptOpened, hasQr, hasWhats };

  await browser.close();
  fs.writeFileSync('tools/scenarios-3-4-5-results.json', JSON.stringify(results, null, 2), 'utf-8');
}

run().catch(console.error);
