import { createClient } from '@supabase/supabase-js';

/**
 * Cliente com service_role. USO EXCLUSIVO NO SERVIDOR.
 * Ele ignora o RLS, entao nunca importe este arquivo em um
 * componente com "use client".
 */
let cached = null;

export function supabaseAdmin() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase nao configurado (.env)');
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
