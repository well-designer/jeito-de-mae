import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) {
    return NextResponse.json({ permitido: false });
  }

  const auth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await auth.auth.getUser(header.slice(7));
  const user = error ? null : data?.user;
  if (!user) return NextResponse.json({ permitido: false });

  const { data: perfil } = await supabaseAdmin()
    .from('perfis')
    .select('papel')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    permitido: ['admin', 'proprietario'].includes(perfil?.papel),
  });
}
