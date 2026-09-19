import crypto from 'crypto';

const API = 'https://api.mercadopago.com';

/**
 * Retorna o Access Token privado do Mercado Pago.
 *
 * IMPORTANTE:
 * Esta variável existe somente no servidor.
 * Nunca deve ser enviada para o navegador.
 */
function accessToken() {
  const token = process.env.MP_ACCESS_TOKEN;

  if (!token) {
    throw new Error('MP_ACCESS_TOKEN nao configurado');
  }

  return token;
}


/**
 * Converte valores monetários para o formato esperado
 * pela Orders API do Mercado Pago.
 *
 * Exemplo:
 * 50 -> "50.00"
 */
function valorMP(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error('Valor de pagamento invalido');
  }

  return numero.toFixed(2);
}


/**
 * Faz uma requisição autenticada para a API do Mercado Pago.
 */
async function requisicaoMercadoPago(
  caminho,
  {
    method = 'GET',
    body = null,
    idempotencyKey = null,
  } = {}
) {
  const headers = {
    Authorization: `Bearer ${accessToken()}`,
    'Content-Type': 'application/json',
  };

  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  const resposta = await fetch(`${API}${caminho}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  let dados = null;

  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    console.error(
      '[mercadopago] erro:',
      resposta.status,
      dados
    );

    const mensagem =
      dados?.message ||
      dados?.error ||
      dados?.cause?.[0]?.description ||
      `HTTP ${resposta.status}`;

    throw new Error(
      `Mercado Pago recusou a requisicao: ${mensagem}`
    );
  }

  return dados;
}


/**
 * Retorna o primeiro pagamento existente dentro
 * de uma Order.
 */
function primeiroPagamento(ordem) {
  const pagamentos = ordem?.transactions?.payments;

  if (
    !Array.isArray(pagamentos) ||
    pagamentos.length === 0
  ) {
    return null;
  }

  return pagamentos[0];
}


/**
 * Procura os dados do Pix na resposta da Orders API.
 *
 * A função é propositalmente tolerante porque alguns campos
 * podem aparecer dentro de payment_method ou diretamente
 * no pagamento dependendo da resposta da API.
 */
function dadosPixDaOrdem(ordem) {
  const pagamento = primeiroPagamento(ordem) || {};
  const metodo = pagamento?.payment_method || {};

  const qrCode =
    metodo?.qr_code ||
    pagamento?.qr_code ||
    ordem?.qr_code ||
    '';

  const qrCodeBase64 =
    metodo?.qr_code_base64 ||
    pagamento?.qr_code_base64 ||
    ordem?.qr_code_base64 ||
    '';

  const ticketUrl =
    metodo?.ticket_url ||
    pagamento?.ticket_url ||
    ordem?.ticket_url ||
    '';

  return {
    qrCode,
    qrCodeBase64,
    ticketUrl,
  };
}


/**
 * Cria uma Order Pix usando a nova Orders API.
 *
 * Endpoint:
 * POST /v1/orders
 *
 * O valor recebido aqui já deve ter sido recalculado
 * e validado pelo servidor da loja.
 */
export async function criarPagamentoPix({
  valor,
  descricao,
  pedidoId,
  email,
  nome,
}) {
  const total = valorMP(valor);

  const body = {
    type: 'online',
    total_amount: total,
    external_reference: String(pedidoId),
    processing_mode: 'automatic',

    transactions: {
      payments: [
        {
          amount: total,

          payment_method: {
            id: 'pix',
            type: 'bank_transfer',
          },
        },
      ],
    },

    payer: {
      email:
        email ||
        'cliente@jeitodemae.com.br',
    },
  };

  /*
   * descricao e nome continuam sendo aceitos pela função
   * porque o restante do projeto já os envia.
   *
   * Não incluímos campos não documentados dentro da Order.
   */
  void descricao;
  void nome;

  const ordem =
    await requisicaoMercadoPago(
      '/v1/orders',
      {
        method: 'POST',
        body,

        /*
         * Se a mesma requisição for repetida,
         * o Mercado Pago não deverá criar outra cobrança.
         */
        idempotencyKey:
          `pix-${pedidoId}`,
      }
    );

  const pagamento =
    primeiroPagamento(ordem);

  const pix =
    dadosPixDaOrdem(ordem);

  if (!ordem?.id) {
    throw new Error(
      'Mercado Pago nao retornou o ID da Order'
    );
  }

  if (
    !pix.qrCode &&
    !pix.qrCodeBase64
  ) {
    console.error(
      '[mercadopago] Order Pix sem QR Code:',
      ordem
    );

    throw new Error(
      'Mercado Pago nao retornou o QR Code do Pix'
    );
  }

  return {
    /*
     * id continua representando o pagamento para manter
     * compatibilidade temporária com o código antigo.
     */
    id: pagamento?.id
      ? String(pagamento.id)
      : String(ordem.id),

    paymentId: pagamento?.id
      ? String(pagamento.id)
      : null,

    orderId:
      String(ordem.id),

    qrCode:
      pix.qrCode,

    qrCodeBase64:
      pix.qrCodeBase64,

    ticketUrl:
      pix.ticketUrl,

    expiraEm:
      pagamento?.date_of_expiration ||
      pagamento?.expiration_time ||
      ordem?.expiration_time ||
      null,

    ordem,
  };
}


/**
 * Cria uma Order de cartão.
 *
 * IMPORTANTE:
 *
 * O navegador NÃO envia número do cartão nem CVV
 * para esta função.
 *
 * O Card Payment Brick do Mercado Pago gera um token
 * seguro no navegador.
 *
 * Somente esse token chega ao nosso servidor.
 */
export async function criarPagamentoCartao({
  valor,
  pedidoId,
  token,
  paymentMethodId,
  paymentTypeId,
  installments,
  email,
  identification,
}) {
  const total =
    valorMP(valor);

  if (!token) {
    throw new Error(
      'Token do cartao nao informado'
    );
  }

  if (!paymentMethodId) {
    throw new Error(
      'Meio de pagamento do cartao nao informado'
    );
  }

  const parcelas =
    Number(installments || 1);

  if (
    !Number.isInteger(parcelas) ||
    parcelas < 1 ||
    parcelas > 24
  ) {
    throw new Error(
      'Numero de parcelas invalido'
    );
  }

  const pagamento = {
    amount: total,

    payment_method: {
      id:
        String(paymentMethodId),

      type:
        paymentTypeId
          ? String(paymentTypeId)
          : 'credit_card',

      token:
        String(token),

      installments:
        parcelas,
    },
  };

  const payer = {
    email:
      email ||
      'cliente@jeitodemae.com.br',
  };

  /*
   * O Brick pode retornar CPF/CNPJ do pagador.
   * Enviamos somente se os campos necessários existirem.
   */
  if (
    identification?.type &&
    identification?.number
  ) {
    payer.identification = {
      type:
        String(
          identification.type
        ),

      number:
        String(
          identification.number
        ),
    };
  }

  const body = {
    type: 'online',
    total_amount: total,
    external_reference:
      String(pedidoId),
    processing_mode:
      'automatic',

    transactions: {
      payments: [
        pagamento,
      ],
    },

    payer,
  };

  const ordem =
    await requisicaoMercadoPago(
      '/v1/orders',
      {
        method: 'POST',
        body,

        idempotencyKey:
          `cartao-${pedidoId}`,
      }
    );

  const pagamentoCriado =
    primeiroPagamento(ordem);

  if (!ordem?.id) {
    throw new Error(
      'Mercado Pago nao retornou o ID da Order'
    );
  }

  return {
    orderId:
      String(ordem.id),

    paymentId:
      pagamentoCriado?.id
        ? String(
            pagamentoCriado.id
          )
        : null,

    status:
      pagamentoCriado?.status ||
      ordem?.status ||
      null,

    statusDetail:
      pagamentoCriado?.status_detail ||
      ordem?.status_detail ||
      null,

    ordem,
  };
}


/**
 * Consulta uma Order diretamente no Mercado Pago.
 *
 * Usaremos esta função principalmente no webhook.
 *
 * Nunca confiamos somente nos dados recebidos pelo webhook:
 * após receber a notificação, consultamos a API oficial.
 */
export async function consultarOrdem(
  orderId
) {
  if (!orderId) {
    return null;
  }

  try {
    return await requisicaoMercadoPago(
      `/v1/orders/${encodeURIComponent(
        String(orderId)
      )}`
    );
  } catch (erro) {
    console.error(
      '[mercadopago] consultar Order:',
      erro
    );

    return null;
  }
}


/**
 * Compatibilidade temporária com o webhook antigo.
 *
 * Agora o identificador recebido deve ser o ID da Order.
 *
 * Retornamos uma estrutura semelhante à antiga para que
 * possamos migrar os arquivos em etapas sem deixar o projeto
 * quebrado entre um deploy e outro.
 */
export async function consultarPagamento(
  orderId
) {
  const ordem =
    await consultarOrdem(orderId);

  if (!ordem) {
    return null;
  }

  const pagamento =
    primeiroPagamento(ordem);

  /*
   * Na Orders API o estado pode estar tanto na Order
   * quanto na transação de pagamento.
   */
  let status =
    pagamento?.status ||
    ordem?.status ||
    null;

  /*
   * O código antigo reconhecia "approved".
   * Caso a Orders API informe o pagamento como "processed",
   * normalizamos somente para compatibilidade durante
   * esta migração.
   */
  if (status === 'processed') {
    status = 'approved';
  }

  return {
    id:
      pagamento?.id
        ? String(pagamento.id)
        : String(ordem.id),

    order_id:
      String(ordem.id),

    external_reference:
      ordem?.external_reference ||
      pagamento?.external_reference ||
      null,

    status,

    status_detail:
      pagamento?.status_detail ||
      ordem?.status_detail ||
      null,

    order:
      ordem,
  };
}


/**
 * Valida a assinatura enviada pelo webhook do Mercado Pago.
 *
 * Esta versão também realiza um diagnóstico temporário
 * para descobrirmos exatamente qual formato de manifesto
 * corresponde à assinatura recebida.
 *
 * Nenhuma chave secreta é exibida nos logs.
 */
export function assinaturaValida({
  xSignature,
  xRequestId,
  dataId,
}) {
  const secret =
    process.env.MP_WEBHOOK_SECRET;

  if (
    !secret ||
    !xSignature ||
    !xRequestId ||
    !dataId
  ) {
    return false;
  }

  const partes = {};

  for (
    const parte of
    String(xSignature).split(',')
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
      partes[chave] = valor;
    }
  }

  const ts =
    partes.ts;

  const v1 =
    partes.v1;

  if (!ts || !v1) {
    return false;
  }

  const idOriginal =
    String(dataId);

  const idMinusculo =
    idOriginal.toLowerCase();

  const requestId =
    String(xRequestId);

  /*
   * Testamos algumas composições possíveis do manifesto.
   *
   * Isso é apenas diagnóstico.
   * Continuamos aceitando o webhook somente se o HMAC
   * calculado for exatamente igual ao recebido.
   */
  const variantes = {
    original:
      `id:${idOriginal};` +
      `request-id:${requestId};` +
      `ts:${ts};`,

    minusculo:
      `id:${idMinusculo};` +
      `request-id:${requestId};` +
      `ts:${ts};`,

    originalSemRequestId:
      `id:${idOriginal};` +
      `ts:${ts};`,

    minusculoSemRequestId:
      `id:${idMinusculo};` +
      `ts:${ts};`,
  };

  const recebido =
    String(v1)
      .trim()
      .toLowerCase();

  const resultados = {};

  for (
    const [nome, manifest]
    of Object.entries(variantes)
  ) {
    const calculado =
      crypto
        .createHmac(
          'sha256',
          secret
        )
        .update(manifest)
        .digest('hex');

    resultados[nome] =
      calculado === recebido;
  }

  console.warn(
    '[mercadopago] diagnostico assinatura',
    {
      dataId:
        idOriginal,

      xRequestId:
        requestId,

      resultados,
    }
  );

  /*
   * Não ignoramos a segurança durante o diagnóstico.
   *
   * O webhook somente será aceito caso pelo menos uma
   * das assinaturas calculadas corresponda exatamente
   * à assinatura recebida do Mercado Pago.
   */
  return Object
    .values(resultados)
    .some(
      (resultado) =>
        resultado === true
    );
}
