import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { statusPedidoSchema } from '@/lib/validation';

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

  const { data, error } = await supabaseAdmin()
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

  return NextResponse.json({
    pedido: data,
  });
}
