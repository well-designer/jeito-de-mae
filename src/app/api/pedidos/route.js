import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { pedidoSchema } from '@/lib/validation';
import { limitar, ipDe } from '@/lib/rateLimit';
import { criarPagamentoPix } from '@/lib/mercadopago';
import { avisarPedidoNovo } from '@/lib/whatsapp';
import { gerarCodigo } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!limitar(`pedido:${ipDe(request)}`, 8, 60_000)) {
    return NextResponse.json(
      { erro: 'Muitas tentativas seguidas. Aguarde um minuto.' },
      { status: 429 }
    );
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Requisicao invalida' }, { status: 400 });
  }

  const parsed = pedidoSchema.safeParse(corpo);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message || 'Dados invalidos' },
      { status: 400 }
    );
  }
  const dados = parsed.data;
  const sb = supabaseAdmin();

  // ---- A loja esta aberta? ------------------------------------------
  const { data: config } = await sb.from('config').select('*').eq('id', 1).single();
  if (!config?.aberto) {
    return NextResponse.json({ erro: 'A loja esta fechada no momento.' }, { status: 409 });
  }

  // ---- Precos SEMPRE recalculados aqui -------------------------------
  // Nunca confie no valor que veio do navegador: qualquer pessoa pode
  // editar o JSON e mandar "feijoada por R$ 1".
  const ids = [...new Set(dados.itens.map((i) => i.produtoId))];
  const { data: produtos, error: erroProd } = await sb
    .from('produtos')
    .select('id, nome, opcoes, ativo')
    .in('id', ids);

  if (erroProd) {
    return NextResponse.json({ erro: 'Falha ao ler o cardapio' }, { status: 500 });
  }

  const itens = [];
  for (const item of dados.itens) {
    const produto = produtos?.find((p) => p.id === item.produtoId);
    if (!produto || produto.ativo === false) {
      return NextResponse.json(
        { erro: 'Um dos itens saiu do cardapio. Revise seu pedido.' },
        { status: 409 }
      );
    }
    const opcao = (produto.opcoes || []).find((o) => o.nome === item.opcao);
    if (!opcao) {
      return NextResponse.json({ erro: 'Opcao indisponivel.' }, { status: 409 });
    }
    itens.push({
      nome: produto.nome,
      opcao: opcao.nome,
      qtd: item.qtd,
      preco: Number(opcao.preco),
      obs: item.obs || '',
    });
  }

  const subtotal = itens.reduce((s, i) => s + i.preco * i.qtd, 0);
  const taxa = dados.tipo === 'retirada' ? 0 : Number(config.taxa_entrega || 0);
  const total = Number((subtotal + taxa).toFixed(2));

  // ---- Grava o pedido -------------------------------------------------
  const { data: pedido, error } = await sb
    .from('pedidos')
    .insert({
      codigo: gerarCodigo(),
      cliente_nome: dados.nome,
      cliente_telefone: dados.telefone,
      cliente_endereco: dados.tipo === 'entrega' ? dados.endereco : '',
      cliente_referencia: dados.tipo === 'entrega' ? dados.referencia : '',
      tipo: dados.tipo,
      itens,
      subtotal,
      taxa,
      total,
      pagamento: dados.pagamento,
      status_pagamento: 'pendente',
      status: 'novo',
    })
    .select()
    .single();

  if (error) {
    console.error('[pedidos] insert:', error);
    return NextResponse.json({ erro: 'Nao foi possivel registrar o pedido' }, { status: 500 });
  }

  // ---- Pix dinamico ---------------------------------------------------
  let pix = null;
  if (dados.pagamento === 'pix') {
    try {
      const cobranca = await criarPagamentoPix({
        valor: total,
        descricao: `Pedido ${pedido.codigo} - Jeito de Mae`,
        pedidoId: pedido.id,
        nome: dados.nome,
      });
      pix = {
        qrCode: cobranca.qrCode,
        qrCodeBase64: cobranca.qrCodeBase64,
        expiraEm: cobranca.expiraEm,
      };
      await sb.from('pedidos').update({ mp_payment_id: cobranca.id }).eq('id', pedido.id);
    } catch (e) {
      console.error('[pedidos] pix:', e);
      return NextResponse.json(
        { erro: 'Pedido registrado, mas o Pix falhou. Fale com a loja.', pedidoId: pedido.id },
        { status: 502 }
      );
    }
  } else {
    // Dinheiro na entrega: ja avisa a cozinha na hora.
    avisarPedidoNovo(pedido).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    pedido: { id: pedido.id, codigo: pedido.codigo, total: pedido.total, tipo: pedido.tipo },
    pix,
  });
}
