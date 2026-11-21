# 2. Topologia Arquitetural 100% Vercel Serverless Function + Supabase RLS — OpenCRM

> **Módulo de Documentação Oficial:** Este documento detalha a topologia de rede, diagrama de fluxo, arquitetura serverless e isolamento de banco de dados do **OpenCRM**.

---

## 1. Visão Geral da Topologia

A infraestrutura do OpenCRM foi arquitetada para operar de forma totalmente unificada na **Vercel Edge & Serverless Network**, conectando-se ao cluster gerenciado **PostgreSQL 17 no Supabase Cloud**:

* **Frontend SPA:** Servido via Edge CDN global da Vercel (distribuição estática ultra-rápida de HTML, JS compilado com Vite e assets CSS).
* **Backend Serverless:** Roteado via rewrite declarativo (`vercel.json`) para uma **Vercel Serverless Function** Node.js 22 rodando a instância Fastify encapsulada (`api/index.ts`).
* **Banco de Dados Relacional:** Supabase PostgreSQL 17 utilizando o **Supabase Transaction Pooler (PgBouncer, porta 6543)** para gerenciar centenas de conexões serverless efêmeras com latência mínima e sem esgotar o pool de conexões.

---

## 2. Diagrama de Arquitetura (Mermaid)

```mermaid
flowchart TD
    subgraph CLIENT["Navegador do Usuário (Client)"]
        SPA["React 19 SPA (Tailwind CSS v4)\nWarm Editorial Boutique UI"]
        STORAGE["Cookies HttpOnly\nSameSite=Lax (First-Party)"]
    end

    subgraph VERCEL["Vercel Edge Network & Serverless Platform"]
        ROUTER{"Vercel Router\n(vercel.json)"}
        STATIC["Edge CDN\n(HTML, Chunks JS, CSS)"]
        SERVERLESS["Vercel Serverless Function\n(/api/index.ts)"]
        
        subgraph FASTIFY_CORE["Fastify App Core (Node.js 22)"]
            HELMET["@fastify/helmet & CORS Multi-Origin"]
            RATELIMIT["@fastify/rate-limit (Anti-Bruteforce)"]
            AUTH_MOD["Auth Module\n(Argon2id + JWT + Rotation RFC 6819)"]
            LGPD_MOD["LGPD Engine\n(AES-256-GCM + HMAC-SHA256 Blind Index)"]
            DOMAIN_MOD["Módulos de Domínio\n(Stores, Inventory, Orders, Audit)"]
            ASYNC_BARRIER["Barreira Assíncrona\nres.on('finish')"]
        end
    end

    subgraph SUPABASE["Supabase Cloud (PostgreSQL 17)"]
        POOLER["Supabase Transaction Pooler\n(Porta 6543 / PgBouncer)"]
        DIRECT["Direct Session\n(Porta 5432 / Migrations)"]
        
        subgraph PG_ENGINE["PostgreSQL Engine"]
            ROLE["Role da Aplicação:\nopencrm_app"]
            RLS_GATE["FORCE ROW LEVEL SECURITY\nSET LOCAL app.current_store_id"]
            TABLES[("Tabelas Multi-Tenant\n(Stores, Users, Items, Customers, Orders)")]
            GIN_IDX[("Índices GIN JSONB\n(custom_attributes)")]
            AUDIT_TAB[("Audit Logs & Stock Ledger\n(Imutabilidade LGPD)")]
        end
    end

    SPA -->|1. Requisições SPA| ROUTER
    STORAGE -.->|Headers de Cookie| ROUTER
    ROUTER -->|/(.*) SPA Fallback| STATIC
    ROUTER -->|/api/:path* Rewrite| SERVERLESS
    SERVERLESS --> FASTIFY_CORE
    FASTIFY_CORE --> HELMET --> RATELIMIT --> AUTH_MOD & LGPD_MOD & DOMAIN_MOD
    DOMAIN_MOD --> ASYNC_BARRIER
    FASTIFY_CORE -->|2. Conexão Pooling Prisma| POOLER
    POOLER --> ROLE
    ROLE --> RLS_GATE
    RLS_GATE --> TABLES
    RLS_GATE --> GIN_IDX
    RLS_GATE --> AUDIT_TAB
```

---

## 3. Diagrama de Topologia de Rede (ASCII)

```
   ┌─────────────────────────────────────────────────────────────────────────┐
   │                          NAVEGADOR DO USUÁRIO                           │
   │                  (https://opencrm-ashy.vercel.app)                      │
   └────────────────────┬────────────────────────────────▲───────────────────┘
                        │                                │
                        │ 1. Navegação SPA               │ Cookies HttpOnly
                        │    (HTML / CSS / Chunks JS)    │ SameSite=Lax (First-Party)
                        ▼                                │
   ┌─────────────────────────────────────────────────────┴───────────────────┐
   │                       VERCEL EDGE NETWORK                               │
   │                                                                         │
   │   • Rewrites declarativos (`vercel.json`):                              │
   │     1) `/api/:path*`  ──▶  Serverless Function (`api/index.ts`)         │
   │     2) `/(.*)`        ──▶  /index.html (SPA Fallback)                   │
   └────────────────────┬────────────────────────────────────────────────────┘
                        │
                        │ 2. Chamada Serverless First-Party
                        │    (Sem problemas de CORS Cross-Domain)
                        ▼
   ┌─────────────────────────────────────────────────────────────────────────┐
   │             VERCEL SERVERLESS FUNCTION (NODE.JS / FASTIFY)              │
   │                            (api/index.ts)                               │
   │                                                                         │
   │   • Adaptador Serverless com barreira assíncrona (`res.on('finish')`)   │
   │   • Fastify Instance (`trustProxy: true` para captura correta de IP)    │
   │   • Helmet AppSec Headers & Anti-Bruteforce Rate Limiting               │
   │   • Rota Leve `GET /api/health` ──▶ 200 OK (Zero-Leak)                  │
   │   • Auth Module: Argon2id, JWT Rotation, Google OAuth 2.0               │
   │   • LGPD Engine: Blind Index HMAC-SHA256 + Criptografia AES-256-GCM     │
   │   • Engine Prisma com target binário nativo `rhel-openssl-3.0.x`        │
   └────────────────────┬────────────────────────────────────────────────────┘
                        │
                        │ 3. Prisma Connection Pooling & RLS Enforcement
                        │    (SET LOCAL "app.current_store_id" = $tenant)
                        ▼
   ┌─────────────────────────────────────────────────────────────────────────┐
   │                     SUPABASE CLOUD (POSTGRESQL 17)                      │
   │                    (Projeto: strzjawgrmdefpjioqcj)                      │
   │                                                                         │
   │   • Transaction Pooler (porta 6543) com PgBouncer                       │
   │   • Schema Multi-Tenant com RLS forçado em todas as tabelas             │
   │   • Role de Aplicação: `opencrm_app` (Sem privilégios de superusuário)  │
   │   • Índices GIN sobre colunas JSONB (`custom_attributes`)               │
   │   • Trilha imutável de Auditoria LGPD e Livro Razão de Estoque          │
   └─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detalhes de Engenharia do Adaptador Serverless (`api/index.ts`)

### 4.1 Ciclo de Vida e Barreira Assíncrona
Em funções serverless da Vercel, o runtime congela o processo assim que a resposta HTTP é enviada. Para evitar terminação prematura de requisições assíncronas do Fastify:
* O adaptador aguarda explicitamente o evento `res.on('finish')` antes de liberar o encerramento da função.
* A inicialização do Fastify é memorizada (*singleton pattern*), evitando o custo de *cold start* em invocações subsequentes dentro do mesmo container aquecido.

### 4.2 Alinhamento de Binários do Prisma
O arquivo `server/prisma/schema.prisma` define:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}
```
Isso garante compatibilidade binária nativa instantânea com a imagem Linux RHEL (Amazon Linux 2023) utilizada pelo ambiente Vercel Serverless, sem compilações adicionais em tempo de execução.
