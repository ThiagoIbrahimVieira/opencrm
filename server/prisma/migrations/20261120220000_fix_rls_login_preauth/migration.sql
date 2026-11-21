-- =========================================================================
-- CORREÇÃO DEFINITIVA RLS SUPABASE POSTGRESQL 17: LOGIN & PRE-AUTH POLICIES
-- =========================================================================

-- 1. Garante que a role opencrm_app e postgres tenham acesso
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'opencrm_app') THEN
    CREATE ROLE opencrm_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    EXECUTE 'GRANT opencrm_app TO postgres';
  END IF;

  EXECUTE format('GRANT opencrm_app TO %I', CURRENT_USER);
END
$$;

GRANT USAGE ON SCHEMA public TO opencrm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO opencrm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO opencrm_app;

-- 2. Tabela users: RLS com acesso seguro para login/cadastro
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_preauth_isolation" ON "users";
DROP POLICY IF EXISTS "users_tenant_isolation" ON "users";
CREATE POLICY "users_preauth_isolation" ON "users"
  FOR ALL
  TO opencrm_app, postgres
  USING (true)
  WITH CHECK (true);

-- 3. Tabela stores: permite leitura/criação pré-auth e isolamento estrito quando tenant definido
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stores" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stores_tenant_isolation" ON "stores";
CREATE POLICY "stores_tenant_isolation" ON "stores"
  FOR ALL
  TO opencrm_app, postgres
  USING (
    NULLIF(current_setting('app.current_store_id', true), '') IS NULL
    OR "id" = NULLIF(current_setting('app.current_store_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.current_store_id', true), '') IS NULL
    OR "id" = NULLIF(current_setting('app.current_store_id', true), '')::uuid
  );

-- 4. Tabela store_memberships: permite consulta de vínculo no login quando app.current_store_id não estiver setado
ALTER TABLE "store_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_memberships" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_memberships_tenant_isolation" ON "store_memberships";
CREATE POLICY "store_memberships_tenant_isolation" ON "store_memberships"
  FOR ALL
  TO opencrm_app, postgres
  USING (
    NULLIF(current_setting('app.current_store_id', true), '') IS NULL
    OR "store_id" = NULLIF(current_setting('app.current_store_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.current_store_id', true), '') IS NULL
    OR "store_id" = NULLIF(current_setting('app.current_store_id', true), '')::uuid
  );

-- 5. Tabela refresh_tokens: permite criação e renovação de token no login
ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_tokens" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "refresh_tokens_tenant_isolation" ON "refresh_tokens";
CREATE POLICY "refresh_tokens_tenant_isolation" ON "refresh_tokens"
  FOR ALL
  TO opencrm_app, postgres
  USING (
    NULLIF(current_setting('app.current_store_id', true), '') IS NULL
    OR "store_id" IS NULL
    OR "store_id" = NULLIF(current_setting('app.current_store_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.current_store_id', true), '') IS NULL
    OR "store_id" IS NULL
    OR "store_id" = NULLIF(current_setting('app.current_store_id', true), '')::uuid
  );

-- 6. Garantir NULLIF seguro em todas as tabelas de negócio restantes
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
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
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO opencrm_app, postgres USING ("store_id" = NULLIF(current_setting(''app.current_store_id'', true), '''')::uuid) WITH CHECK ("store_id" = NULLIF(current_setting(''app.current_store_id'', true), '''')::uuid);', tbl || '_tenant_isolation', tbl);
  END LOOP;
END
$$;
