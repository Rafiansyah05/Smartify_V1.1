-- Jalankan di Supabase SQL Editor jika migrasi CLI belum dipakai.
-- Menyimpan hash token reset password (bukan token mentah).

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens (user_id);

COMMENT ON TABLE public.password_reset_tokens IS 'Token hash untuk alur lupa password; diisi hanya dari server (service role).';
