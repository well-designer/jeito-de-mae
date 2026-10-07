import { liberarCreditoFidelidade } from '@/lib/fidelidade';

export async function processarFidelidadePedido(sb,pedido){
  if(!pedido || pedido.status!=='concluido' || pedido.status_pagamento!=='pago') return;
  await liberarCreditoFidelidade(sb,pedido);
}
