import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '../server/src/app.js';

let appInstance: any = null;

async function getApp() {
  if (!appInstance) {
    const fastify = buildApp();
    await fastify.ready();
    appInstance = fastify;
  }
  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    await new Promise<void>((resolve, reject) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      res.on('error', reject);
      app.server.emit('request', req, res);
    });
  } catch (err: any) {
    console.error('Vercel Serverless Function fatal error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Ocorreu um erro interno no servidor serverless.',
      })
    );
  }
}
