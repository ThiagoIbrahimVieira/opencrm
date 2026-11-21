# 5. Stack Tecnológica Completa — OpenCRM

> **Módulo de Documentação Oficial:** Este documento detalha as bibliotecas, frameworks, plataformas de nuvem e ferramentas de qualidade que compõem o **OpenCRM**.

---

## 1. Visão Geral da Stack

O **OpenCRM** foi construído utilizando as versões mais recentes e seguras do ecossistema moderno TypeScript/Node.js, priorizando tipagem estrita, performance serverless e aderência a padrões web abertos:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND SPA                              │
│       React 19 • TypeScript • Vite 8 • Tailwind CSS v4 • Motion        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON / HttpOnly Cookies
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         BACKEND API SERVERLESS                         │
│   Fastify v4 • Vercel Functions (Node 22) • Prisma ORM (RHEL Native)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Connection Pooling (PgBouncer 6543)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BANCO DE DADOS RELACIONAL                       │
│    Supabase PostgreSQL 17 Cloud • Row-Level Security (RLS) • GIN JSONB │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detalhamento das Tecnologias

### 2.1 Frontend SPA
* **Framework:** **React 19** com tipagem estrita em **TypeScript**.
* **Bundler & Build Tool:** **Vite 8** com plugin `@vitejs/plugin-react` e suporte a HMR instantâneo.
* **Design System & Estilização:** **Tailwind CSS v4** configurado com a paleta autoral *Warm Editorial Boutique*:
  * Fundo primário: `#F4F2EC` (creme editorial neutro).
  * Painéis e cartões: `#FFFFFF` com bordas sutis `#E5E2D9`.
  * Cor de destaque e botões de ação: `#4F5A47` (verde-oliva refinado).
  * Tipografia humanista, proporções harmônicas e ausência total de componentes nativos de browser despadronizados.
* **Animações & Microinterações:** **Motion** (`framer-motion` v12) com transições fluidas e respeitando `prefers-reduced-motion`.
* **Ícones:** **Lucide React**.
* **Gerenciamento de Estado:** Padrão desacoplado baseado em `useSyncExternalStore` e repositórios locais reativos, eliminando boilerplate de gerenciadores de estado externos pesados.

### 2.2 Backend API & Serverless
* **Plataforma:** **Vercel Serverless Function** (`api/index.ts`) executando em **Node.js 22**.
* **Framework Web:** **Fastify v4** — escolhido pela sua sobrecarga mínima (*low overhead*), esquema de validação rápido e suporte a plugins assíncronos.
* **ORM:** **Prisma ORM** com `binaryTargets = ["native", "rhel-openssl-3.0.x"]`, garantindo compilação nativa compatível com a imagem do Vercel Serverless.
* **Segurança da Aplicação (AppSec):**
  * `@fastify/helmet`: Headers de segurança HTTP (CSP, X-Content-Type-Options, Strict-Transport-Security).
  * `@fastify/cors`: Configuração de CORS multi-origem estrita com suporte a credenciais de primeira parte.
  * `@fastify/rate-limit`: Proteção anti-bruteforce e limitação de taxa por IP.
  * `@fastify/cookie`: Assinatura e manipulação de cookies `HttpOnly`, `SameSite=Lax` e `Secure`.
* **Criptografia & Autenticação:**
  * **Argon2id:** Hash de senhas resistente a GPUs via WebAssembly.
  * **JWT:** Access Tokens efêmeros assinados com algoritmo HMAC SHA-256 e rotação RFC 6819 de refresh tokens.
  * **Google OAuth 2.0:** Autenticação federada com validação criptográfica via `google-auth-library`.
  * **LGPD Engine:** Módulo nativo em Node.js Crypto implementando `AES-256-GCM` e `HMAC-SHA256` Blind Index.

### 2.3 Banco de Dados & Infraestrutura de Nuvem
* **Engine:** **PostgreSQL 17** hospedado no **Supabase Cloud**.
* **Pooler:** **Supabase Transaction Pooler (PgBouncer, porta 6543)** configurado com `?pgbouncer=true` para gerenciar eficientemente o ciclo de vida efêmero de conexões serverless.
* **Acesso Direto:** Porta `5432` reservada para DDL e migrações do Prisma (`DIRECT_URL`).
* **Segurança em Banco:** Row-Level Security com `FORCE ROW LEVEL SECURITY` e role sem privilégios administrativos (`opencrm_app`).

### 2.4 Qualidade, Tipagem & Testes
* **Test Runner:** **Vitest** + **Node.js Test Runner nativo**.
* **Cobertura Automatizada:** **57 testes automatizados aprovados (100% PASS)**:
  * 24 testes no frontend cobrindo isolamento zero-mock, componentes dinâmicos de formulário, validação de regras de segmento e fluxos de navegação.
  * 33 testes no backend cobrindo isolamento RLS multi-tenant, criptografia AES-256-GCM, blind index, integridade de transações ACID e anti-vazamento de DTOs.
* **Linter & Type Checking:** TypeScript strict mode (`tsc --noEmit`) e ESLint com zero erros e zero advertências toleradas.
