-- CRM: registro interno de contatos; não comprova envio pelo WhatsApp.
create table if not exists public.crm_contatos (
  id uuid primary key default gen_random_uuid(),
  cliente_chave text not null,
  cliente_nome text not null,
  canal text not null default 'whatsapp',
  tipo text not null default 'atendimento',
  situacao text not null default 'registrado_manualmente',
  observacao text not null default '',
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  constraint crm_contatos_chave_check check (length(cliente_chave) between 5 and 120),
  constraint crm_contatos_observacao_check check (length(observacao) <= 1000)
);
create index if not exists crm_contatos_cliente_idx on public.crm_contatos(cliente_chave, criado_em desc);
alter table public.crm_contatos enable row level security;
-- Nenhuma policy pública. A API usa service_role apenas após conferir papel no servidor.
