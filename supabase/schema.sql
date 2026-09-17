-- =====================================================================
--  Jeito de Mae - Delicias Caseiras
--  Rode este arquivo inteiro no SQL Editor do Supabase (uma vez so).
-- =====================================================================

-- ---------- Configuracao da loja (linha unica) -----------------------
create table if not exists public.config (
  id               int primary key default 1 check (id = 1),
  aberto           boolean not null default true,
  prato_do_dia     text default '',
  recado           text default '',
  mensagem_fechado text default 'Hoje nao estamos vendendo. Amanha abrimos a partir das 11h!',
  horario          text default '11h as 15h - Seg a Sab',
  tempo_entrega    text default '40 a 60 min',
  taxa_entrega     numeric(10,2) not null default 0,
  atualizado_em    timestamptz not null default now()
);
insert into public.config (id) values (1) on conflict (id) do nothing;

-- ---------- Cardapio --------------------------------------------------
create table if not exists public.produtos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  descricao text default '',
  categoria text not null,
  opcoes    jsonb not null default '[]'::jsonb,   -- [{"nome":"Grande","preco":36.9}]
  foto_url  text,
  ativo     boolean not null default true,
  destaque  boolean not null default false,
  ordem     int not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists produtos_ordem_idx on public.produtos (ordem);

-- ---------- Pedidos ---------------------------------------------------
create table if not exists public.pedidos (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,
  cliente_nome       text not null,
  cliente_telefone   text not null,
  cliente_endereco   text default '',
  cliente_referencia text default '',
  tipo               text not null default 'entrega',    -- entrega | retirada
  itens              jsonb not null default '[]'::jsonb,
  subtotal           numeric(10,2) not null default 0,
  taxa               numeric(10,2) not null default 0,
  total              numeric(10,2) not null default 0,
  pagamento          text not null default 'pix',        -- pix | dinheiro
  status_pagamento   text not null default 'pendente',   -- pendente | pago | expirado
  status             text not null default 'novo',       -- novo | preparo | entrega | concluido | cancelado
  mp_payment_id      text,
  criado_em          timestamptz not null default now()
);
create index if not exists pedidos_criado_em_idx on public.pedidos (criado_em desc);
create index if not exists pedidos_mp_idx on public.pedidos (mp_payment_id);

-- ---------- Quem pode entrar no painel -------------------------------
create table if not exists public.perfis (
  id    uuid primary key references auth.users (id) on delete cascade,
  nome  text,
  papel text not null default 'admin'
);

-- =====================================================================
--  SEGURANCA: RLS ligado em TUDO e SEM policies.
--  Ninguem le estas tabelas direto do navegador - nem visitante, nem
--  usuario logado. O unico caminho e pelo servidor do Next.js, que usa
--  a service_role key guardada em variavel de ambiente. E isso que
--  impede vazamento de telefone e endereco dos clientes.
-- =====================================================================
alter table public.config   enable row level security;
alter table public.produtos enable row level security;
alter table public.pedidos  enable row level security;
alter table public.perfis   enable row level security;

-- ---------- Storage das fotos (leitura publica, escrita so servidor) --
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

-- ---------- Cardapio inicial de exemplo -------------------------------
insert into public.produtos (nome, descricao, categoria, opcoes, destaque, ordem) values
('Feijoada Completa', 'Feijao preto com carnes selecionadas, arroz, couve refogada, farofa e laranja.', 'Prato do dia',
 '[{"nome":"Individual","preco":26.9},{"nome":"Grande","preco":36.9}]', true, 0),
('File de Frango Grelhado', 'File temperado na hora, arroz, feijao, salada e batata.', 'Grelhados',
 '[{"nome":"Individual","preco":22.9},{"nome":"Grande","preco":29.9}]', false, 1),
('Bisteca Suina Grelhada', 'Bisteca no ponto certo, arroz, feijao, farofa e vinagrete.', 'Grelhados',
 '[{"nome":"Individual","preco":23.9},{"nome":"Grande","preco":31.9}]', false, 2),
('Porcao de Farofa da Casa', 'Farofa de bacon com ovo, do jeitinho de casa.', 'Porcoes',
 '[{"nome":"Porcao","preco":8}]', false, 3),
('Suco Natural', 'Feito na hora: laranja, limao ou maracuja.', 'Bebidas',
 '[{"nome":"300 ml","preco":7},{"nome":"500 ml","preco":10}]', false, 4),
('Refrigerante Lata', 'Gelado, 350 ml.', 'Bebidas',
 '[{"nome":"Lata 350 ml","preco":6}]', false, 5),
('Pudim de Leite', 'Fatia generosa, com calda de caramelo.', 'Sobremesas',
 '[{"nome":"Fatia","preco":9}]', false, 6);
