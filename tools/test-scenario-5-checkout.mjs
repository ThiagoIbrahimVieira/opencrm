import { chromium } from 'playwright';
import fs from 'fs';

const TARGET_URL = 'https://opencrm-ashy.vercel.app';

async function run() {
  console.log('🚀 Executando Homologação ao Vivo do Cenário 5 em Produção...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // 1. Login com Demo Admin
    console.log('Passo 1: Autenticação via Demo Admin...');
    await page.click('button:has-text("Demo Admin")');
    await page.waitForTimeout(2000);

    // 2. Navegar para Saída & Garantia (Checkout)
    console.log('Passo 2: Navegando para Checkout (Saída & Garantia)...');
    await page.click('button:has-text("Saída & Garantia")');
    await page.waitForTimeout(1000);

    // 3. Busca de Cliente por CPF (Blind Index)
    console.log('Passo 3: Busca de cliente por CPF com Blind Index...');
    const cpfInput = page.locator('input[placeholder*="digite o CPF"]').first();
    await cpfInput.fill('394.821.508-42');
    await page.click('button:has-text("Buscar CPF")');
    await page.waitForTimeout(600);

    const feedbackText = await page.locator('text=Cliente localizado').textContent();
    console.log(` - Feedback da busca por CPF: "${feedbackText}"`);

    // 4. Selecionar Aparelho Serializado no Estoque (Passo 2 do checkout)
    console.log('Passo 4: Selecionando aparelho serializado no estoque...');
    const phoneLocator = page.locator('section:has-text("Escolher") button').first();
    const phoneText = (await phoneLocator.innerText()).replace(/\n/g, ' ');
    console.log(` - Aparelho selecionado: "${phoneText}"`);
    await phoneLocator.click();
    await page.waitForTimeout(600);

    await page.screenshot({ path: 'tools/cenario-5-checkout-ready.png' });
    console.log(' - Screenshot da tela de checkout salva: tools/cenario-5-checkout-ready.png');

    // 5. Concluir Saída e Abrir Termo de Garantia
    console.log('Passo 5: Concluindo checkout...');
    const confirmBtn = page.locator('button:has-text("Confirmar Saída e Gerar Termo")');
    await confirmBtn.click();
    await page.waitForTimeout(2000);

    // 6. Validar Modal de Garantia / Comprovante
    console.log('Passo 6: Validando Modal do Termo de Garantia...');
    const modalDialog = page.locator('div[role="dialog"]').first();
    await modalDialog.waitFor({ state: 'visible', timeout: 5000 });

    const modalText = await modalDialog.innerText();
    const hasOrderCode = /AC-\d{4}-\d{4}/.test(modalText);
    const hasWaButton = await page.locator('button:has-text("Enviar Garantia no WhatsApp")').isVisible();
    const hasQrSvg = await page.locator('svg[aria-label*="QR Code de consulta pública"]').isVisible();
    const hasMaskedCpf = modalText.includes('CPF:') && (modalText.includes('•••.') || modalText.includes('***.'));

    console.log(` - Código de Pedido gerado: ${hasOrderCode}`);
    console.log(` - Botão WhatsApp visível: ${hasWaButton}`);
    console.log(` - QR Code vetorial SVG renderizado: ${hasQrSvg}`);
    console.log(` - CPF mascarado (Blind Index/Privacidade): ${hasMaskedCpf}`);

    // Testar botão Exibir / Mascarar CPF
    const toggleCpfBtn = page.locator('button:has-text("Exibir CPF")').first();
    let toggleWorked = false;
    if (await toggleCpfBtn.isVisible()) {
      await toggleCpfBtn.click();
      await page.waitForTimeout(400);
      const textAfterToggle = await modalDialog.innerText();
      toggleWorked = textAfterToggle.includes('394.821.508-42');
      console.log(` - Revelação de CPF desmascarado após clique: ${toggleWorked}`);
    }

    await page.screenshot({ path: 'tools/cenario-5-comprovante-qr.png' });
    console.log(' - Screenshot do Comprovante com QR Code salva: tools/cenario-5-comprovante-qr.png');

    const pass = hasOrderCode && hasWaButton && hasQrSvg && hasMaskedCpf;
    console.log('\n======================================================');
    console.log(`RESULTADO FINAL CENÁRIO 5: ${pass ? 'APROVADO (PASS)' : 'FALHA (FAIL)'}`);
    console.log('======================================================');

    const result = {
      scenario5: {
        passed: pass,
        hasOrderCode,
        hasWaButton,
        hasQrSvg,
        hasMaskedCpf,
        toggleWorked,
        phoneText,
        feedbackText,
        screenshots: [
          'tools/cenario-5-checkout-ready.png',
          'tools/cenario-5-comprovante-qr.png'
        ]
      }
    };

    fs.writeFileSync('tools/cenario-5-result.json', JSON.stringify(result, null, 2));

  } catch (err) {
    console.error('ERRO AO EXECUTAR CENÁRIO 5:', err);
    await page.screenshot({ path: 'tools/cenario-5-error.png' });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
