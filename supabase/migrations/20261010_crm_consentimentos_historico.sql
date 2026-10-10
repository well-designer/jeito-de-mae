-- Auditoria atomica de mudancas de preferencia.
create table if not exists public.crm_consentimentos_historico (
 id uuid primary key default gen_random_uuid(),
 cliente_chave text not null,
 status_anterior text,
 status_novo text not null,
 observacao text not null default '',
 alterado_por uuid,
 alterado_em timestamptz not null default now()
);
create index if not exists crm_consentimentos_historico_cliente_idx on public.crm_consentimentos_historico(cliente_chave,alterado_em desc);
alter table public.crm_consentimentos_historico enable row level security;
create or replace function public.crm_registrar_historico_consentimento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
 insert into public.crm_consentimentos_historico(cliente_chave,status_anterior,status_novo,observacao,alterado_por)
 values(new.cliente_chave,case when tg_op='UPDATE' then old.status else null end,new.status,new.observacao,new.atualizado_por);
 return new;
end $$;
drop trigger if exists crm_consentimentos_historico_trigger on public.crm_consentimentos;
create trigger crm_consentimentos_historico_trigger after insert or update on public.crm_consentimentos
for each row execute function public.crm_registrar_historico_consentimento();
