import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const BACKEND_PORT = 3333;
const FRONTEND_PORT = 5173;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404 || res.status === 200) {
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await wait(400);
  }
  throw new Error(`Timeout waiting for server at ${url}`);
}

async function runSmokeSuite() {
  console.log('=====================================================');
  console.log('🚀 [QA SMOKE TEST] INICIANDO VALIDAÇÃO DE AMBIENTE');
  console.log(`Backend Target:  ${BACKEND_URL}`);
  console.log(`Frontend Target: ${FRONTEND_URL}`);
  console.log('=====================================================');

  const results = {
    timestamp: new Date().toISOString(),
    backendUrl: BACKEND_URL,
    frontendUrl: FRONTEND_URL,
    testCases: [],
  };

  let backendProc = null;
  let frontendProc = null;

  try {
    // 1. Spawning Backend
    console.log('\n[1/4] Iniciando Backend Fastify (server/dist/server.js)...');
    backendProc = spawn('node', ['dist/server.js'], {
      cwd: path.resolve('server'),
      stdio: 'pipe',
      env: { ...process.env, PORT: String(BACKEND_PORT), NODE_ENV: 'development' },
    });

    backendProc.stdout.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`   [BACKEND STDOUT] ${msg}`);
    });
    backendProc.stderr.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) console.error(`   [BACKEND STDERR] ${msg}`);
    });

    await waitForServer(`${BACKEND_URL}/api/health`, 12000);
    console.log('✅ Backend ativo e respondendo na porta 3333');

    // 2. Spawning Frontend Vite
    console.log('\n[2/4] Iniciando Frontend Vite (porta 5173)...');
    frontendProc = spawn('npx', ['vite', '--port', String(FRONTEND_PORT), '--host', '127.0.0.1'], {
      cwd: path.resolve('.'),
      stdio: 'pipe',
      shell: true,
      env: { ...process.env },
    });

    frontendProc.stdout.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg && msg.includes('Local:')) console.log(`   [FRONTEND] ${msg}`);
    });

    await waitForServer(`${FRONTEND_URL}`, 12000);
    console.log('✅ Frontend ativo e respondendo na porta 5173');

    console.log('\n[3/4] Executando Casos de Teste do Smoke Test...');

    // TC-01: Backend Health
    {
      const start = Date.now();
      const res = await fetch(`${BACKEND_URL}/api/health`);
      const body = await res.json();
      const pass = res.status === 200 && body.status === 'healthy';
      results.testCases.push({
        id: 'TC-SMOKE-01',
        title: 'Backend Health Check Direct',
        endpoint: 'GET /api/health',
        status: res.status,
        durationMs: Date.now() - start,
        passed: pass,
        details: body,
      });
      console.log(` - TC-SMOKE-01: Backend Health Check -> ${pass ? 'PASS' : 'FAIL'} (${body.status})`);
    }

    // TC-02: Frontend Index HTML
    {
      const start = Date.now();
      const res = await fetch(`${FRONTEND_URL}`);
      const text = await res.text();
      const pass = res.status === 200 && text.includes('root');
      results.testCases.push({
        id: 'TC-SMOKE-02',
        title: 'Frontend Index Page Serve',
        endpoint: 'GET /',
        status: res.status,
        durationMs: Date.now() - start,
        passed: pass,
        details: { contentLength: text.length },
      });
      console.log(` - TC-SMOKE-02: Frontend Serve -> ${pass ? 'PASS' : 'FAIL'} (${text.length} bytes)`);
    }

    // TC-03: Frontend to Backend Proxy
    {
      const start = Date.now();
      const res = await fetch(`${FRONTEND_URL}/api/health`);
      const body = await res.json();
      const pass = res.status === 200 && body.status === 'healthy';
      results.testCases.push({
        id: 'TC-SMOKE-03',
        title: 'Frontend Vite Reverse Proxy to Backend',
        endpoint: 'GET :5173/api/health',
        status: res.status,
        durationMs: Date.now() - start,
        passed: pass,
        details: body,
      });
      console.log(` - TC-SMOKE-03: Frontend Reverse Proxy -> ${pass ? 'PASS' : 'FAIL'} (${body.status})`);
    }

    // TC-04: Demo Login AuraCell
    let auraToken = null;
    let cookieHeader = '';
    {
      const start = Date.now();
      const res = await fetch(`${BACKEND_URL}/api/auth/login-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'ADMIN', storeSlug: 'auracell-jardins' }),
      });
      const rawCookies = res.headers.get('set-cookie') || '';
      cookieHeader = rawCookies;
      const body = await res.json();
      auraToken = body.accessToken;
      const pass =
        res.status === 200 &&
        body.user?.email === 'thiago@auracell.com.br' &&
        body.store?.slug === 'auracell-jardins' &&
        !!body.accessToken;

      results.testCases.push({
        id: 'TC-SMOKE-04',
        title: 'Demo Login AuraCell Real DB Authentication',
        endpoint: 'POST /api/auth/login-demo (auracell-jardins)',
        status: res.status,
        durationMs: Date.now() - start,
        passed: pass,
        details: {
          userName: body.user?.name,
          userEmail: body.user?.email,
          userRole: body.user?.role,
          storeName: body.store?.name,
          storeSegment: body.store?.segment,
          hasAccessToken: !!body.accessToken,
        },
      });
      console.log(` - TC-SMOKE-04: Demo Login AuraCell -> ${pass ? 'PASS' : 'FAIL'} (${body.store?.name} / ${body.user?.role})`);
    }

    // TC-05: Real Supabase Primary Items for AuraCell
    {
      const start = Date.now();
      const res = await fetch(`${BACKEND_URL}/api/inventory/primary`, {
        headers: {
          Authorization: `Bearer ${auraToken}`,
          Cookie: cookieHeader,
        },
      });
      const items = await res.json();
      const pass = res.status === 200 && Array.isArray(items) && items.length > 0;
      results.testCases.push({
        id: 'TC-SMOKE-05',
        title: 'Real Supabase Inventory Retrieval (AuraCell)',
        endpoint: 'GET /api/inventory/primary',
        status: res.status,
        durationMs: Date.now() - start,
        passed: pass,
        details: {
          itemCount: items.length,
          firstItemTitle: items[0]?.title,
          firstItemStatus: items[0]?.status,
        },
      });
      console.log(` - TC-SMOKE-05: Inventory AuraCell -> ${pass ? 'PASS' : 'FAIL'} (${items.length} itens encontrados)`);
    }

    // TC-06: Query Stores Mine (Memberships)
    let saborBrasaStoreId = '';
    {
      const start = Date.now();
      const res = await fetch(`${BACKEND_URL}/api/stores/mine`, {
        headers: {
          Authorization: `Bearer ${auraToken}`,
          Cookie: cookieHeader,
        },
      });
      const memberships = await res.json();
      const pass = res.status === 200 && Array.isArray(memberships) && memberships.length >= 2;
      const saborBrasa = memberships.find((m) => m.store?.slug === 'sabor-e-brasa');
      saborBrasaStoreId = saborBrasa?.storeId || '22222222-2222-2222-2222-222222222222';

      results.testCases.push({
        id: 'TC-SMOKE-06',
        title: 'Query Multi-Tenant Store Memberships',
        endpoint: 'GET /api/stores/mine',
        status: res.status,
        durationMs: Date.now() - start,
        passed: pass,
        details: {
          membershipCount: memberships.length,
          stores: memberships.map((m) => ({ name: m.store?.name, slug: m.store?.slug, role: m.role })),
        },
      });
      console.log(` - TC-SMOKE-06: Store Memberships -> ${pass ? 'PASS' : 'FAIL'} (${memberships.length} lojas vinculadas)`);
    }

    // TC-07: Switch Store to Sabor & Brasa
    let saborToken = null;
    let saborCookieHeader = '';
    {
      const start = Date.now();
      const res = await fetch(`${BACKEND_URL}/api/stores/switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auraToken}`,
          Cookie: cookieHeader,
        },
        body: JSON.stringify({ storeId: saborBrasaStoreId }),
      });
      const rawCookies = res.headers.get('set-cookie') || '';
      saborCookieHeader = rawCookies || cookieHeader;
      const body = await res.json();
      saborToken = body.accessToken;
      const pass =
        res.status === 200 &&
        body.store?.slug === 'sabor-e-brasa' &&
        body.store?.segment === 'Lanchonete & Hamburgueria';

      results.testCases.push({
        id: 'TC-SMOKE-07',
        title: 'Multi-Tenant Store Switching (Sabor & Brasa)',
        endpoint: 'POST /api/stores/switch',
        status: res.status,
        durationMs: Date.now() - start,
        passed: pass,
        details: {
          activeStoreName: body.store?.name,
          activeStoreSegment: body.store?.segment,
          role: body.role,
        },
      });
      console.log(` - TC-SMOKE-07: Switch to Sabor & Brasa -> ${pass ? 'PASS' : 'FAIL'} (${body.store?.name})`);
    }

    // TC-08: Isolated Inventory Verification for Sabor & Brasa (RLS Check)
    {
      const start = Date.now();
      const res = await fetch(`${BACKEND_URL}/api/inventory/primary`, {
        headers: {
          Authorization: `Bearer ${saborToken}`,
          Cookie: saborCookieHeader,
        },
      });
      const items = await res.json();
      // Should find Smash Burger items and ZERO iPhone items
      const hasSmashBurger = items.some((i) => i.title.toLowerCase().includes('smash') || i.title.toLowerCase().includes('burger'));
      const hasPhone = items.some((i) => i.title.toLowerCase().includes('iphone'));
      const pass = res.status === 200 && Array.isArray(items) && hasSmashBurger && !hasPhone;

      results.testCases.push({
        id: 'TC-SMOKE-08',
        title: 'RLS Strict Isolation Verification in Supabase',
        endpoint: 'GET /api/inventory/primary (Sabor & Brasa Context)',
        status: res.status,
        durationMs: Date.now() - start,
        passed: pass,
        details: {
          itemCount: items.length,
          itemTitles: items.map((i) => i.title),
          containsStoreBItem: hasSmashBurger,
          containsStoreAItem: hasPhone,
        },
      });
      console.log(` - TC-SMOKE-08: RLS Isolation Sabor & Brasa -> ${pass ? 'PASS' : 'FAIL'} (Burger: ${hasSmashBurger}, iPhone Leaked: ${hasPhone})`);
    }

    // TC-09: Dashboard Summary Telemetry
    {
      const start = Date.now();
      const res = await fetch(`${BACKEND_URL}/api/dashboard/summary`, {
        headers: {
          Authorization: `Bearer ${saborToken}`,
          Cookie: saborCookieHeader,
        },
      });
      const summary = await res.json();
      const pass = res.status === 200 && typeof summary.availableSmartphones === 'number';

      results.testCases.push({
        id: 'TC-SMOKE-09',
        title: 'Dashboard Summary Telemetry with Supabase DB',
        endpoint: 'GET /api/dashboard/summary',
        status: res.status,
        durationMs: Date.now() - start,
        passed: pass,
        details: summary,
      });
      console.log(` - TC-SMOKE-09: Dashboard Telemetry -> ${pass ? 'PASS' : 'FAIL'} (avail: ${summary.availableSmartphones})`);
    }

  } catch (err) {
    console.error('❌ Erro crítico durante o smoke test:', err);
    results.error = err.message;
  } finally {
    // 4. Graceful Shutdown
    console.log('\n[4/4] Encerrando processos temporários de smoke test...');
    if (backendProc) {
      backendProc.kill('SIGTERM');
      console.log(' - Backend Fastify encerrado');
    }
    if (frontendProc) {
      // On Windows killing shell needs taskkill
      try {
        spawn('taskkill', ['/pid', String(frontendProc.pid), '/f', '/t']);
      } catch (e) {
        frontendProc.kill('SIGTERM');
      }
      console.log(' - Frontend Vite encerrado');
    }
  }

  const allPassed = results.testCases.length > 0 && results.testCases.every((tc) => tc.passed);
  results.overallStatus = allPassed ? 'PASS' : 'FAIL';

  fs.writeFileSync(path.resolve('tools/smoke-test-results.json'), JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n=====================================================`);
  console.log(`RESULTADO CONSOLIDADO DO SMOKE TEST: ${results.overallStatus}`);
  console.log(`Total de Casos: ${results.testCases.length} | Aprovados: ${results.testCases.filter((t) => t.passed).length}`);
  console.log(`Relatório JSON salvo em tools/smoke-test-results.json`);
  console.log(`=====================================================`);

  return allPassed;
}

runSmokeSuite().then((ok) => {
  process.exit(ok ? 0 : 1);
});
