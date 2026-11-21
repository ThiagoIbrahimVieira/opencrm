# 4. Diagrama Entidade-Relacionamento (DER) — OpenCRM

> **Módulo de Documentação Oficial:** Este documento detalha o modelo relacional de dados, chaves primárias, relacionamentos, tipagem e estratégias de indexação GIN/B-Tree do **OpenCRM**.

---

## 1. Diagrama Entidade-Relacionamento Completo (Mermaid)

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
        string account_type "ADMIN | VENDEDOR | UNSET"
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

## 2. Destaques e Otimizações de Esquema

### 2.1 Isolamento RLS por `store_id`
Todas as tabelas do domínio de negócio possuem a chave estrangeira `store_id UUID NOT NULL REFERENCES stores(id)`. Sobre ela atua a política de RLS em nível de banco:
```sql
CREATE POLICY store_isolation_policy ON primary_items
  FOR ALL
  USING (store_id = current_setting('app.current_store_id')::uuid);
```

### 2.2 Estratégia de Indexação GIN em `custom_attributes`
Para garantir consultas instantâneas dentro das propriedades dinâmicas do JSONB de cada segmento (ex: IMEI, grade de cores, tamanho de vestuário ou lote de alimentos):
```sql
CREATE INDEX idx_primary_items_custom_attributes 
  ON primary_items USING GIN (custom_attributes);

CREATE INDEX idx_secondary_items_custom_attributes 
  ON secondary_items USING GIN (custom_attributes);
```

### 2.3 Livro Razão de Estoque (`stock_ledger`)
A cada venda, reposição, ajuste ou devolução, o sistema grava um registro imutável no `stock_ledger` contendo o `delta` (ex: `-1`, `+5`) e o `resulting_stock`. Isso possibilita auditoria contábil completa de qualquer divergência física de inventário.
