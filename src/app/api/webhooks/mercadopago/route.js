import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  assinaturaValida,
  consultarPagamento,
} from '@/lib/mercadopago';
import { avisarPedidoNovo } from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhook do Mercado Pago - Orders API.
 *
 * Fluxo:
 * 1. recebe a notificacao de Order
 * 2. valida a assinatura do Mercado Pago
 * 3. consulta a Order diretamente na API
 * 4. encontra o pedido pelo external_reference
 * 5. atualiza somente o pagamento
 *
 * IMPORTANTE:
 * O pagamento aprovado NAO muda automaticamente
 * o pedido de "novo" para "preparo".
 * O fluxo da cozinha continua sendo controlado
 * normalmente pelo sistema.
 */
export async function POST(request) {
  const xSignature =
    request.headers.get('x-signature');

  const xRequestId =
    request.headers.get('x-request-id');

  let corpo;

  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------------
  // DIAGNOSTICO TEMPORARIO
  //
  // Precisamos comparar exatamente o que chega na URL
  // com o data.id existente no corpo da notificacao.
  //
  // Nenhuma chave secreta e registrada aqui.
  // ---------------------------------------------------------------

  const dataIdCorpo =
    corpo?.data?.id != null
      ? String(corpo.data.id)
      : '';

  const dataIdQuery =
    request.nextUrl.searchParams.get('data.id') ||
    request.nextUrl.searchParams.get('data_id') ||
    '';

  const queryRecebida =
    Object.fromEntries(
      request.nextUrl.searchParams.entries()
    );

  console.warn(
    '[webhook] diagnostico requisicao recebida',
    {
      pathname:
        request.nextUrl.pathname,

      query:
        queryRecebida,

      dataIdCorpo,

      dataIdQuery,

      action:
        corpo?.action || null,

      type:
        corpo?.type || null,

      liveMode:
        corpo?.live_mode ?? null,

      applicationId:
        corpo?.application_id != null
          ? String(corpo.application_id)
          : null,

      userId:
        corpo?.user_id != null
          ? String(corpo.user_id)
          : null,

      xRequestId,

      temXSignature:
        !!xSignature,
    }
  );

  // ---------------------------------------------------------------
  // Na notificacao de Order, data.id representa o ID da Order.
  // Mantemos, por enquanto, o mesmo comportamento existente:
  // corpo primeiro e query como fallback.
  // ---------------------------------------------------------------

  const dataId = String(
    dataIdCorpo ||
      dataIdQuery ||
      ''
  );

  if (!dataId) {
    return NextResponse.json({
      ok: true,
    });
  }

  // ---------------------------------------------------------------
  // Confere a assinatura da notificacao.
  // ---------------------------------------------------------------

  if (
    !assinaturaValida({
      xSignature,
      xRequestId,
      dataId,
    })
  ) {
    const partesAssinatura = {};

    for (
      const parte of
      String(xSignature || '').split(',')
    ) {
      const indice =
        parte.indexOf('=');

      if (indice === -1) {
        continue;
      }

      const chave =
        parte
          .slice(0, indice)
          .trim();

      const valor =
        parte
          .slice(indice + 1)
          .trim();

      if (chave) {
        partesAssinatura[chave] =
          valor;
      }
    }

    console.warn(
      '[webhook] assinatura invalida',
      {
        dataId,

        dataIdCorpo,

        dataIdQuery,

        xRequestId,

        temXSignature:
          !!xSignature,

        temTs:
          !!partesAssinatura.ts,

        temV1:
          !!partesAssinatura.v1,

        tamanhoV1:
          partesAssinatura.v1?.length ||
          0,

        inicioV1:
          partesAssinatura.v1
            ? partesAssinatura.v1.slice(
                0,
                8
              )
            : null,
      }
    );

    return NextResponse.json(
      {
        erro:
          'assinatura invalida',
      },
      { status: 401 }
    );
  }

  // ---------------------------------------------------------------
  // Nao confiamos apenas no corpo recebido.
  //
  // Consultamos a Order diretamente no Mercado Pago
  // para descobrir o status verdadeiro do pagamento.
  // ---------------------------------------------------------------

  const pagamento =
    await consultarPagamento(dataId);

  if (!pagamento) {
    console.warn(
      '[webhook] Order nao encontrada:',
      dataId
    );

    return NextResponse.json({
      ok: true,
    });
  }

  const pedidoId =
    pagamento.external_reference;

  if (!pedidoId) {
    console.warn(
      '[webhook] Order sem external_reference:',
      dataId
    );

    return NextResponse.json({
      ok: true,
    });
  }

  // ---------------------------------------------------------------
  // Localiza o pedido correspondente.
  // ---------------------------------------------------------------

  const sb = supabaseAdmin();

  const {
    data: pedido,
    error: erroPedido,
  } = await sb
    .from('pedidos')
    .select('*')
    .eq('id', pedidoId)
    .maybeSingle();

  if (erroPedido) {
    console.error(
      '[webhook] buscar pedido:',
      erroPedido
    );

    return NextResponse.json(
      { ok: false },
      { status: 500 }
    );
  }

  if (!pedido) {
    console.warn(
      '[webhook] pedido nao encontrado:',
      pedidoId
    );

    return NextResponse.json({
      ok: true,
    });
  }

  // ---------------------------------------------------------------
  // IDs retornados pelo Mercado Pago.
  // ---------------------------------------------------------------

  const mpOrderId =
    pagamento.order_id
      ? String(pagamento.order_id)
      : String(dataId);

  const mpPaymentId =
    pagamento.id
      ? String(pagamento.id)
      : null;

  // ---------------------------------------------------------------
  // PAGAMENTO APROVADO
  //
  // consultarPagamento() converte "processed"
  // da Orders API para "approved".
  //
  // So avisamos a cozinha quando houver uma
  // transicao real de nao-pago -> pago.
  // Isso evita notificacoes duplicadas.
  // ---------------------------------------------------------------

  if (pagamento.status === 'approved') {
    if (
      pedido.status_pagamento !== 'pago'
    ) {
      const {
        data: atualizado,
        error: erroAtualizacao,
      } = await sb
        .from('pedidos')
        .update({
          status_pagamento: 'pago',

          mp_order_id:
            mpOrderId,

          mp_payment_id:
            mpPaymentId,
        })
        .eq('id', pedidoId)
        .select()
        .single();

      if (erroAtualizacao) {
        console.error(
          '[webhook] marcar como pago:',
          erroAtualizacao
        );

        return NextResponse.json(
          { ok: false },
          { status: 500 }
        );
      }

      // O pedido continua com o status operacional
      // que ja possuia (normalmente "novo").
      //
      // Nao alteramos para "preparo" automaticamente.

      avisarPedidoNovo(
        atualizado || pedido
      ).catch(() => {});
    } else {
      // Mesmo se o pedido ja estiver pago,
      // mantemos os IDs do Mercado Pago sincronizados.

      const atualizacao = {
        mp_order_id:
          mpOrderId,
      };

      if (mpPaymentId) {
        atualizacao.mp_payment_id =
          mpPaymentId;
      }

      await sb
        .from('pedidos')
        .update(atualizacao)
        .eq('id', pedidoId);
    }

    return NextResponse.json({
      ok: true,
    });
  }

  // ---------------------------------------------------------------
  // PAGAMENTO CANCELADO / RECUSADO / EXPIRADO
  // ---------------------------------------------------------------

  if (
    [
      'cancelled',
      'canceled',
      'expired',
      'rejected',
    ].includes(pagamento.status)
  ) {
    const atualizacao = {
      status_pagamento:
        'expirado',

      mp_order_id:
        mpOrderId,
    };

    if (mpPaymentId) {
      atualizacao.mp_payment_id =
        mpPaymentId;
    }

    const {
      error: erroAtualizacao,
    } = await sb
      .from('pedidos')
      .update(atualizacao)
      .eq('id', pedidoId);

    if (erroAtualizacao) {
      console.error(
        '[webhook] pagamento expirado:',
        erroAtualizacao
      );

      return NextResponse.json(
        { ok: false },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  }

  // ---------------------------------------------------------------
  // PAGAMENTO AINDA PENDENTE.
  // ---------------------------------------------------------------

  const atualizacao = {
    mp_order_id:
      mpOrderId,
  };

  if (mpPaymentId) {
    atualizacao.mp_payment_id =
      mpPaymentId;
  }

  const {
    error: erroAtualizacao,
  } = await sb
    .from('pedidos')
    .update(atualizacao)
    .eq('id', pedidoId);

  if (erroAtualizacao) {
    console.error(
      '[webhook] atualizar Order pendente:',
      erroAtualizacao
    );

    return NextResponse.json(
      { ok: false },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
