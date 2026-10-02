-- Consumer printed-book PDFs: retention marker (privacy review §4.6 / §7.5).
--
-- api/print-orders/pdf-worker.js stores each order's PDFs in the private
-- print-pdfs bucket as <order id>/{interior,cover}.pdf. Until now nothing
-- ever deleted them. Two paths now do:
--   * lib/deleteUser.js purgeUser deletes every order's folder BEFORE the
--     auth delete (print_orders.user_id cascades, so the ids die with it);
--   * api/cron/retention.js (lib/print/orderRetention.js) deletes them 90
--     days after the order reached a final state and stamps this column.
--
-- Apply BEFORE deploying the code that uses it. Idempotent.

alter table public.print_orders
  add column if not exists pdfs_purged_at timestamptz;

-- The nightly job's lookup: final orders not yet purged, oldest first.
create index if not exists idx_print_orders_pdf_retention
  on public.print_orders (updated_at)
  where pdfs_purged_at is null and status in ('shipped','delivered','refunded','failed');
