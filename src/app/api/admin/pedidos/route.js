import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { statusPedidoSchema } from '@/lib/validation';
import { processarFidelidadePedido } from '@/lib/fidelidadePedido';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await exigirAdmin())) {
    return NextResponse.json(
      { erro: 'nao autorizado' },
      { status: 401 }
    );
  }

  const { data } = await supabaseAdmin()
    .from('pedidos')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(120);

  return NextResponse.json({
    pedidos: data || [],
  });
}

export async function PATCH(request) {
  if (!(await exigirAdmin())) {
    return NextResponse.json(
      { erro: 'nao autorizado' },
      { status: 401 }
    );
  }

  const parsed = statusPedidoSchema.safeParse(
    await request.json().catch(() => ({}))
  );

  if (!parsed.success) {
    return NextResponse.json(
      { erro: 'dados invalidos' },
      { status: 400 }
    );
  }

  const { id, ...patch } = parsed.data;

  const sb = supabaseAdmin();

  const { data: atual, error: erroAtual } = await sb
    .from('pedidos')
    .select('id,status,status_pagamento,tipo')
    .eq('id', id)
    .maybeSingle();

  if (erroAtual) {
    console.error('Erro ao consultar pedido:', erroAtual);
    return NextResponse.json(
      { erro: 'falha ao consultar pedido' },
      { status: 500 }
    );
  }

  if (!atual) {
    return NextResponse.json(
      { erro: 'pedido nao encontrado' },
      { status: 404 }
    );
  }

  if (patch.status && patch.status !== atual.status) {
    const transicoes = {
      novo: ['confirmado', 'cancelado'],
      confirmado: ['preparo', 'cancelado'],
      preparo: atual.tipo === 'retirada'
        ? ['pronto_retirada', 'cancelado']
        : ['entrega', 'cancelado'],
      entrega: ['concluido', 'cancelado'],
      pronto_retirada: ['concluido', 'cancelado'],
      concluido: [],
      cancelado: [],
    };

    if (!(transicoes[atual.status] || []).includes(patch.status)) {
      return NextResponse.json(
        { erro: `transicao invalida: ${atual.status} -> ${patch.status}` },
        { status: 409 }
      );
    }

    if (
      ['confirmado', 'preparo', 'entrega', 'pronto_retirada', 'concluido'].includes(patch.status) &&
      atual.pagamento !== 'dinheiro' &&
      atual.status_pagamento !== 'pago'
    ) {
      return NextResponse.json(
        { erro: 'aguarde a confirmacao do pagamento antes de avancar o pedido' },
        { status: 409 }
      );
    }
  }

  /*
   * Registra automaticamente o horario
   * em que cada etapa do pedido aconteceu.
   */
  const agora = new Date().toISOString();

  if (patch.status === 'confirmado') {
    patch.confirmado_em = agora;
  }

  if (patch.status === 'preparo') {
    patch.preparo_em = agora;
  }

  if (
    patch.status === 'entrega' ||
    patch.status === 'pronto_retirada'
  ) {
    patch.pronto_em = agora;
  }

  if (patch.status === 'concluido') {
    patch.concluido_em = agora;
  }

  const { data, error } = await sb
    .from('pedidos')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(
      'Erro ao atualizar pedido:',
      error
    );

    return NextResponse.json(
      { erro: 'falha ao atualizar' },
      { status: 500 }
    );
  }

  await processarFidelidadePedido(supabaseAdmin(), data).catch((erro) => {
    console.error('[fidelidade] processar pedido:', erro);
  });

  return NextResponse.json({
    pedido: data,
  });
}
