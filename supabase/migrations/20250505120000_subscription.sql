-- Subscription columns + idempotensi webhook Midtrans
-- Jalankan di Supabase SQL Editor bila belum otomatis.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS expired_at timestamptz NULL;

COMMENT ON COLUMN public.users.subscription_status IS 'free | premium';
COMMENT ON COLUMN public.users.expired_at IS 'Akhir masa berlaku premium (null jika free atau belum pernah premium).';

CREATE TABLE IF NOT EXISTS public.midtrans_notification_log (
  order_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.midtrans_notification_log IS 'Cegah pemrosesan webhook duplikat Midtrans untuk order_id yang sama.';
