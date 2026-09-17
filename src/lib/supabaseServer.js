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
export async function exigirAdmin() {
  const supabase = supabaseSSR();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabaseAdmin()
    .from('perfis')
    .select('id, papel')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil || perfil.papel !== 'admin') return null;
  return user;
}
