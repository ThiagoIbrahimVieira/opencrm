# 6. Guia de Execução Local & Configuração de Ambiente — OpenCRM

> **Módulo de Documentação Oficial:** Este documento contém o passo a passo completo para clonar, configurar variáveis de ambiente, executar migrações e inicializar o **OpenCRM** em ambiente de desenvolvimento local.

---

## 1. Pré-requisitos do Sistema

Antes de iniciar, certifique-se de que sua máquina possui:
* **Node.js:** Versão 20+ (testado e homologado nas versões v22 e v26).
* **Gerenciador de Pacotes:** `npm` (versão 10+) ou `pnpm`.
* **Banco de Dados:** Uma instância do PostgreSQL 16+ (rodando localmente via Docker ou um projeto gratuito no Supabase Cloud).
* **Git:** Versão 2.40+.

---

## 2. Passo a Passo de Instalação

### Passo 1: Clonar o Repositório e Instalar Dependências

```bash
# 1. Clonar o repositório oficial
git clone https://github.com/ThiagoIbrahimVieira/opencrm.git
cd opencrm

# 2. Instalar as dependências do Frontend (raiz)
npm install --legacy-peer-deps

# 3. Instalar as dependências do Backend (pasta server)
cd server
npm install --legacy-peer-deps
cd ..
```

---

### Passo 2: Configuração das Variáveis de Ambiente no Backend

Navegue até a pasta `server/` e crie o arquivo `.env` com base no arquivo de exemplo `.env.example`:

```bash
cd server
cp .env.example .env
```

#### Geração de Chaves Criptográficas Seguras (LGPD)
Gere duas chaves aleatórias de 32 bytes (64 caracteres hexadecimais) utilizando o Node.js:

```bash
node -e "console.log('PII_ENCRYPTION_KEY_HEX=' + crypto.randomBytes(32).toString('hex'))"
node -e "console.log('PII_HMAC_KEY_HEX=' + crypto.randomBytes(32).toString('hex'))"
```

#### Preenchimento do arquivo `server/.env`:
```ini
# Configuração do Servidor
PORT=3333
NODE_ENV=development
APP_ORIGIN=http://localhost:3000

# Conexão com o Banco de Dados (Supabase ou Local)
# Porta 6543 para Transaction Pooler (PgBouncer)
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Porta 5432 para Direct Connection (utilizada em migrações)
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"

# Segredos de Autenticação JWT (mínimo de 32 caracteres)
JWT_ACCESS_SECRET="sua_chave_secreta_jwt_access_muito_longa_e_segura"
JWT_REFRESH_SECRET="sua_chave_secreta_jwt_refresh_muito_longa_e_segura"

# Chaves Criptográficas de Proteção de PII (LGPD)
PII_ENCRYPTION_KEY_HEX="cole_o_hash_hex_gerado_acima"
PII_HMAC_KEY_HEX="cole_o_hash_hex_gerado_acima"

# Google OAuth 2.0 (Opcional para login com Google)
GOOGLE_CLIENT_ID="seu_client_id_google.apps.googleusercontent.com"
```

#### Preenchimento do arquivo `.env.local` no Frontend (raiz):
```ini
VITE_API_URL=http://localhost:3333
VITE_GOOGLE_CLIENT_ID="seu_client_id_google.apps.googleusercontent.com"
```

---

### Passo 3: Executar Migrações e Popular o Banco (Seed Idempotente)

Na pasta `server/`, execute os comandos para compilar os tipos do Prisma, aplicar as migrações SQL e popular o banco com as 3 lojas de demonstração:

```bash
cd server

# 1. Gerar o cliente Prisma
npm run db:generate

# 2. Aplicar a migration completa no banco
npm run db:deploy

# 3. Executar o seed idempotente com as lojas padrão
npm run db:seed
```

#### Contas Pré-configuradas no Seed:
| Loja | Segmento | Usuário Admin | Usuário Vendedor | Senha Padrão |
| :--- | :--- | :--- | :--- | :--- |
| **AuraCell — Jardins** | Celulares & Manutenção (Serializado/IMEI) | `thiago@auracell.com.br` | `camila@auracell.com.br` | `admin123` / `vendedor123` |
| **Sabor & Brasa** | Lanchonete & Hambúrguer (Lotes/Validade) | `chef@saborbrasa.com.br` | — | `admin123` |
| **Atelier Linho** | Roupas & Vestuário (Grade Tamanho/Tecido) | `estilo@atelierlinho.com.br` | — | `admin123` |

---

### Passo 4: Inicializar os Servidores de Desenvolvimento

Abra dois terminais separados:

```bash
# Terminal 1: Iniciar o Backend Fastify (porta 3333)
cd server
npm run dev
```

```bash
# Terminal 2: Iniciar o Frontend Vite (porta 3000)
npm run dev
```

Acesse a aplicação no navegador em: **`http://localhost:3000`**.
