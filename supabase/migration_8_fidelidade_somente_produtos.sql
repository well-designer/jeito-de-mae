-- Fidelidade: recompensas exclusivamente por produtos
-- A decisao comercial e acumular pontos para trocar por produtos,
-- sem conversao dos pontos em desconto ou dinheiro.
alter table public.fidelidade_recompensas
  drop constraint if exists fidelidade_recompensas_tipo_check;

alter table public.fidelidade_recompensas
  drop column if exists valor_desconto,
  drop column if exists tipo;

comment on column public.fidelidade_recompensas.produto_id is
  'Produto oferecido como recompensa de fidelidade.';