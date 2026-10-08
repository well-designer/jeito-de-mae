import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { limitar, ipDe } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DESTINOS = { admin:'/admin', proprietario:'/admin', atendente:'/atendimento', cozinha:'/cozinha', entregador:'/entregas' };

export async function POST(request) {
  if (!limitar('login-painel:' + ipDe(request), 10, 60_000)) {
    return NextResponse.json({ erro:'Muitas tentativas. Aguarde um minuto.' }, { status:429 });
  }
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim();
  const senha = String(body.senha || '');
  if (!email || !senha) return NextResponse.json({ erro:'Informe e-mail e senha.' }, { status:400 });

  const response = NextResponse.json({ ok:true });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({name,value,options}) => response.cookies.set(name,value,options));
        },
      },
    }
  );
  const { data, error } = await supabase.auth.signInWithPassword({ email, password:senha });
  if (error || !data?.user) return NextResponse.json({ erro:'E-mail ou senha incorretos.' }, { status:401 });

  const {data:perfil,error:erroPerfil} = await supabaseAdmin().from('perfis')
    .select('papel').eq('id',data.user.id).maybeSingle();
  if (erroPerfil || !perfil || !DESTINOS[perfil.papel]) {
    return NextResponse.json({ erro:'Conta autenticada, mas sem permissão operacional. Verifique o perfil com o administrador.' }, { status:403 });
  }
  response.headers.set('Cache-Control','no-store');
  const final = NextResponse.json({ destino:DESTINOS[perfil.papel] });
  response.cookies.getAll().forEach(cookie => final.cookies.set(cookie));
  final.headers.set('Cache-Control','no-store');
  return final;
}
