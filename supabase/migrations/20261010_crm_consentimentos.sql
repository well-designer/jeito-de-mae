-- Preferencias de contato promocional separadas dos atendimentos operacionais.
create table if not exists public.crm_consentimentos (
  cliente_chave text primary key,
  cliente_nome text not null,
  status text not null default 'nao_informado'
    check (status in ('nao_informado','autorizado','revogado')),
  origem text not null default 'registro_administrativo',
  observacao text not null default '',
  atualizado_por uuid references auth.users(id),
  atualizado_em timestamptz not null default now(),
  constraint crm_consentimentos_chave_check check (length(cliente_chave) between 5 and 120),
  constraint crm_consentimentos_observacao_check check (length(observacao) <= 1000)
);
alter table public.crm_consentimentos enable row level security;
-- Sem policies publicas. Escrita administrativa via service_role apos validar permissao.
-- Registro administrativo de autorizacao nao equivale a prova verificavel de opt-in.
