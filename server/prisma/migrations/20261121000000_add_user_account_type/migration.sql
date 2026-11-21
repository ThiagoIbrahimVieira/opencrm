-- =========================================================================
-- MIGRATION: ADD USER ACCOUNT TYPE (INTENT & PROFILE INTEGRITY)
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountType') THEN
    CREATE TYPE "AccountType" AS ENUM ('ADMIN', 'VENDEDOR', 'UNSET');
  END IF;
END
$$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" "AccountType" NOT NULL DEFAULT 'UNSET';
