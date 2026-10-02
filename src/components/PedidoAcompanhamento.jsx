'use client';

import { useEffect, useMemo, useState } from 'react';

const ORDEM = ['novo', 'confirmado', 'preparo', 'saiu_entrega', 'concluido'];

function normalizar(status) {
  const s = String(status || '').toLowerCase();
  if (['novo','pendente','recebido'].includes(s)) return 'novo';
  if (['confirmado','aceito'].includes(s)) return 'confirmado';
  if (['preparo','preparando','em_preparo'].includes(s)) return 'preparo';
  if (['saiu_entrega','saiu_para_entrega','entrega'].includes(s)) return 'saiu_entrega';
  if (['concluido','entregue','finalizado'].includes(s)) return 'concluido';
  if (s === 'cancelado') return 'cancelado';
  return 'novo';
}

export default function PedidoAcompanhamento({ pedidoInicial }) {
  const [pedido, setPedido] = useState(pedidoInicial);
  const status = normalizar(pedido.status);
  const retirada = pedido.tipo === 'retirada';

  useEffect(() => {
    if (!pedido?.id || ['concluido','cancelado'].includes(status)) return;
    let ativo = true;
    const atualizar = async () => {
      try {
        const r = await fetch(`/api/pedidos/status?id=${encodeURIComponent(pedido.id)}&t=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (ativo) setPedido((p) => ({ ...p, ...d }));
      } catch {}
    };
    atualizar();
    const t = setInterval(atualizar, 5000);
    return () => { ativo = false; clearInterval(t); };
  }, [pedido?.id, status]);

  const etapas = useMemo(() => [
    ['novo', 'Pedido recebido', 'Recebemos seu pedido e ele já está no sistema.'],
    ['confirmado', 'Pedido confirmado', 'A loja confirmou seu pedido.'],
    ['preparo', 'Em preparo', 'A cozinha está preparando tudo com carinho.'],
    ['saiu_entrega', retirada ? 'Pronto para retirada' : 'Saiu para entrega', retirada ? 'Seu pedido está pronto para você retirar.' : 'Seu pedido saiu da loja e está a caminho.'],
    ['concluido', retirada ? 'Retirado' : 'Entregue', retirada ? 'Pedido finalizado. Bom apetite!' : 'Pedido entregue. Bom apetite!'],
  ], [retirada]);

  const indiceAtual = ORDEM.indexOf(status);
  const pagamento = pedido.status_pagamento === 'pago' ? 'Pagamento confirmado' : pedido.status_pagamento === 'pendente' ? 'Pagamento pendente' : 'Pagamento na entrega';

  return (
    <section className="track-card">
      <div className="track-head">
        <span className="track-kicker">ACOMPANHE SEU PEDIDO</span>
        <h1>Pedido {pedido.codigo}</h1>
        <p>Esta página atualiza automaticamente.</p>
      </div>

      {status === 'cancelado' ? (
        <div className="track-cancel"><b>Pedido cancelado</b><span>Se precisar de ajuda, entre em contato com a loja.</span></div>
      ) : (
        <div className="track-timeline">
          {etapas.map(([chave, titulo, texto], i) => {
            const feito = i <= indiceAtual;
            const atual = i === indiceAtual;
            return (
              <div className={`track-step ${feito ? 'done' : ''} ${atual ? 'current' : ''}`} key={chave}>
                <div className="track-dot">{feito ? '✓' : i + 1}</div>
                <div><b>{titulo}</b><span>{texto}</span></div>
              </div>
            );
          })}
        </div>
      )}

      <div className="track-summary">
        <div><span>Pagamento</span><b>{pagamento}</b></div>
        <div><span>Modalidade</span><b>{retirada ? 'Retirada' : 'Entrega'}</b></div>
        {pedido.total != null && <div><span>Total</span><b>{Number(pedido.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b></div>}
      </div>
    </section>
  );
}
