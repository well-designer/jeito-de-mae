import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { pedidoSchema } from '@/lib/validation';
import { limitar, ipDe } from '@/lib/rateLimit';
import { criarPagamentoPix } from '@/lib/mercadopago';
import { avisarPedidoNovo } from '@/lib/whatsapp';
import { gerarCodigo } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Retorna o dia atual no horario de Sao Paulo.
 *
 * Usamos Intl em vez do horario direto do servidor porque a Vercel
 * pode executar em UTC. Assim o cardapio muda no dia correto para a loja.
 */
function diaAtualSaoPaulo() {
  const nomeDia = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  const mapa = {
    Monday: 'segunda',
    Tuesday: 'terca',
    Wednesday: 'quarta',
    Thursday: 'quinta',
    Friday: 'sexta',
    Saturday: 'sabado',
    Sunday: 'domingo',
  };

  return mapa[nomeDia];
}

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
    return NextResponse.json(
      { erro: 'Requisicao invalida' },
      { status: 400 }
    );
  }

  const parsed = pedidoSchema.safeParse(corpo);

  if (!parsed.success) {
    return NextResponse.json(
      {
        erro:
          parsed.error.issues[0]?.message ||
          'Dados invalidos',
      },
      { status: 400 }
    );
  }

  const dados = parsed.data;
  const sb = supabaseAdmin();

  // -------------------------------------------------------------------
  // A loja esta aberta?
  // -------------------------------------------------------------------

  const { data: config } = await sb
    .from('config')
    .select('*')
    .eq('id', 1)
    .single();

  if (!config?.aberto) {
    return NextResponse.json(
      { erro: 'A loja esta fechada no momento.' },
      { status: 409 }
    );
  }

  // -------------------------------------------------------------------
  // Busca os produtos reais no banco.
  //
  // Nunca confiamos em preco enviado pelo navegador.
  // -------------------------------------------------------------------

  const ids = [
    ...new Set(
      dados.itens.map((item) => item.produtoId)
    ),
  ];

  const { data: produtos, error: erroProd } = await sb
    .from('produtos')
    .select(
      'id, nome, opcoes, ativo, dias_semana, adicionais, perguntar_talher'
    )
    .in('id', ids);

  if (erroProd) {
    console.error('[pedidos] produtos:', erroProd);

    return NextResponse.json(
      { erro: 'Falha ao ler o cardapio' },
      { status: 500 }
    );
  }

  const diaAtual = diaAtualSaoPaulo();

  const itens = [];

  // -------------------------------------------------------------------
  // Valida cada item do carrinho.
  // -------------------------------------------------------------------

  for (const item of dados.itens) {
    const produto = produtos?.find(
      (p) => p.id === item.produtoId
    );

    if (!produto || produto.ativo === false) {
      return NextResponse.json(
        {
          erro:
            'Um dos itens saiu do cardapio. Revise seu pedido.',
        },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------------
    // Verifica se o produto pertence ao cardapio de hoje.
    // ---------------------------------------------------------------

    const diasProduto = Array.isArray(produto.dias_semana)
      ? produto.dias_semana
      : [];

    if (!diasProduto.includes(diaAtual)) {
      return NextResponse.json(
        {
          erro: `${produto.nome} nao esta disponivel no cardapio de hoje.`,
        },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------------
    // Confere tamanho/opcao e pega o preco verdadeiro.
    // ---------------------------------------------------------------

    const opcao = (produto.opcoes || []).find(
      (o) => o.nome === item.opcao
    );

    if (!opcao) {
      return NextResponse.json(
        { erro: 'Opcao indisponivel.' },
        { status: 409 }
      );
    }

    const precoBase = Number(opcao.preco);

    if (!Number.isFinite(precoBase)) {
      return NextResponse.json(
        { erro: 'Preco do produto invalido.' },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------------
    // Valida adicionais.
    //
    // O navegador manda apenas os nomes escolhidos.
    // O servidor encontra os precos verdadeiros no cadastro.
    // ---------------------------------------------------------------

    const adicionaisDisponiveis = Array.isArray(produto.adicionais)
      ? produto.adicionais
      : [];

    const nomesAdicionais = Array.isArray(item.adicionais)
      ? item.adicionais
      : [];

    // Evita que o mesmo adicional seja enviado varias vezes
    // artificialmente na requisicao.
    const nomesUnicos = [...new Set(nomesAdicionais)];

    const adicionaisEscolhidos = [];

    for (const nomeAdicional of nomesUnicos) {
      const adicional = adicionaisDisponiveis.find(
        (a) => a.nome === nomeAdicional
      );

      if (!adicional) {
        return NextResponse.json(
          {
            erro: `Um adicional de ${produto.nome} nao esta mais disponivel.`,
          },
          { status: 409 }
        );
      }

      const precoAdicional = Number(adicional.preco);

      if (!Number.isFinite(precoAdicional)) {
        return NextResponse.json(
          { erro: 'Preco de adicional invalido.' },
          { status: 500 }
        );
      }

      adicionaisEscolhidos.push({
        nome: adicional.nome,
        preco: precoAdicional,
      });
    }

    // ---------------------------------------------------------------
    // Talher descartavel.
    // ---------------------------------------------------------------

    let talher = null;

    if (produto.perguntar_talher) {
      if (typeof item.talher !== 'boolean') {
        return NextResponse.json(
          {
            erro: `Informe se deseja talher descartavel para ${produto.nome}.`,
          },
          { status: 400 }
        );
      }

      talher = item.talher;
    }

    // ---------------------------------------------------------------
    // Calcula o valor unitario:
    // produto + adicionais.
    // ---------------------------------------------------------------

    const totalAdicionais = adicionaisEscolhidos.reduce(
      (soma, adicional) =>
        soma + Number(adicional.preco),
      0
    );

    const precoUnitario = Number(
      (precoBase + totalAdicionais).toFixed(2)
    );

    itens.push({
      nome: produto.nome,
      opcao: opcao.nome,
      qtd: item.qtd,

      // Preco final unitario incluindo os adicionais.
      preco: precoUnitario,

      // Tambem guardamos o preco original para facilitar
      // a exibicao no painel e historico do pedido.
      preco_base: precoBase,

      adicionais: adicionaisEscolhidos,

      talher,

      obs: item.obs || '',
    });
  }

  // -------------------------------------------------------------------
  // Calcula subtotal, entrega e total.
  // -------------------------------------------------------------------

  const subtotal = Number(
    itens
      .reduce(
        (soma, item) =>
          soma + item.preco * item.qtd,
        0
      )
      .toFixed(2)
  );

  const taxa =
    dados.tipo === 'retirada'
      ? 0
      : Number(config.taxa_entrega || 0);

  const total = Number(
    (subtotal + taxa).toFixed(2)
  );

  // -------------------------------------------------------------------
  // Grava o pedido.
  //
  // "itens" ja e JSONB no Supabase, portanto os adicionais e a
  // informacao do talher ficam armazenados junto com cada item.
  // -------------------------------------------------------------------

  const { data: pedido, error } = await sb
    .from('pedidos')
    .insert({
      codigo: gerarCodigo(),

      cliente_nome: dados.nome,
      cliente_telefone: dados.telefone,

      cliente_endereco:
        dados.tipo === 'entrega'
          ? dados.endereco
          : '',

      cliente_referencia:
        dados.tipo === 'entrega'
          ? dados.referencia
          : '',

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

    return NextResponse.json(
      {
        erro:
          'Nao foi possivel registrar o pedido',
      },
      { status: 500 }
    );
  }

  // -------------------------------------------------------------------
  // Pix dinamico.
  // -------------------------------------------------------------------

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

      await sb
        .from('pedidos')
        .update({
          mp_payment_id: cobranca.id,
        })
        .eq('id', pedido.id);
    } catch (e) {
      console.error('[pedidos] pix:', e);

      return NextResponse.json(
        {
          erro:
            'Pedido registrado, mas o Pix falhou. Fale com a loja.',
          pedidoId: pedido.id,
        },
        { status: 502 }
      );
    }
  } else {
    // Dinheiro na entrega:
    // avisa a cozinha imediatamente.
    avisarPedidoNovo(pedido).catch(() => {});
  }

  return NextResponse.json({
    ok: true,

    pedido: {
      id: pedido.id,
      codigo: pedido.codigo,
      total: pedido.total,
      tipo: pedido.tipo,
    },

    pix,
  });
}
