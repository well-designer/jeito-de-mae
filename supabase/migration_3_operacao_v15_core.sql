-- Jeito de Mae - compatibilidade do nucleo operacional v1.5
-- Seguro para rodar mais de uma vez. Nao remove colunas nem dados.

alter table public.config
  add column if not exists horarios_semana jsonb,
  add column if not exists confirmacao_entrega text not null default 'desativado';

alter table public.produtos
  add column if not exists dias_semana jsonb not null default '["segunda","terca","quarta","quinta","sexta","sabado","domingo"]'::jsonb,
  add column if not exists adicionais jsonb not null default '[]'::jsonb,
  add column if not exists perguntar_talher boolean not null default false;

alter table public.pedidos
  add column if not exists checkout_id uuid,
  add column if not exists cliente_telefone_normalizado text,
  add column if not exists desconto numeric(10,2) not null default 0,
  add column if not exists cupom_codigo text,
  add column if not exists troco_para numeric(10,2),
  add column if not exists mp_order_id text,
  add column if not exists confirmado_em timestamptz,
  add column if not exists preparo_em timestamptz,
  add column if not exists pronto_em timestamptz,
  add column if not exists concluido_em timestamptz,
  add column if not exists entregador_id uuid references auth.users(id) on delete set null,
  add column if not exists saiu_entrega_em timestamptz,
  add column if not exists chegou_entrega_em timestamptz,
  add column if not exists entrega_codigo_necessario boolean not null default false,
  add column if not exists entrega_codigo_hash text,
  add column if not exists entrega_confirmacao_metodo text,
  add column if not exists acompanhamento_token_hash text,
  add column if not exists entrega_codigo_cliente_cifrado text;

create unique index if not exists pedidos_checkout_id_uidx
  on public.pedidos (checkout_id)
  where checkout_id is not null;

create index if not exists pedidos_cliente_telefone_normalizado_idx
  on public.pedidos (cliente_telefone_normalizado);

create index if not exists pedidos_entregador_status_idx
  on public.pedidos (entregador_id, status);

-- Restricoes leves apenas quando ainda nao existem.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'config_confirmacao_entrega_check') then
    alter table public.config add constraint config_confirmacao_entrega_check
      check (confirmacao_entrega in ('desativado','todas','sob_demanda'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedidos_entrega_confirmacao_metodo_check') then
    alter table public.pedidos add constraint pedidos_entrega_confirmacao_metodo_check
      check (entrega_confirmacao_metodo is null or entrega_confirmacao_metodo in ('manual','codigo'));
  end if;
end $$;
