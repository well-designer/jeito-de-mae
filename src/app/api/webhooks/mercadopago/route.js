import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { assinaturaValida, consultarPagamento } from '@/lib/mercadopago';
import { avisarPedidoNovo } from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * O Mercado Pago chama esta rota quando o Pix e pago.
 * Fluxo seguro:
 *  1. confere a assinatura HMAC do cabecalho
 *  2. NAO acredita no corpo da requisicao - consulta a API para saber
 *     o status real do pagamento
 *  3. so entao marca o pedido como pago e avisa a cozinha
 */
export async function POST(request) {
  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const dataId = String(corpo?.data?.id || request.nextUrl.searchParams.get('data.id') || '');
  if (!dataId) return NextResponse.json({ ok: true });

  if (!assinaturaValida({ xSignature, xRequestId, dataId })) {
    console.warn('[webhook] assinatura invalida');
    return NextResponse.json({ erro: 'assinatura invalida' }, { status: 401 });
  }

  const pagamento = await consultarPagamento(dataId);
  if (!pagamento) return NextResponse.json({ ok: true });

  const pedidoId = pagamento.external_reference;
  if (!pedidoId) return NextResponse.json({ ok: true });

  const sb = supabaseAdmin();
  const { data: pedido } = await sb.from('pedidos').select('*').eq('id', pedidoId).maybeSingle();
  if (!pedido) return NextResponse.json({ ok: true });

  if (pagamento.status === 'approved' && pedido.status_pagamento !== 'pago') {
    const { data: atualizado } = await sb
      .from('pedidos')
      .update({
        status_pagamento: 'pago',
        status: pedido.status === 'novo' ? 'preparo' : pedido.status,
        mp_payment_id: String(pagamento.id),
      })
      .eq('id', pedidoId)
      .select()
      .single();

    avisarPedidoNovo(atualizado || pedido).catch(() => {});
  } else if (['cancelled', 'expired', 'rejected'].includes(pagamento.status)) {
    await sb.from('pedidos').update({ status_pagamento: 'expirado' }).eq('id', pedidoId);
  }

  return NextResponse.json({ ok: true });
}
