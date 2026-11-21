# OpenCRM — Plataforma SaaS Multi-Tenant Metadata-Driven, Supabase PostgreSQL, Template Engine & AppSec

> **Arquitetura Full-Stack Corporativa:** Frontend React 19 + TypeScript + Tailwind CSS (*Warm Editorial Boutique Design System*) integrado a Backend Fastify + TypeScript + Prisma ORM, banco de dados PostgreSQL 16 gerenciado no Supabase com **Row-Level Security (RLS) real**, criptografia de dados pessoais (**LGPD**), transações **ACID** com proteção contra race conditions e motor dinâmico de templates.

### 🌐 Ambientes em Produção (Live)
- **Frontend SPA (Vercel):** [https://opencrm-ashy.vercel.app](https://opencrm-ashy.vercel.app)
- **Backend API (Render):** [https://opencrm-api.onrender.com/api/health](https://opencrm-api.onrender.com/api/health)
- **Banco de Dados (Supabase PostgreSQL):** RLS ativado com isolamento multi-tenant real
- **Repositório Oficial:** [https://github.com/ThiagoIbrahimVieira/opencrm](https://github.com/ThiagoIbrahimVieira/opencrm)

---

## 1. Visão Geral e Problema Resolvido

Sistemas de gestão tradicionais sofrem de dois extremos: ou são inflexíveis (forçando lojas de roupas ou lanchonetes a lidar com campos de "IMEI", "Bateria" e "Armazenamento"), ou apelam para soluções No-Code frágeis sem isolamento real de banco de dados, sem integridade relacional e com sérios riscos de vazamento de dados (**LGPD**).

O **OpenCRM** resolve esse desafio por meio de uma arquitetura **Metadata-Driven Multi-Tenant**:
1. **Multi-Tenancy com RLS no PostgreSQL 16 (Supabase):** Isolamento forçado no nível de banco de dados via role restrita `opencrm_app` e políticas de RLS ativadas com `FORCE ROW LEVEL SECURITY`.
2. **Motor de Templates Dinâmico (`JSONB` + Zod):** Permite que cada loja defina seus próprios campos (ex: grade de tamanho e tecido para moda, tempo de preparo e validade de lote para lanches, ou IMEI com algoritmo de Luhn para smartphones), validados dinamicamente pelo backend.
3. **AppSec & LGPD By Design:** Criptografia de ponta a ponta (`AES-256-GCM`), Blind Index (`HMAC-SHA256`) para busca e deduplicação sem descriptografia, auditoria imutável de revelação de dados sensíveis e autenticação segura com cookies `HttpOnly` e refresh tokens rotativos.
4. **Checkout Transacional ACID & Anti-Concorrência:** Baixa atômica de estoque com verificação condicional em única transação e suporte a chave de idempotência (`Idempotency-Key`), retornando `409 Conflict` em caso de concorrência simultânea.

---

## 2. Diagrama Entidade-Relacionamento (DER)

```mermaid
erDiagram
    users ||--o{ store_memberships : "possui"
    stores ||--o{ store_memberships : "possui"
    stores ||--o{ refresh_tokens : "registra"
    stores ||--o{ device_models : "cataloga"
    stores ||--o{ primary_items : "estoca"
    stores ||--o{ secondary_items : "estoca"
    stores ||--o{ item_compatibilities : "mapeia"
    stores ||--o{ customers : "atende"
    stores ||--o{ orders : "emite"
    stores ||--o{ order_items : "contém"
    stores ||--o{ stock_ledger : "registra_baixas"
    stores ||--o{ audit_logs : "audita"

    customers ||--o{ orders : "compra"
    customers ||--o{ primary_items : "trade_in_origem"

    users ||--o{ refresh_tokens : "autentica"
    orders ||--o{ order_items : "agrega"
    device_models ||--o{ primary_items : "especifica"
    secondary_items ||--o{ item_compatibilities : "vincula"
    device_models ||--o{ item_compatibilities : "compatibiliza"

    primary_items ||--o| order_items : "item_vendido"
    secondary_items ||--o{ order_items : "item_vendido"

    stores {
        uuid id PK
        string slug UK
        string name
        string segment
        jsonb template_config
        jsonb catalog_options
        timestamp created_at
    }

    users {
        uuid id PK
        string name
        string email UK
        string password_hash
        string google_sub UK
        string avatar_url
        timestamp created_at
    }

    store_memberships {
        uuid id PK
        uuid user_id FK
        uuid store_id FK
        string role "ADMIN | VENDEDOR"
        boolean is_active
        timestamp created_at
    }

    primary_items {
        uuid id PK
        uuid store_id FK
        uuid model_id FK
        string title
        string sku_code
        boolean is_serialized
        int stock_qty
        string imei_1
        string imei_2
        string serial_number
        int cost_price_cents
        int sale_price_cents
        string status "DISPONIVEL | RESERVADO | VENDIDO | ESGOTADO"
        jsonb checklist_json
        jsonb custom_attributes "GIN Index"
        timestamp expires_at
        int version
    }

    secondary_items {
        uuid id PK
        uuid store_id FK
        string sku UK
        string name
        string category
        int stock_qty
        int min_stock_alert
        int cost_price_cents
        int sale_price_cents
        jsonb custom_attributes "GIN Index"
        timestamp expires_at
    }

    customers {
        uuid id PK
        uuid store_id FK
        string full_name
        string email
        string status "ATIVO | LEAD | INATIVO"
        string phone_encrypted "AES-256-GCM"
        string phone_last4
        string phone_hmac "HMAC-SHA256 Blind Index"
        string cpf_encrypted "AES-256-GCM"
        string cpf_last4
        string cpf_hmac "HMAC-SHA256 Blind Index"
        jsonb notes_json
    }

    orders {
        uuid id PK
        uuid store_id FK
        string order_code
        uuid customer_id FK
        uuid seller_id
        string payment_method
        int warranty_days
        timestamp warranty_expires_at
        uuid public_warranty_token UK
        string idempotency_key UK
        int total_cents
        timestamp created_at
    }

    order_items {
        uuid id PK
        uuid store_id FK
        uuid order_id FK
        uuid primary_item_id FK
        uuid secondary_item_id FK
        string item_title
        int quantity
        int unit_price_cents
    }

    stock_ledger {
        uuid id PK
        uuid store_id FK
        string item_type
        string item_id
        string item_label
        int delta
        int resulting_stock
        string reason "Entrada | Reposição | Saída / Venda | Trade-in"
        string actor_user_id
        timestamp created_at
    }

    audit_logs {
        uuid id PK
        uuid store_id FK
        string actor_user_id
        string actor_name
        string actor_role
        string action
        string entity_type
        string entity_id
        string ip_address
        string user_agent
        timestamp created_at
    }
```

---

## 3. Segurança da Informação & Conformidade LGPD

| Vetor de Segurança | Implementação no OpenCRM | Benefício Prático |
| :--- | :--- | :--- |
| **Isolamento de Tenants (RLS)** | `SET LOCAL ROLE opencrm_app` + `set_config('app.current_store_id')` | Mesmo com injeção SQL no código, uma loja jamais visualiza ou altera registros de outra loja. |
| **Proteção de PII (LGPD)** | Criptografia `AES-256-GCM` (IV aleatório de 12 bytes + Auth Tag) | Se o banco de dados for comprometido, os dados pessoais (CPF, telefones) são ilegíveis. |
| **Busca e Deduplicação** | Blind Index determinístico via `HMAC-SHA256` (`PII_HMAC_KEY_HEX`) | Permite busca exata de cliente por CPF/Telefone sem nunca descriptografar colunas inteiras em memória. |
| **Armazenamento de Senhas** | `Argon2id` (WebAssembly nativo) com parâmetros recomendados pela OWASP | Resistência máxima a ataques de força bruta e aceleração via GPU/ASIC. |
| **Sessão & Tokens** | JWT em cookies `HttpOnly` + Refresh Tokens com detecção de reuso | Tokens inacessíveis via JavaScript (proteção contra XSS). Reuso de token revogado invalida toda a família de sessões. |
| **Anti-Vazamento em DTOs** | Serializador condicional por RBAC | Vendedores recebem apenas preço de venda; custos, margens e logs fiscais são expurgados no nível de serialização do backend. |
| **Consulta Pública Segura** | Função `SECURITY DEFINER` com Whitelist Estrita | Consulta pública via QR Code exibe dados do item e validade da garantia; omite 100% de CPFs, nomes, custos ou dados fiscais. |

---

## 4. Stack Tecnológica

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React, Motion.
  - Padrão reativo desacoplado: `useSyncExternalStore` + `subscribe(listener)` / `getSnapshot()`.
  - Design System *Warm Editorial Boutique* (paleta boutique `#F4F2EC`, oliva `#4F5A47`, tipografia humanista e zero componentes de formulário nativos).
- **Backend:** Node.js, Fastify, TypeScript, Prisma ORM.
  - Camadas bem definidas: `config/`, `db/`, `middlewares/`, `modules/{auth,stores,inventory,customers,orders,audit,public}/`, `utils/`.
  - Plugins Fastify: `@fastify/cors`, `@fastify/helmet`, `@fastify/cookie`, `@fastify/rate-limit`.
- **Banco de Dados:** PostgreSQL 16 (compatível com Supabase Transaction Pooler porta 6543 e conexões diretas porta 5432).
- **Testes & Qualidade:** Vitest + Node Test Runner + Fastify Inject (`20 testes unitários no frontend` e `17 testes de integração e conformidade no backend`).

---

## 5. Como Executar o Projeto

### Pré-requisitos
- Node.js 20+ (testado em v26.13.0)
- npm ou pnpm
- Uma conta no [Supabase](https://supabase.com) (ou Docker com PostgreSQL 16 local)

### Passo 1: Clonar o Repositório e Instalar Dependências

```bash
# Instalar dependências do frontend (raiz)
npm install --legacy-peer-deps

# Instalar dependências do backend
cd server
npm install --legacy-peer-deps
cd ..
```

### Passo 2: Configurar as Variáveis de Ambiente no Backend

Crie o arquivo `server/.env` a partir do modelo `server/.env.example`:

```bash
cp server/.env.example server/.env
```

Gere as chaves de 32 bytes (64 caracteres hexadecimais) no terminal:
```bash
node -e "console.log('PII_ENCRYPTION_KEY_HEX=' + crypto.randomBytes(32).toString('hex'))"
node -e "console.log('PII_HMAC_KEY_HEX=' + crypto.randomBytes(32).toString('hex'))"
```

Preencha no `server/.env`:
- `DATABASE_URL`: URL do Transaction Pooler do Supabase (porta `6543`) com `?pgbouncer=true` (ou Postgres local).
- `DIRECT_URL`: URL direta/Session do Supabase (porta `5432`) para execução das migrations do Prisma.
- `JWT_ACCESS_SECRET`: Segredo de no mínimo 32 caracteres para JWT.
- `JWT_REFRESH_SECRET`: Segredo de no mínimo 32 caracteres para Refresh Token.
- `PII_ENCRYPTION_KEY_HEX`: Chave hex gerada acima.
- `PII_HMAC_KEY_HEX`: Chave hex gerada acima.

### Passo 3: Executar Migrações e Popular o Banco (Seed Idempotente)

```bash
cd server

# Gerar o Prisma Client
npm run db:generate

# Aplicar a migration com tabelas, índices GIN, role opencrm_app e RLS
npm run db:deploy

# Executar a seed com as 3 lojas de demonstração
npm run db:seed
```

> **Lojas pré-configuradas no Seed:**
> 1. **AuraCell — Loja Jardins:** Segmento Celulares & Assistência (controle serializado com algoritmo de Luhn, trade-in, checklist e termo com QR Code).
>    - Admin: `thiago@auracell.com.br` / `admin123`
>    - Vendedor: `camila@auracell.com.br` / `vendedor123`
> 2. **Sabor & Brasa:** Segmento Lanchonete & Hamburgueria (itens por quantidade `stock_qty`, controle de validade de lote e sem serialização).
>    - Admin: `chef@saborbrasa.com.br` / `admin123`
> 3. **Atelier Linho:** Segmento Loja de Roupas & Moda (grade de tamanhos e tecidos com garantia de troca de 30 dias via QR Code).
>    - Admin: `estilo@atelierlinho.com.br` / `admin123`

### Passo 4: Iniciar o Backend e Frontend

```bash
# Terminal 1: Iniciar o Backend Fastify (porta 3333)
cd server
npm run dev

# Terminal 2: Iniciar o Frontend Vite (porta 3000)
npm run dev
```

Abra seu navegador em `http://localhost:3000`.

---

## 6. Executando os Testes Automatizados

```bash
# Executar suíte de testes unitários do Frontend (20 testes)
npm test

# Executar suíte de testes de integração e conformidade AppSec do Backend (17 testes)
cd server
npm test
```

---

## 7. CI/CD Pipeline (GitHub Actions)

O pipeline `.github/workflows/ci.yml` roda automaticamente em cada push ou pull request:
1. Sobe um container de serviço `postgres:16-alpine`.
2. Executa `tsc --noEmit` e `npm test` no frontend.
3. Executa `vite build` validando geração dos bundles de produção.
4. Aplica as migrações SQL do Prisma e o script RLS.
5. Roda a seed idempotente do banco de dados.
6. Executa a suíte de testes de integração com Vitest e Fastify.
