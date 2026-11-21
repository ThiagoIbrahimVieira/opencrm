import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', (msg) => console.log('PAGE_CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.error('PAGE_ERROR:', err.message));

  console.log('Navigating to https://opencrm-ashy.vercel.app ...');
  await page.goto('https://opencrm-ashy.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });

  const title = await page.title();
  console.log('PAGE_TITLE:', title);

  // Check Google login button
  const googleBtn = await page.locator('text=Continuar com Google').or(page.locator('button:has-text("Google")')).count();
  console.log('GOOGLE_BTN_COUNT:', googleBtn);

  // Take screenshot
  await page.screenshot({ path: 'tools/live-login-view.png' });
  console.log('Screenshot saved to tools/live-login-view.png');

  await browser.close();
}

main().catch(console.error);
