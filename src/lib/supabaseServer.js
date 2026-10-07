import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabaseAdmin';

/** Cliente ligado ao cookie de sessao do visitante (login do painel). */
export function supabaseSSR() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => store.get(name)?.value,
        set: (name, value, options) => {
          try { store.set({ name, value, ...options }); } catch {}
        },
        remove: (name, options) => {
          try { store.set({ name, value: '', ...options }); } catch {}
        },
      },
    }
  );
}

/**
 * Porteiro do painel: confirma que existe sessao valida E que o usuario
 * esta na tabela perfis. So ter conta no Supabase nao basta.
 * Retorna o usuario ou null.
 */
const PAPEIS = {
  proprietario: ['admin', 'proprietario'],
  atendente: ['admin', 'proprietario', 'atendente'],
  cozinha: ['admin', 'proprietario', 'cozinha'],
  entregador: ['admin', 'proprietario', 'entregador'],
};

export async function exigirPapel(papeisPermitidos = []) {
  const supabase = supabaseSSR();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabaseAdmin()
    .from('perfis')
    .select('id, papel')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil || !papeisPermitidos.includes(perfil.papel)) return null;
  return { ...user, papel: perfil.papel };
}

/** Compatibilidade: rotas administrativas continuam aceitando o antigo papel admin. */
export async function exigirAdmin() {
  return exigirPapel(PAPEIS.proprietario);
}

export async function exigirAtendimento() {
  return exigirPapel(PAPEIS.atendente);
}

export async function exigirCozinha() {
  return exigirPapel(PAPEIS.cozinha);
}

export async function exigirEntregador() {
  return exigirPapel(PAPEIS.entregador);
}
