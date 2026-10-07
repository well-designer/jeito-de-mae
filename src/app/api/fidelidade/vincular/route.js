import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { soDigitos } from '@/lib/validation';

export async function POST(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) {
    return NextResponse.json(
      { erro: 'Autenticação necessária.' },
      { status: 401 }
    );
  }

  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: { user }, error } = await verifier.auth.getUser(token);

  if (error || !user?.email) {
    return NextResponse.json(
      { erro: 'Sessão inválida.' },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const telefone = soDigitos(body.telefone || '');

  if (telefone.length < 10 || telefone.length > 13) {
    return NextResponse.json(
      { erro: 'WhatsApp inválido.' },
      { status: 400 }
    );
  }

  const sb = supabaseAdmin();

  const { data: cliente } = await sb
    .from('fidelidade_clientes')
    .select('id,auth_user_id,email')
    .eq('telefone', telefone)
    .maybeSingle();

  if (!cliente) {
    return NextResponse.json(
      { erro: 'Ainda não há fidelidade vinculada a este telefone.' },
      { status: 404 }
    );
  }

  if (cliente.auth_user_id && cliente.auth_user_id !== user.id) {
    return NextResponse.json(
      { erro: 'Esta fidelidade já está vinculada a outra conta.' },
      { status: 409 }
    );
  }

  /*
   * Contas antigas podem existir apenas com telefone porque os pontos
   * nascem a partir dos pedidos. Não permitimos que uma conta autenticada
   * reivindique esse saldo apenas por conhecer o número.
   *
   * O vínculo automático só é aceito quando o registro já possui o mesmo
   * e-mail validado pela sessão. Registros sem e-mail ficam preservados
   * para uma migração/verificação administrativa posterior.
   */
  if (
    !cliente.auth_user_id &&
    (
      !cliente.email ||
      cliente.email.toLowerCase() !== user.email.toLowerCase()
    )
  ) {
    return NextResponse.json(
      {
        erro:
          'Este saldo ainda não está vinculado ao seu e-mail. Fale com a loja para validar a conta sem perder seus pontos.',
      },
      { status: 409 }
    );
  }

  const { error: up } = await sb
    .from('fidelidade_clientes')
    .update({
      auth_user_id: user.id,
      email: user.email,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', cliente.id);

  if (up) {
    return NextResponse.json(
      { erro: 'Não foi possível vincular a fidelidade.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, email: user.email });
}
