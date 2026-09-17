import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { pedidoSchema, soDigitos } from '@/lib/validation';
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
      {
        erro:
          'Muitas tentativas seguidas. Aguarde um minuto.',
      },
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

    const adicionaisDisponiveis = Array.isArray(
      produto.adicionais
    )
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
  // Calcula subtotal e entrega.
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

  // -------------------------------------------------------------------
  // CUPOM DE DESCONTO
  //
  // O navegador envia apenas o codigo.
  // Todas as regras e o valor real do desconto sao calculados aqui.
  // -------------------------------------------------------------------

  const telefoneNormalizado = soDigitos(
    dados.telefone
  );

  const codigoCupom = String(
    dados.cupom || ''
  )
    .trim()
    .toUpperCase();

  let cupom = null;
  let desconto = 0;

  if (codigoCupom) {
    // ---------------------------------------------------------------
    // Procura o cupom.
    // ---------------------------------------------------------------

    const {
      data: cupomEncontrado,
      error: erroCupom,
    } = await sb
      .from('cupons')
      .select('*')
      .eq('codigo', codigoCupom)
      .maybeSingle();

    if (erroCupom) {
      console.error(
        '[pedidos] cupom:',
        erroCupom
      );

      return NextResponse.json(
        {
          erro:
            'Nao foi possivel validar o cupom.',
        },
        { status: 500 }
      );
    }

    if (!cupomEncontrado) {
      return NextResponse.json(
        { erro: 'Cupom invalido.' },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------
    // Cupom ativo?
    // ---------------------------------------------------------------

    if (!cupomEncontrado.ativo) {
      return NextResponse.json(
        {
          erro:
            'Este cupom nao esta ativo.',
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------
    // Validade.
    // ---------------------------------------------------------------

    const agora = new Date();

    if (
      cupomEncontrado.valido_de &&
      agora < new Date(cupomEncontrado.valido_de)
    ) {
      return NextResponse.json(
        {
          erro:
            'Este cupom ainda nao esta valido.',
        },
        { status: 400 }
      );
    }

    if (
      cupomEncontrado.valido_ate &&
      agora > new Date(cupomEncontrado.valido_ate)
    ) {
      return NextResponse.json(
        {
          erro:
            'Este cupom expirou.',
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------
    // Limite total de utilizacoes.
    //
    // A fonte real para essa verificacao e a tabela cupom_usos.
    // ---------------------------------------------------------------

    if (
      cupomEncontrado.limite_usos !== null
    ) {
      const {
        count,
        error: erroContagem,
      } = await sb
        .from('cupom_usos')
        .select(
          'id',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq(
          'cupom_id',
          cupomEncontrado.id
        );

      if (erroContagem) {
        console.error(
          '[pedidos] contagem cupom:',
          erroContagem
        );

        return NextResponse.json(
          {
            erro:
              'Nao foi possivel validar o limite do cupom.',
          },
          { status: 500 }
        );
      }

      if (
        (count || 0) >=
        Number(cupomEncontrado.limite_usos)
      ) {
        return NextResponse.json(
          {
            erro:
              'Este cupom atingiu o limite de utilizacoes.',
          },
          { status: 400 }
        );
      }
    }

    // ---------------------------------------------------------------
    // Primeira compra.
    //
    // Se o cupom for marcado como "primeira compra",
    // procuramos pedidos anteriores desse telefone.
    //
    // Pedidos cancelados nao impedem o uso.
    // ---------------------------------------------------------------

    if (cupomEncontrado.primeira_compra) {
      const {
        count: comprasAnteriores,
        error: erroHistorico,
      } = await sb
        .from('pedidos')
        .select(
          'id',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq(
          'cliente_telefone_normalizado',
          telefoneNormalizado
        )
        .neq(
          'status',
          'cancelado'
        );

      if (erroHistorico) {
        console.error(
          '[pedidos] primeira compra:',
          erroHistorico
        );

        return NextResponse.json(
          {
            erro:
              'Nao foi possivel validar a primeira compra.',
          },
          { status: 500 }
        );
      }

      if ((comprasAnteriores || 0) > 0) {
        return NextResponse.json(
          {
            erro:
              'Este cupom e exclusivo para a primeira compra.',
          },
          { status: 400 }
        );
      }
    }

    // ---------------------------------------------------------------
    // Calcula o desconto.
    //
    // percentual:
    // subtotal R$ 50 / cupom 10% = R$ 5
    //
    // fixo:
    // subtotal R$ 50 / cupom R$ 5 = R$ 5
    // ---------------------------------------------------------------

    if (
      cupomEncontrado.tipo === 'percentual'
    ) {
      desconto = Number(
        (
          subtotal *
          (
            Number(cupomEncontrado.valor) /
            100
          )
        ).toFixed(2)
      );
    } else if (
      cupomEncontrado.tipo === 'fixo'
    ) {
      desconto = Number(
        Number(
          cupomEncontrado.valor
        ).toFixed(2)
      );
    } else {
      return NextResponse.json(
        {
          erro:
            'Configuracao de cupom invalida.',
        },
        { status: 500 }
      );
    }

    // O desconto nunca pode ficar negativo
    // nem ultrapassar o subtotal dos produtos.
    desconto = Math.min(
      Math.max(desconto, 0),
      subtotal
    );

    cupom = cupomEncontrado;
  }

  // -------------------------------------------------------------------
  // Total final.
  //
  // A taxa de entrega nao recebe desconto.
  //
  // subtotal - desconto + taxa
  // -------------------------------------------------------------------

  const total = Number(
    Math.max(
      0,
      subtotal - desconto + taxa
    ).toFixed(2)
  );

  // -------------------------------------------------------------------
  // Grava o pedido.
  //
  // "itens" ja e JSONB no Supabase, portanto os adicionais e a
  // informacao do talher ficam armazenados junto com cada item.
  // -------------------------------------------------------------------

  const {
    data: pedido,
    error,
  } = await sb
    .from('pedidos')
    .insert({
      codigo: gerarCodigo(),

      cliente_nome: dados.nome,

      // Mantemos o telefone exatamente como foi informado
      // para exibicao no painel.
      cliente_telefone: dados.telefone,

      // E guardamos uma segunda versao somente com numeros
      // para regras como primeira compra.
      cliente_telefone_normalizado:
        telefoneNormalizado,

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

      desconto,

      cupom_codigo:
        cupom
          ? cupom.codigo
          : null,

      total,

      pagamento: dados.pagamento,

      status_pagamento: 'pendente',

      status: 'novo',
    })
    .select()
    .single();

  if (error) {
    console.error(
      '[pedidos] insert:',
      error
    );

    return NextResponse.json(
      {
        erro:
          'Nao foi possivel registrar o pedido',
      },
      { status: 500 }
    );
  }

  // -------------------------------------------------------------------
  // Registra o uso do cupom.
  //
  // Isso acontece somente depois que o pedido realmente foi criado.
  // -------------------------------------------------------------------

  if (cupom) {
    const {
      error: erroUso,
    } = await sb
      .from('cupom_usos')
      .insert({
        cupom_id: cupom.id,
        pedido_id: pedido.id,
        cliente_telefone:
          telefoneNormalizado,
      });

    if (erroUso) {
      console.error(
        '[pedidos] registrar uso cupom:',
        erroUso
      );

      // Se o uso do cupom nao puder ser registrado,
      // removemos o pedido recem-criado.
      //
      // Assim nao deixamos um pedido com desconto sem
      // registrar corretamente a utilizacao.
      await sb
        .from('pedidos')
        .delete()
        .eq('id', pedido.id);

      return NextResponse.json(
        {
          erro:
            'Nao foi possivel registrar o uso do cupom. Tente novamente.',
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------------
    // Atualiza o contador visual "usos" do cupom.
    //
    // A tabela cupom_usos continua sendo a fonte real.
    // ---------------------------------------------------------------

    const {
      count: totalUsos,
      error: erroTotalUsos,
    } = await sb
      .from('cupom_usos')
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'cupom_id',
        cupom.id
      );

    if (!erroTotalUsos) {
      await sb
        .from('cupons')
        .update({
          usos: totalUsos || 0,
        })
        .eq(
          'id',
          cupom.id
        );
    }
  }

  // -------------------------------------------------------------------
  // Pix dinamico.
  //
  // IMPORTANTE:
  // "total" aqui ja contem o desconto do cupom.
  // -------------------------------------------------------------------

  let pix = null;

  if (dados.pagamento === 'pix') {
    try {
      const cobranca =
        await criarPagamentoPix({
          valor: total,

          descricao:
            `Pedido ${pedido.codigo} - Jeito de Mae`,

          pedidoId: pedido.id,

          nome: dados.nome,
        });

      pix = {
        qrCode: cobranca.qrCode,
        qrCodeBase64:
          cobranca.qrCodeBase64,
        expiraEm:
          cobranca.expiraEm,
      };

      await sb
        .from('pedidos')
        .update({
          mp_payment_id:
            cobranca.id,
        })
        .eq(
          'id',
          pedido.id
        );
    } catch (e) {
      console.error(
        '[pedidos] pix:',
        e
      );

      return NextResponse.json(
        {
          erro:
            'Pedido registrado, mas o Pix falhou. Fale com a loja.',

          pedidoId:
            pedido.id,
        },
        { status: 502 }
      );
    }
  } else {
    // Dinheiro na entrega:
    // avisa a cozinha imediatamente.
    avisarPedidoNovo(
      pedido
    ).catch(() => {});
  }

  return NextResponse.json({
    ok: true,

    pedido: {
      id: pedido.id,

      codigo:
        pedido.codigo,

      subtotal:
        pedido.subtotal,

      desconto:
        pedido.desconto,

      cupom:
        pedido.cupom_codigo,

      total:
        pedido.total,

      tipo:
        pedido.tipo,
    },

    pix,
  });
}
