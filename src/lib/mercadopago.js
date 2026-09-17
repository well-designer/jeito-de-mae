import crypto from 'crypto';

const API = 'https://api.mercadopago.com';

/**
 * Cria uma cobranca Pix dinamica no Mercado Pago.
 * Retorna { id, qrCode (copia e cola), qrCodeBase64, expiraEm }.
 *
 * Importante: o valor vem SEMPRE do preco recalculado no servidor,
 * nunca do que o navegador mandou.
 */
export async function criarPagamentoPix({ valor, descricao, pedidoId, email, nome }) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN nao configurado');

  const expiracao = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

  const res = await fetch(`${API}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Evita cobranca duplicada se a requisicao for repetida
      'X-Idempotency-Key': `pedido-${pedidoId}`,
    },
    body: JSON.stringify({
      transaction_amount: Number(Number(valor).toFixed(2)),
      description: descricao,
      payment_method_id: 'pix',
      external_reference: pedidoId,
      date_of_expiration: expiracao.toISOString(),
      notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/mercadopago`,
      payer: {
        email: email || 'cliente@jeitodemae.com.br',
        first_name: (nome || 'Cliente').split(' ')[0],
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Mercado Pago recusou a cobranca: ${data?.message || res.status}`);
  }

  const tx = data?.point_of_interaction?.transaction_data || {};
  return {
    id: String(data.id),
    qrCode: tx.qr_code || '',
    qrCodeBase64: tx.qr_code_base64 || '',
    expiraEm: data.date_of_expiration || expiracao.toISOString(),
  };
}

/** Consulta o status real de um pagamento (usado pelo webhook). */
export async function consultarPagamento(paymentId) {
  const res = await fetch(`${API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Confere a assinatura do webhook.
 * Sem isso qualquer pessoa poderia chamar a URL e marcar pedido
 * como pago sem ter pagado nada.
 */
export function assinaturaValida({ xSignature, xRequestId, dataId }) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !xSignature) return false;

  const partes = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k?.trim(), v?.trim()];
    })
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const esperado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
