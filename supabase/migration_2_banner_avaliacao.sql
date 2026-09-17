-- =====================================================================
--  Migracao 2: banner, avaliacao da loja e preco "de/por"
--  Rode no SQL Editor do Supabase. E aditivo: nao apaga nada que
--  ja existe, so acrescenta colunas novas com valor padrao.
-- =====================================================================

alter table public.config
  add column if not exists banner_url        text,
  add column if not exists nota_media        numeric(2,1),
  add column if not exists total_avaliacoes  int not null default 0;

-- Os precos com desconto ("de: R$40 por: R$25") NAO precisam de coluna
-- nova: ja moram dentro do campo opcoes (jsonb) de cada produto, como
-- uma chave opcional "precoDe". Nada a alterar aqui.
