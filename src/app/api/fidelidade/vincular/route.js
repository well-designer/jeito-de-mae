import { createHmac, timingSafeEqual } from 'crypto';
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

  const comprovante = String(body.verificacao || '');
  const [verificacaoId,assinatura] = comprovante.split('.');
  const sb = supabaseAdmin();
  let telefoneConfirmado = false;
  if (/^[0-9a-f-]{36}$/i.test(verificacaoId || '') && /^[0-9a-f]{64}$/i.test(assinatura || '')) {
    const esperado = createHmac('sha256',String(process.env.SUPABASE_SERVICE_ROLE_KEY || ''))
      .update(telefone + '|' + verificacaoId).digest('hex');
    if (timingSafeEqual(Buffer.from(assinatura,'hex'),Buffer.from(esperado,'hex'))) {
      const {data:registro} = await sb.from('fidelidade_verificacoes')
        .select('id,telefone,verificado_em,expira_em')
        .eq('id',verificacaoId).eq('telefone',telefone).maybeSingle();
      telefoneConfirmado = !!registro?.verificado_em &&
        new Date(registro.expira_em).getTime() > Date.now() &&
        Date.now() - new Date(registro.verificado_em).getTime() < 10*60*1000;
    }
  }

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
      (!cliente.email ||
      cliente.email.toLowerCase() !== user.email.toLowerCase()) && !telefoneConfirmado
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

  const { data: vinculado, error: up } = await sb
    .from('fidelidade_clientes')
    .update({
      auth_user_id: user.id,
      email: user.email,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', cliente.id)
    .is('auth_user_id',null)
    .select('id')
    .maybeSingle();

  if (up) {
    return NextResponse.json(
      { erro: 'Não foi possível vincular a fidelidade.' },
      { status: 500 }
    );
  }

  if (!vinculado && cliente.auth_user_id !== user.id) return NextResponse.json({ erro: 'Esta conta já foi vinculada. Atualize a página.' }, { status: 409 });
  return NextResponse.json({ ok: true, email: user.email });
}
