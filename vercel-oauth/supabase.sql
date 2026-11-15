create table if not exists public.ml_oauth_tokens (
  seller_id text primary key,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.ml_oauth_tokens enable row level security;

-- O backend usa exclusivamente a Service Role Key. Não crie políticas públicas.
