import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { pedidoSchema, soDigitos } from '@/lib/validation';
import { limitar, ipDe } from '@/lib/rateLimit';
import { criarPagamentoPix, criarPagamentoCartao } from '@/lib/mercadopago';
import { avisarPedidoNovo } from '@/lib/whatsapp';
import { gerarCodigo } from '@/lib/format';
import { enviarPushNovoPedido } from '@/lib/push';
import { prepararCreditoFidelidade } from '@/lib/fidelidade';


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

/**
 * Verifica o horario REAL de funcionamento da loja.
 *
 * Segunda a sabado:
 * 11:00 ate 15:59.
 *
 * A partir das 16:00 a loja fica fechada.
 * Domingo fica fechado o dia inteiro.
 *
 * O fuso e definido explicitamente porque o servidor da Vercel
 * pode estar executando em UTC.
 */
function dentroDoHorarioDeFuncionamento() {
  const agora = new Date();

  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora);

  const valor = (tipo) =>
    partes.find((parte) => parte.type === tipo)?.value;

  const dia = valor('weekday');
  const hora = Number(valor('hour'));
  const minuto = Number(valor('minute'));

  // Domingo fechado.
  if (dia === 'Sunday') {
    return false;
  }

  // Segunda a sabado: 11:00 ate 16:00.
  const minutosAgora = hora * 60 + minuto;
  const abertura = 11 * 60;
  const fechamento = 16 * 60;

  return minutosAgora >= abertura && minutosAgora < fechamento;
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
  const primeiraFalha = parsed.error.issues[0];

  console.error(
    '[pedidos] validacao:',
    parsed.error.issues
  );

  return NextResponse.json(
    {
      erro: primeiraFalha
        ? `${primeiraFalha.path.join('.') || 'campo'}: ${primeiraFalha.message}`
        : 'Dados invalidos',
    },
    { status: 400 }
  );
}
  
  const dados = parsed.data;
  const sb = supabaseAdmin();

  // -------------------------------------------------------------------
// IDEMPOTENCIA DO CHECKOUT
//
// Se este checkout ja criou um pedido anteriormente,
// nao permitimos criar outro pedido com o mesmo identificador.
// -------------------------------------------------------------------

const {
  data: pedidoExistente,
  error: erroPedidoExistente,
} = await sb
  .from('pedidos')
  .select('id, codigo, subtotal, desconto, cupom_codigo, total, tipo, pagamento, status_pagamento, mp_order_id, mp_payment_id')
  .eq('checkout_id', dados.checkout_id)
  .maybeSingle();

if (erroPedidoExistente) {
  console.error(
    '[pedidos] verificar checkout existente:',
    erroPedidoExistente
  );

  return NextResponse.json(
    {
      erro: 'Nao foi possivel verificar o pedido. Tente novamente.',
    },
    { status: 500 }
  );
}

if (
  pedidoExistente &&
  dados.pagamento === 'dinheiro'
) {
  return NextResponse.json({
    ok: true,
    duplicado: true,
    pedido: {
      id: pedidoExistente.id,
      codigo: pedidoExistente.codigo,
      subtotal: pedidoExistente.subtotal,
      desconto: pedidoExistente.desconto,
      cupom: pedidoExistente.cupom_codigo,
      total: pedidoExistente.total,
      tipo: pedidoExistente.tipo,
    },
  });
}

  // -------------------------------------------------------------------
  // A loja esta aberta?
  //
  // Para aceitar um pedido, DUAS condicoes precisam ser verdadeiras:
  //
  // 1. O botao manual "aberto" precisa estar ligado.
  // 2. Precisamos estar dentro do horario normal da loja.
  //
  // Dessa forma, o botao do Admin continua servindo como fechamento
  // emergencial, mas nao consegue deixar a loja aberta de madrugada.
  // -------------------------------------------------------------------

  const { data: config } = await sb
    .from('config')
    .select('*')
    .eq('id', 1)
    .single();

  const dentroDoHorario = dentroDoHorarioDeFuncionamento();

  if (!config?.aberto || !dentroDoHorario) {
    return NextResponse.json(
      {
        erro:
          config?.mensagem_fechado ||
          'A loja esta fechada no momento.',
      },
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
//
// checkout_id garante que uma mesma tentativa de checkout
// nao consiga criar dois pedidos diferentes.
// -------------------------------------------------------------------

let pedido = null;
let pedidoFoiCriadoAgora = false;

const {
  data: pedidoCriado,
  error: erroInsert,
} = await sb
  .from('pedidos')
  .insert({
    checkout_id: dados.checkout_id,

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

    troco_para:
      dados.pagamento === 'dinheiro' &&
      dados.troco_para !== null &&
      dados.troco_para !== undefined &&
      String(dados.troco_para).trim() !== ''
        ? (() => {
            const bruto = String(dados.troco_para).trim().replace(/\s/g, '').replace(/^R\$/i, '');
            const normalizado = bruto.includes(',')
              ? bruto.replace(/\./g, '').replace(',', '.')
              : bruto;
            const valor = Number(normalizado);
            return Number.isFinite(valor) && valor >= total ? Number(valor.toFixed(2)) : null;
          })()
        : null,

    status_pagamento: 'pendente',

    status: 'novo',
  })
  .select()
  .single();

if (!erroInsert) {
  pedido = pedidoCriado;
  pedidoFoiCriadoAgora = true;
} else if (erroInsert.code === '23505') {
  // Outra requisicao com o mesmo checkout_id
  // conseguiu criar o pedido primeiro.
  //
  // Recuperamos exatamente aquele pedido para evitar
  // a criacao de um segundo pedido.
  const {
    data: pedidoExistenteCheckout,
    error: erroRecuperar,
  } = await sb
    .from('pedidos')
    .select('*')
    .eq('checkout_id', dados.checkout_id)
    .maybeSingle();

  if (erroRecuperar || !pedidoExistenteCheckout) {
    console.error(
      '[pedidos] recuperar checkout duplicado:',
      erroRecuperar || erroInsert
    );

    return NextResponse.json(
      {
        erro:
          'O pedido foi recebido, mas nao foi possivel recupera-lo. Tente novamente.',
      },
      { status: 500 }
    );
  }

  pedido = pedidoExistenteCheckout;

  // Para dinheiro nao existe processamento externo
  // de pagamento a ser retomado.
  if (dados.pagamento === 'dinheiro') {
    return NextResponse.json({
      ok: true,
      duplicado: true,
      pedido: {
        id: pedido.id,
        codigo: pedido.codigo,
        subtotal: pedido.subtotal,
        desconto: pedido.desconto,
        cupom: pedido.cupom_codigo,
        total: pedido.total,
        tipo: pedido.tipo,
      },
    });
  }

  // Pix e cartao continuam abaixo utilizando o MESMO
  // pedido.id. Assim a chave de idempotencia enviada
  // ao Mercado Pago tambem continua sendo a mesma.
} else {
  console.error(
    '[pedidos] insert:',
    erroInsert
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

  if (cupom && pedidoFoiCriadoAgora) {
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
  // Pagamento.
  //
  // IMPORTANTE:
  // "total" aqui ja contem o desconto do cupom.
  //
  // Pix e cartao sao processados pelo Mercado Pago.
  // Dinheiro avisa a cozinha imediatamente.
  // -------------------------------------------------------------------

  let pix = null;
  let cartao = null;

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
        ticketUrl:
          cobranca.ticketUrl || null,
        expiraEm:
          cobranca.expiraEm,
      };

      const {
        error: erroAtualizarPagamento,
      } = await sb
        .from('pedidos')
        .update({
          mp_order_id:
            cobranca.orderId,

          mp_payment_id:
            cobranca.paymentId,
        })
        .eq(
          'id',
          pedido.id
        );

      if (erroAtualizarPagamento) {
        console.error(
          '[pedidos] salvar IDs Pix:',
          erroAtualizarPagamento
        );
      }
    } catch (e) {
      const mensagemErroPix =
        e instanceof Error
          ? e.message
          : String(e);

      console.error(
        '[pedidos] pix:',
        mensagemErroPix
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
  } else if (dados.pagamento === 'credito') {
    try {
      const cobranca =
        await criarPagamentoCartao({
          valor: total,

          pedidoId:
            pedido.id,

          token:
            dados.cartao.token,

          paymentMethodId:
            dados.cartao.payment_method_id,

          paymentTypeId:
            dados.cartao.payment_type_id,

          installments:
            dados.cartao.installments,

          email:
            dados.cartao.email,

          identification:
            dados.cartao.identification,
        });

      const statusAprovado =
        cobranca.status === 'processed' ||
        cobranca.status === 'approved';

      const statusRecusado = [
        'rejected',
        'cancelled',
        'canceled',
        'expired',
      ].includes(cobranca.status);

      const statusPagamento =
        statusAprovado
          ? 'pago'
          : statusRecusado
            ? 'expirado'
            : 'pendente';

      const {
        data: pedidoAtualizado,
        error: erroAtualizarPagamento,
      } = await sb
        .from('pedidos')
        .update({
          mp_order_id:
            cobranca.orderId,

          mp_payment_id:
            cobranca.paymentId,

          status_pagamento:
            statusPagamento,
        })
        .eq(
          'id',
          pedido.id
        )
        .select()
        .single();

      if (erroAtualizarPagamento) {
        console.error(
          '[pedidos] salvar pagamento cartao:',
          erroAtualizarPagamento
        );
      }

      cartao = {
        status:
          cobranca.status,

        statusDetail:
          cobranca.statusDetail,

        aprovado:
          statusAprovado,
      };

      if (statusAprovado) {
        avisarPedidoNovo(
          pedidoAtualizado || {
            ...pedido,
            status_pagamento: 'pago',
          }
        ).catch(() => {});
      }
    } catch (e) {
      console.error(
        '[pedidos] cartao:',
        e
      );

      return NextResponse.json(
        {
          erro:
            'Pedido registrado, mas o pagamento no cartao falhou. Tente novamente ou escolha outra forma de pagamento.',

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

    // ---------------------------------------------------------------
  // Notificacao Push
  //
  // Avisa todos os celulares autorizados que um novo pedido entrou.
  // Uma falha no push nao impede a conclusao do pedido.
  // ---------------------------------------------------------------

  if (pedidoFoiCriadoAgora) {
  prepararCreditoFidelidade(sb,pedido).catch((erro)=>console.error('[pedidos] fidelidade:',erro));
  enviarPushNovoPedido(
    pedido
  ).catch((erro) => {
    console.error(
      '[pedidos] push:',
      erro
    );
  });
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

    cartao,
  });
}
