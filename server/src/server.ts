import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = buildApp();

async function start() {
  try {
    const address = await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 [OpenCRM API] Servidor rodando em ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
