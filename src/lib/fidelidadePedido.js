import { liberarCreditoFidelidade } from '@/lib/fidelidade';

export async function processarFidelidadePedido(sb, pedido) {
  if (!pedido?.id) return;

  if (pedido.status === 'cancelado') {
    const { error } = await sb.rpc(
      'cancelar_pontos_fidelidade',
      { p_pedido_id: pedido.id }
    );

    if (error) {
      console.error('[fidelidade] cancelar pontos:', error);
    }

    return;
  }

  if (
    pedido.status !== 'concluido' ||
    pedido.status_pagamento !== 'pago'
  ) {
    return;
  }

  await liberarCreditoFidelidade(sb, pedido);
}
