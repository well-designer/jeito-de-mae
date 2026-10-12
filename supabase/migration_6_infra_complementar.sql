-- Jeito de Mae - infraestrutura complementar v1.5
-- Tabelas auxiliares presentes no banco atual.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  kicker text not null default '',
  titulo text not null,
  texto text not null default '',
  cta text not null default 'Ver cardápio',
  link text not null default '/',
  imagem_url text,
  ativo boolean not null default false,
  prioridade integer not null default 1 check(prioridade between 1 and 3),
  inicio_em timestamptz,
  fim_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Mantida para compatibilidade/historico do fluxo OTP antigo.
-- O fluxo atual de fidelidade usa conta autenticada por e-mail.
create table if not exists public.fidelidade_verificacoes (
  id uuid primary key default gen_random_uuid(),
  telefone text not null,
  codigo_hash text not null,
  tentativas integer not null default 0,
  expira_em timestamptz not null,
  verificado_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists fidelidade_verif_tel_data
  on public.fidelidade_verificacoes(telefone,criado_em desc);

alter table public.push_subscriptions enable row level security;
alter table public.banners enable row level security;
alter table public.fidelidade_verificacoes enable row level security;
