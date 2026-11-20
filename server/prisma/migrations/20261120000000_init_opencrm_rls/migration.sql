-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VENDEDOR');

-- CreateEnum
CREATE TYPE "PrimaryItemStatus" AS ENUM ('DISPONIVEL', 'RESERVADO', 'EM_AVALIACAO', 'VENDIDO', 'ESGOTADO');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ATIVO', 'LEAD', 'INATIVO');

-- CreateTable stores
CREATE TABLE "stores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "template_config" JSONB NOT NULL,
    "catalog_options" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable users (Identidade Global da Pessoa)
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "google_sub" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable store_memberships (Afiliação Pessoa <-> Loja com RBAC)
CREATE TABLE "store_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VENDEDOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "store_id" UUID,
    "family_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable device_models
CREATE TABLE "device_models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "release_year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable primary_items
CREATE TABLE "primary_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "model_id" UUID,
    "title" TEXT NOT NULL,
    "sku_code" TEXT NOT NULL,
    "is_serialized" BOOLEAN NOT NULL DEFAULT true,
    "stock_qty" INTEGER NOT NULL DEFAULT 1 CHECK ("stock_qty" >= 0),
    "imei_1" TEXT,
    "imei_2" TEXT,
    "serial_number" TEXT,
    "storage_gb" TEXT,
    "ram_gb" TEXT,
    "color" TEXT,
    "condition" TEXT,
    "battery_health" INTEGER,
    "battery_cycles" INTEGER,
    "origin_type" TEXT,
    "trade_in_customer_id" UUID,
    "cost_price_cents" INTEGER NOT NULL DEFAULT 0,
    "sale_price_cents" INTEGER NOT NULL DEFAULT 0,
    "status" "PrimaryItemStatus" NOT NULL DEFAULT 'DISPONIVEL',
    "checklist_json" JSONB DEFAULT '[]',
    "custom_attributes" JSONB DEFAULT '{}',
    "expires_at" TIMESTAMP(3),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "primary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable secondary_items
CREATE TABLE "secondary_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "ean" TEXT,
    "brand" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "stock_qty" INTEGER NOT NULL DEFAULT 0 CHECK ("stock_qty" >= 0),
    "min_stock_alert" INTEGER NOT NULL DEFAULT 5,
    "cost_price_cents" INTEGER NOT NULL DEFAULT 0,
    "sale_price_cents" INTEGER NOT NULL DEFAULT 0,
    "custom_attributes" JSONB DEFAULT '{}',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "secondary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable item_compatibilities
CREATE TABLE "item_compatibilities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "secondary_item_id" UUID NOT NULL,
    "device_model_id" UUID,
    "compatible_tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_compatibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable customers
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ATIVO',
    "segment" TEXT DEFAULT 'Varejo',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phone_encrypted" TEXT,
    "phone_last4" TEXT,
    "phone_hmac" TEXT,
    "cpf_encrypted" TEXT,
    "cpf_last4" TEXT,
    "cpf_hmac" TEXT,
    "notes_json" JSONB DEFAULT '[]',
    "city" TEXT,
    "preferred_contact" TEXT DEFAULT 'WhatsApp',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable orders
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "order_code" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "seller_id" UUID,
    "seller_name" TEXT,
    "payment_method" TEXT NOT NULL,
    "warranty_days" INTEGER NOT NULL DEFAULT 90,
    "warranty_expires_at" TIMESTAMP(3),
    "warranty_terms_snapshot" JSONB,
    "public_warranty_token" UUID NOT NULL DEFAULT gen_random_uuid(),
    "idempotency_key" TEXT NOT NULL,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable order_items
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "primary_item_id" UUID,
    "secondary_item_id" UUID,
    "item_title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable stock_ledger
CREATE TABLE "stock_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_label" TEXT NOT NULL,
    "sku" TEXT,
    "delta" INTEGER NOT NULL,
    "resulting_stock" INTEGER,
    "reason" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_name" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable audit_logs
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "store_id" UUID NOT NULL,
    "actor_user_id" TEXT,
    "actor_name" TEXT,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "target_label" TEXT,
    "detail" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata_json" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Unique & Indexes
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

CREATE UNIQUE INDEX "store_memberships_user_id_store_id_key" ON "store_memberships"("user_id", "store_id");
CREATE INDEX "store_memberships_store_id_idx" ON "store_memberships"("store_id");
CREATE INDEX "store_memberships_user_id_idx" ON "store_memberships"("user_id");

CREATE INDEX "refresh_tokens_store_id_idx" ON "refresh_tokens"("store_id");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
CREATE INDEX "device_models_store_id_idx" ON "device_models"("store_id");

CREATE INDEX "primary_items_store_id_status_idx" ON "primary_items"("store_id", "status");
CREATE INDEX "primary_items_store_id_imei_1_idx" ON "primary_items"("store_id", "imei_1");
CREATE INDEX "primary_items_store_id_sku_code_idx" ON "primary_items"("store_id", "sku_code");
CREATE INDEX "primary_items_model_id_idx" ON "primary_items"("model_id");
CREATE INDEX "primary_items_trade_in_customer_id_idx" ON "primary_items"("trade_in_customer_id");
CREATE UNIQUE INDEX "uq_primary_items_store_imei1" ON "primary_items"("store_id", "imei_1") WHERE "imei_1" IS NOT NULL AND "is_serialized" = true;
CREATE INDEX "idx_primary_items_custom_attributes_gin" ON "primary_items" USING gin ("custom_attributes");

CREATE UNIQUE INDEX "secondary_items_store_id_sku_key" ON "secondary_items"("store_id", "sku");
CREATE INDEX "secondary_items_store_id_category_idx" ON "secondary_items"("store_id", "category");
CREATE INDEX "idx_secondary_items_custom_attributes_gin" ON "secondary_items" USING gin ("custom_attributes");

CREATE INDEX "item_compatibilities_store_id_secondary_item_id_idx" ON "item_compatibilities"("store_id", "secondary_item_id");
CREATE INDEX "item_compatibilities_device_model_id_idx" ON "item_compatibilities"("device_model_id");

CREATE INDEX "customers_store_id_status_idx" ON "customers"("store_id", "status");
CREATE INDEX "customers_store_id_phone_hmac_idx" ON "customers"("store_id", "phone_hmac");
CREATE INDEX "customers_store_id_cpf_hmac_idx" ON "customers"("store_id", "cpf_hmac");

CREATE UNIQUE INDEX "orders_public_warranty_token_key" ON "orders"("public_warranty_token");
CREATE UNIQUE INDEX "orders_store_id_idempotency_key_key" ON "orders"("store_id", "idempotency_key");
CREATE INDEX "orders_store_id_customer_id_idx" ON "orders"("store_id", "customer_id");
CREATE INDEX "orders_public_warranty_token_idx" ON "orders"("public_warranty_token");

CREATE INDEX "order_items_store_id_order_id_idx" ON "order_items"("store_id", "order_id");
CREATE INDEX "order_items_primary_item_id_idx" ON "order_items"("primary_item_id");
CREATE INDEX "order_items_secondary_item_id_idx" ON "order_items"("secondary_item_id");
CREATE UNIQUE INDEX "uq_order_items_primary_item_id" ON "order_items"("primary_item_id") WHERE "primary_item_id" IS NOT NULL;

CREATE INDEX "stock_ledger_store_id_created_at_idx" ON "stock_ledger"("store_id", "created_at");
CREATE INDEX "audit_logs_store_id_created_at_idx" ON "audit_logs"("store_id", "created_at");

-- AddForeignKey
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "device_models" ADD CONSTRAINT "device_models_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "primary_items" ADD CONSTRAINT "primary_items_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "primary_items" ADD CONSTRAINT "primary_items_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "device_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "primary_items" ADD CONSTRAINT "primary_items_trade_in_customer_id_fkey" FOREIGN KEY ("trade_in_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "secondary_items" ADD CONSTRAINT "secondary_items_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_compatibilities" ADD CONSTRAINT "item_compatibilities_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_compatibilities" ADD CONSTRAINT "item_compatibilities_secondary_item_id_fkey" FOREIGN KEY ("secondary_item_id") REFERENCES "secondary_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_compatibilities" ADD CONSTRAINT "item_compatibilities_device_model_id_fkey" FOREIGN KEY ("device_model_id") REFERENCES "device_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_primary_item_id_fkey" FOREIGN KEY ("primary_item_id") REFERENCES "primary_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_secondary_item_id_fkey" FOREIGN KEY ("secondary_item_id") REFERENCES "secondary_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================================
-- APPSEC & MULTI-TENANCY: ROLE opencrm_app + REAL ROW-LEVEL SECURITY (RLS)
-- Com correção de permissão segura para o usuário postgres / CURRENT_USER
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'opencrm_app') THEN
    CREATE ROLE opencrm_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;

  -- Garante que a role de conexão (postgres no Supabase ou CURRENT_USER) possa assumir opencrm_app
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    EXECUTE 'GRANT opencrm_app TO postgres';
  END IF;

  EXECUTE format('GRANT opencrm_app TO %I', CURRENT_USER);
END
$$;

GRANT USAGE ON SCHEMA public TO opencrm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO opencrm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO opencrm_app;

-- Force RLS on stores
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stores" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stores_tenant_isolation" ON "stores";
CREATE POLICY "stores_tenant_isolation" ON "stores"
  FOR ALL
  TO opencrm_app
  USING ("id" = NULLIF(current_setting('app.current_store_id', true), '')::uuid)
  WITH CHECK ("id" = NULLIF(current_setting('app.current_store_id', true), '')::uuid);

-- Helper macro for tenant isolation policy on all business tables
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'store_memberships',
    'refresh_tokens',
    'device_models',
    'primary_items',
    'secondary_items',
    'item_compatibilities',
    'customers',
    'orders',
    'order_items',
    'stock_ledger',
    'audit_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_tenant_isolation', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO opencrm_app USING ("store_id" = NULLIF(current_setting(''app.current_store_id'', true), '''')::uuid) WITH CHECK ("store_id" = NULLIF(current_setting(''app.current_store_id'', true), '''')::uuid);', tbl || '_tenant_isolation', tbl);
  END LOOP;
END
$$;

-- =========================================================================
-- POSTGREST HARDENING (Zero Acesso para anon / authenticated)
-- =========================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;

-- =========================================================================
-- LGPD WHITELIST SECURITY DEFINER: Consulta Pública de Garantia
-- =========================================================================

CREATE OR REPLACE FUNCTION get_public_warranty_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'publicToken', o.public_warranty_token,
    'orderCode', o.order_code,
    'storeName', s.name,
    'issuedAt', to_char(o.created_at, 'YYYY-MM-DD'),
    'warrantyExpiresAt', to_char(o.warranty_expires_at, 'YYYY-MM-DD'),
    'warrantyDays', o.warranty_days,
    'daysRemaining', GREATEST(0, EXTRACT(DAY FROM (o.warranty_expires_at - CURRENT_DATE)))::int,
    'percentRemaining', CASE 
      WHEN o.warranty_days <= 0 THEN 0
      ELSE ROUND(LEAST(100, GREATEST(0, (EXTRACT(DAY FROM (o.warranty_expires_at - CURRENT_DATE))::numeric / o.warranty_days::numeric) * 100)))::int
    END,
    'deviceBrand', COALESCE(pi.title, 'Item Principal'),
    'deviceModel', COALESCE(pi.title, 'Item Principal'),
    'deviceStorage', COALESCE(pi.storage_gb, ''),
    'deviceColor', COALESCE(pi.color, ''),
    'deviceCondition', COALESCE(pi.condition, ''),
    'imeiLast4', CASE WHEN pi.imei_1 IS NOT NULL AND length(pi.imei_1) >= 4 THEN RIGHT(pi.imei_1, 4) ELSE '' END,
    'checklist', COALESCE(pi.checklist_json, '[]'::jsonb),
    'accessoriesSummary', (
      SELECT COALESCE(jsonb_agg(oi.item_title), '[]'::jsonb)
      FROM order_items oi
      WHERE oi.order_id = o.id AND oi.secondary_item_id IS NOT NULL
    )
  )
  INTO v_result
  FROM orders o
  JOIN stores s ON o.store_id = s.id
  LEFT JOIN LATERAL (
    SELECT pi.*
    FROM order_items oi
    JOIN primary_items pi ON oi.primary_item_id = pi.id
    WHERE oi.order_id = o.id
    LIMIT 1
  ) pi ON true
  WHERE o.public_warranty_token = p_token;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_public_warranty_by_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_public_warranty_by_token(uuid) TO opencrm_app, postgres;
