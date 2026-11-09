-- Hardening database. Aman dijalankan berulang kali (idempoten).
-- Dijalankan otomatis setelah "prisma db push" karena trigger dan CHECK constraint
-- tidak dapat dinyatakan di schema.prisma.

-- 1. Saldo tidak boleh negatif (pengaman terakhir selain update bersyarat di aplikasi)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_balance_nonneg') THEN
    ALTER TABLE "Wallet" ADD CONSTRAINT wallet_balance_nonneg CHECK ("balance" >= 0);
  END IF;
END $$;

-- 2. Transaksi berstatus SUCCESS tidak boleh diubah atau dihapus
CREATE OR REPLACE FUNCTION md_block_success_tx_change() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'SUCCESS' THEN
    RAISE EXCEPTION 'Transaksi berstatus SUCCESS tidak boleh diubah atau dihapus (id=%)', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS md_tx_immutable ON "Transaction";
CREATE TRIGGER md_tx_immutable
  BEFORE UPDATE OR DELETE ON "Transaction"
  FOR EACH ROW EXECUTE FUNCTION md_block_success_tx_change();

-- 3. Tabel log bersifat append-only (tanpa UPDATE, DELETE, TRUNCATE)
CREATE OR REPLACE FUNCTION md_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Tabel % bersifat append-only', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS md_webhooklog_append_only ON "WebhookLog";
CREATE TRIGGER md_webhooklog_append_only
  BEFORE UPDATE OR DELETE ON "WebhookLog"
  FOR EACH ROW EXECUTE FUNCTION md_append_only();

DROP TRIGGER IF EXISTS md_webhooklog_no_truncate ON "WebhookLog";
CREATE TRIGGER md_webhooklog_no_truncate
  BEFORE TRUNCATE ON "WebhookLog"
  FOR EACH STATEMENT EXECUTE FUNCTION md_append_only();

DROP TRIGGER IF EXISTS md_adminlog_append_only ON "AdminLog";
CREATE TRIGGER md_adminlog_append_only
  BEFORE UPDATE OR DELETE ON "AdminLog"
  FOR EACH ROW EXECUTE FUNCTION md_append_only();

DROP TRIGGER IF EXISTS md_adminlog_no_truncate ON "AdminLog";
CREATE TRIGGER md_adminlog_no_truncate
  BEFORE TRUNCATE ON "AdminLog"
  FOR EACH STATEMENT EXECUTE FUNCTION md_append_only();
