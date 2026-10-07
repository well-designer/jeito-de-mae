-- Jeito de Mae - fidelidade e alinhamento operacional v1.5
-- Estrutura baseada no banco de producao em 2026-10-07.

-- Alinha categorias aceitas pela API de despesas.
alter table public.despesas drop constraint if exists despesas_categoria_check;
alter table public.despesas add constraint despesas_categoria_check
  check (categoria in ('alimentos','carnes','hortifruti','embalagens','bebidas','gas','limpeza','entrega','taxas','marketing','outros'));

-- Completa detalhes de cupons usados pelo banco atual.
alter table public.cupons add column if not exists usos integer not null default 0;
create unique index if not exists cupom_usos_pedido_id_uidx on public.cupom_usos(pedido_id);

create table if not exists public.fidelidade_config (
  id smallint primary key default 1 check (id=1),
  ativo boolean not null default false,
  reais_por_ponto numeric not null default 1 check (reais_por_ponto>0),
  pedido_minimo numeric not null default 0 check (pedido_minimo>=0),
  validade_dias integer check (validade_dias is null or validade_dias>0),
  incluir_taxa_entrega boolean not null default false,
  permitir_com_cupom boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
insert into public.fidelidade_config(id) values(1) on conflict(id) do nothing;

create table if not exists public.fidelidade_recompensas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text not null default '',
  pontos integer not null check(pontos>0),
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create table if not exists public.fidelidade_clientes (
  id uuid primary key default gen_random_uuid(),
  telefone text not null unique,
  nome text not null default '',
  saldo integer not null default 0 check(saldo>=0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  auth_user_id uuid unique,
  email text
);

create table if not exists public.fidelidade_movimentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.fidelidade_clientes(id),
  pedido_id uuid references public.pedidos(id),
  tipo text not null check(tipo in ('credito','resgate','estorno','ajuste')),
  pontos integer not null,
  status text not null default 'pendente' check(status in ('pendente','disponivel','cancelado','expirado')),
  descricao text not null default '',
  expira_em timestamptz,
  criado_em timestamptz not null default now()
);
create unique index if not exists fidelidade_movimentos_credito_pedido_uidx
  on public.fidelidade_movimentos(pedido_id) where pedido_id is not null and tipo='credito';

create table if not exists public.fidelidade_resgates (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.fidelidade_clientes(id),
  recompensa_id uuid not null references public.fidelidade_recompensas(id),
  pontos integer not null check(pontos>0),
  status text not null default 'solicitado' check(status in ('solicitado','utilizado','cancelado')),
  codigo text not null unique,
  criado_em timestamptz not null default now(),
  utilizado_em timestamptz
);

alter table public.fidelidade_config enable row level security;
alter table public.fidelidade_recompensas enable row level security;
alter table public.fidelidade_clientes enable row level security;
alter table public.fidelidade_movimentos enable row level security;
create index if not exists fidelidade_resgates_recompensa_id_idx on public.fidelidade_resgates(recompensa_id);

alter table public.fidelidade_resgates enable row level security;

create or replace function public.liberar_pontos_fidelidade(p_pedido_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_mov public.fidelidade_movimentos%rowtype; v_pedido public.pedidos%rowtype;
begin
 select * into v_pedido from public.pedidos where id=p_pedido_id;
 if not found or v_pedido.status<>'concluido' or v_pedido.status_pagamento<>'pago' then return false; end if;
 select * into v_mov from public.fidelidade_movimentos where pedido_id=p_pedido_id and tipo='credito' for update;
 if not found or v_mov.status<>'pendente' then return false; end if;
 update public.fidelidade_clientes set saldo=saldo+v_mov.pontos, atualizado_em=now() where id=v_mov.cliente_id;
 update public.fidelidade_movimentos set status='disponivel' where id=v_mov.id and status='pendente';
 return true;
end $$;

create or replace function public.cancelar_pontos_fidelidade(p_pedido_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_mov public.fidelidade_movimentos%rowtype;
begin
 select * into v_mov from public.fidelidade_movimentos where pedido_id=p_pedido_id and tipo='credito' for update;
 if not found or v_mov.status in ('cancelado','expirado') then return false; end if;
 if v_mov.status='disponivel' then
  update public.fidelidade_clientes set saldo=greatest(0,saldo-v_mov.pontos), atualizado_em=now() where id=v_mov.cliente_id;
 end if;
 update public.fidelidade_movimentos set status='cancelado',
  descricao=case when descricao='' then 'Pontos cancelados com o pedido' else descricao||' — cancelado' end where id=v_mov.id;
 return true;
end $$;

create or replace function public.resgatar_recompensa_fidelidade(p_cliente_id uuid,p_recompensa_id uuid,p_codigo text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_cliente public.fidelidade_clientes%rowtype; v_rec public.fidelidade_recompensas%rowtype; v_id uuid;
begin
 select * into v_cliente from public.fidelidade_clientes where id=p_cliente_id for update;
 if not found then raise exception 'cliente_nao_encontrado'; end if;
 select * into v_rec from public.fidelidade_recompensas where id=p_recompensa_id and ativo=true;
 if not found then raise exception 'recompensa_indisponivel'; end if;
 if v_cliente.saldo<v_rec.pontos then raise exception 'saldo_insuficiente'; end if;
 update public.fidelidade_clientes set saldo=saldo-v_rec.pontos,atualizado_em=now() where id=p_cliente_id;
 insert into public.fidelidade_movimentos(cliente_id,tipo,pontos,status,descricao) values(p_cliente_id,'resgate',-v_rec.pontos,'disponivel','Resgate: '||v_rec.nome);
 insert into public.fidelidade_resgates(cliente_id,recompensa_id,pontos,codigo) values(p_cliente_id,p_recompensa_id,v_rec.pontos,p_codigo) returning id into v_id;
 return v_id;
end $$;

create or replace function public.utilizar_resgate_fidelidade(p_codigo text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 select id into v_id from public.fidelidade_resgates where upper(codigo)=upper(trim(p_codigo)) and status='solicitado' for update;
 if not found then raise exception 'resgate_indisponivel'; end if;
 update public.fidelidade_resgates set status='utilizado',utilizado_em=now() where id=v_id;
 return v_id;
end $$;

create or replace function public.expirar_pontos_fidelidade()
returns integer language plpgsql security definer set search_path=public as $$
declare v_mov record; v_total integer:=0;
begin
 for v_mov in select id,cliente_id,pontos from public.fidelidade_movimentos
  where tipo='credito' and status='disponivel' and expira_em is not null and expira_em<=now() for update
 loop
  update public.fidelidade_clientes set saldo=greatest(0,saldo-v_mov.pontos),atualizado_em=now() where id=v_mov.cliente_id;
  update public.fidelidade_movimentos set status='expirado' where id=v_mov.id;
  v_total:=v_total+1;
 end loop;
 return v_total;
end $$;

-- Estas funcoes sao internas: apenas o backend com service_role deve executa-las.
revoke all on function public.liberar_pontos_fidelidade(uuid) from public, anon, authenticated;
revoke all on function public.cancelar_pontos_fidelidade(uuid) from public, anon, authenticated;
revoke all on function public.resgatar_recompensa_fidelidade(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.utilizar_resgate_fidelidade(text) from public, anon, authenticated;
revoke all on function public.expirar_pontos_fidelidade() from public, anon, authenticated;
grant execute on function public.liberar_pontos_fidelidade(uuid) to service_role;
grant execute on function public.cancelar_pontos_fidelidade(uuid) to service_role;
grant execute on function public.resgatar_recompensa_fidelidade(uuid,uuid,text) to service_role;
grant execute on function public.utilizar_resgate_fidelidade(text) to service_role;
grant execute on function public.expirar_pontos_fidelidade() to service_role;
