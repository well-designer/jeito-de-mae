import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request) {
  const user = await exigirAdmin();

  if (!user) {
    return NextResponse.json(
      { erro: 'Não autorizado.' },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const codigo = String(body.codigo || '').trim().toUpperCase();

  if (!/^JM-[0-9A-F]{8}$/.test(codigo)) {
    return NextResponse.json(
      { erro: 'Código de resgate inválido.' },
      { status: 400 }
    );
  }

  const sb = supabaseAdmin();

  const { data: resgate } = await sb
    .from('fidelidade_resgates')
    .select('id,codigo,status,pontos,criado_em,utilizado_em,recompensa_id,cliente_id')
    .eq('codigo', codigo)
    .maybeSingle();

  if (!resgate) {
    return NextResponse.json(
      { erro: 'Código não encontrado.' },
      { status: 404 }
    );
  }

  if (resgate.status !== 'solicitado') {
    return NextResponse.json(
      {
        erro:
          resgate.status === 'utilizado'
            ? 'Este código já foi utilizado.'
            : 'Este resgate não está mais disponível.',
      },
      { status: 409 }
    );
  }

  const [{ data: recompensa }, { data: cliente }] = await Promise.all([
    sb
      .from('fidelidade_recompensas')
      .select('nome,descricao,pontos,produto_id,produtos(id,nome,foto_url,ativo)')
      .eq('id', resgate.recompensa_id)
      .maybeSingle(),
    sb
      .from('fidelidade_clientes')
      .select('nome,email,telefone')
      .eq('id', resgate.cliente_id)
      .maybeSingle(),
  ]);

  const { data: id, error } = await sb.rpc(
    'utilizar_resgate_fidelidade',
    { p_codigo: codigo }
  );

  if (error) {
    const mensagem = String(error.message || '');

    if (mensagem.includes('resgate_indisponivel')) {
      return NextResponse.json(
        { erro: 'Este código já foi utilizado ou cancelado.' },
        { status: 409 }
      );
    }

    console.error('[fidelidade] utilizar resgate:', error);

    return NextResponse.json(
      { erro: 'Não foi possível validar o resgate.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    resgate: {
      id,
      codigo,
      pontos: resgate.pontos,
      recompensa: recompensa || null,
      cliente: cliente
        ? {
            nome: cliente.nome || '',
            email: cliente.email || '',
            telefone: cliente.telefone || '',
          }
        : null,
    },
  });
}
