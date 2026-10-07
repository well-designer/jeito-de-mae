-- Fidelidade: recompensas tipadas (desconto ou produto)
alter table public.fidelidade_recompensas
  add column if not exists tipo text not null default 'produto',
  add column if not exists valor_desconto numeric(10,2),
  add column if not exists produto_id uuid references public.produtos(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fidelidade_recompensas_tipo_check'
      and conrelid = 'public.fidelidade_recompensas'::regclass
  ) then
    alter table public.fidelidade_recompensas
      add constraint fidelidade_recompensas_tipo_check
      check (tipo in ('desconto','produto'));
  end if;
end $$;

create index if not exists idx_fidelidade_recompensas_produto_id
  on public.fidelidade_recompensas(produto_id)
  where produto_id is not null;

comment on column public.fidelidade_recompensas.tipo is 'Tipo da recompensa: desconto ou produto.';
comment on column public.fidelidade_recompensas.valor_desconto is 'Valor em reais quando tipo=desconto.';
comment on column public.fidelidade_recompensas.produto_id is 'Produto oferecido quando tipo=produto.';