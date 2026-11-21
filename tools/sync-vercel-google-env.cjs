const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function getEnvVal(filePath, key) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith(`${key}=`)) {
      let val = trimmed.slice(key.length + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val.trim();
    }
  }
  return null;
}

const rootDir = path.resolve(__dirname, '..');
const viteClientId = getEnvVal(path.join(rootDir, '.env.local'), 'VITE_GOOGLE_CLIENT_ID');
const serverClientId = getEnvVal(path.join(rootDir, 'server', '.env'), 'GOOGLE_CLIENT_ID');

const clientId = viteClientId || serverClientId;

if (!clientId) {
  console.error('[ERRO] Google Client ID não encontrado em .env.local ou server/.env');
  process.exit(1);
}

console.log(`[INFO] Google Client ID validado com sucesso (comprimento: ${clientId.length} chars, termina com: ...${clientId.slice(-20)})`);

const varsToAdd = [
  { name: 'GOOGLE_CLIENT_ID', val: clientId },
  { name: 'VITE_GOOGLE_CLIENT_ID', val: clientId }
];

const envs = ['production', 'preview', 'development'];

for (const item of varsToAdd) {
  for (const env of envs) {
    console.log(`[VERCEL] Adicionando ${item.name} ao ambiente ${env}...`);
    // Usamos spawnSync passando valor via stdin ou --value
    const child = spawnSync('npx', ['--yes', 'vercel', 'env', 'add', item.name, env, '--project', 'opencrm', '--force', '--value', item.val, '--yes'], {
      shell: true,
      encoding: 'utf8'
    });
    
    // Scrub sensitive tokens from output just in case
    const safeStdout = (child.stdout || '').replace(new RegExp(clientId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[REDACTED_CLIENT_ID]');
    const safeStderr = (child.stderr || '').replace(new RegExp(clientId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[REDACTED_CLIENT_ID]');
    
    if (child.status !== 0) {
      console.error(`[FALHA] ${item.name} em ${env}:`, safeStderr || safeStdout);
    } else {
      console.log(`[SUCESSO] ${item.name} configurada em ${env}:`, safeStdout.trim().split('\n')[0]);
    }
  }
}

console.log('[CONCLUÍDO] Sincronização de variáveis concluída.');
