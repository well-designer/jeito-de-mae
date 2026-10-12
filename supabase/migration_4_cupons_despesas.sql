-- Jeito de Mae - cupons e despesas v1.5
-- Seguro para rodar mais de uma vez. Nao remove dados.

create table if not exists public.cupons (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descricao text not null default '',
  tipo text not null,
  valor numeric(10,2) not null,
  primeira_compra boolean not null default false,
  limite_usos integer,
  valido_de timestamptz,
  valido_ate timestamptz,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint cupons_tipo_check check (tipo in ('percentual','fixo')),
  constraint cupons_valor_check check (valor > 0),
  constraint cupons_limite_usos_check check (limite_usos is null or limite_usos > 0)
);

create table if not exists public.cupom_usos (
  id uuid primary key default gen_random_uuid(),
  cupom_id uuid not null references public.cupons(id) on delete restrict,
  pedido_id uuid references public.pedidos(id) on delete set null,
  cliente_telefone text,
  criado_em timestamptz not null default now()
);

create index if not exists cupom_usos_cupom_id_idx on public.cupom_usos(cupom_id);
create index if not exists cupom_usos_pedido_id_idx on public.cupom_usos(pedido_id);

create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria text not null,
  valor numeric(12,2) not null,
  data date not null,
  observacao text not null default '',
  fornecedor text,
  quantidade numeric(12,3),
  unidade text,
  valor_unitario numeric(12,2),
  criado_em timestamptz not null default now()
);

create index if not exists despesas_data_idx on public.despesas(data desc);

alter table public.cupons enable row level security;
alter table public.cupom_usos enable row level security;
alter table public.despesas enable row level security;
