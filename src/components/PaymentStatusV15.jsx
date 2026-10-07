'use client';

export function PixV15({ pix, total }) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(pix?.qr_code || '');
    } catch {}
  }

  return (
    <div className="payment-status-app" role="dialog" aria-modal="true" aria-label="Pagamento Pix">
      <div className="payment-status-card">
        <div className="payment-status-icon pix-icon">◆</div>
        <span className="payment-kicker">PAGAMENTO PIX</span>
        <h2>Quase lá!</h2>
        <p>Escaneie o QR Code ou copie o código Pix para concluir seu pagamento.</p>
        {total && <div className="payment-total"><small>Total do pedido</small><strong>{total}</strong></div>}
        {pix?.qr_code_base64 && <div className="pix-qr"><img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code Pix"/></div>}
        <div className="pix-code"><textarea readOnly value={pix?.qr_code || ''}/><button type="button" onClick={copiar}>Copiar código Pix</button></div>
        <div className="payment-wait"><span></span><div><b>Aguardando pagamento</b><small>Assim que o Pix for confirmado, atualizaremos esta tela automaticamente.</small></div></div>
      </div>
    </div>
  );
}

export function SuccessV15({ pedido, pago }) {
  return (
    <div className="payment-status-app success-app" role="dialog" aria-modal="true" aria-label="Pedido recebido">
      <div className="payment-status-card">
        <div className="payment-status-icon success-icon">✓</div>
        <span className="payment-kicker">PEDIDO #{pedido?.codigo || ''}</span>
        <h2>Pedido recebido!</h2>
        <p>{pago ? 'Pagamento confirmado. Agora vamos preparar tudo com carinho.' : 'Recebemos seu pedido. Você pode acompanhar cada etapa por aqui.'}</p>
        <div className="success-progress"><div className="active"><i>✓</i><span><b>Pedido recebido</b><small>Seu pedido entrou no sistema</small></span></div><div><i>2</i><span><b>Em preparo</b><small>A cozinha iniciará o preparo</small></span></div><div><i>3</i><span><b>{pedido?.tipo === 'retirada' ? 'Pronto para retirada' : 'Saiu para entrega'}</b><small>Acompanhe o andamento</small></span></div></div>
        <a className="success-track" href={`/pedido/${pedido?.id}`}>Acompanhar meu pedido <b>→</b></a>
        <a className="success-home" href="/">Voltar ao cardápio</a>
      </div>
    </div>
  );
}
