'use client';

export default function CheckoutV15({
  form,
  setForm,
  subtotal,
  desconto,
  taxaEntrega,
  total,
  cupomDigitado,
  setCupomDigitado,
  cupomAplicado,
  erroCupom,
  validandoCupom,
  validarCupom,
  buscarCep,
  erro,
  enviando,
  aberto,
  finalizarPedido,
  onBack,
}) {
  const etapaPagamento = form.tipo === 'entrega' ? '4' : '3';

  return (
    <div className="checkout-app" role="dialog" aria-modal="true" aria-label="Finalizar pedido">
      <header className="checkout-head">
        <button type="button" onClick={onBack} aria-label="Voltar para a sacola">‹</button>
        <div><h2>Finalizar pedido</h2><small>Revise seus dados e escolha como receber</small></div>
      </header>

      <div className="checkout-body">
        <section className="checkout-section">
          <div className="checkout-section-title"><span>1</span><div><b>Como você quer receber?</b><small>Escolha entrega ou retirada</small></div></div>
          <div className="checkout-segment">
            <button type="button" className={form.tipo === 'entrega' ? 'active' : ''} onClick={() => setForm({ ...form, tipo: 'entrega' })}>Entrega</button>
            <button type="button" className={form.tipo === 'retirada' ? 'active' : ''} onClick={() => setForm({ ...form, tipo: 'retirada' })}>Retirada</button>
          </div>
        </section>

        <section className="checkout-section">
          <div className="checkout-section-title"><span>2</span><div><b>Seus dados</b><small>Usaremos para identificar seu pedido</small></div></div>
          <div className="checkout-fields">
            <label><span>Nome</span><input placeholder="Seu nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}/></label>
            <label><span>WhatsApp</span><input placeholder="(11) 99999-9999" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })}/></label>
          </div>
        </section>

        {form.tipo === 'entrega' && (
          <section className="checkout-section">
            <div className="checkout-section-title"><span>3</span><div><b>Endereço de entrega</b><small>Informe onde devemos entregar</small></div></div>
            <div className="checkout-fields">
              <label><span>CEP</span><input placeholder="00000-000" value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} onBlur={buscarCep}/></label>
              <label><span>Endereço</span><input placeholder="Rua, avenida..." value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })}/></label>
              <div className="checkout-row">
                <label><span>Número</span><input placeholder="123" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })}/></label>
                <label><span>Complemento</span><input placeholder="Apto, casa..." value={form.complemento} onChange={e => setForm({ ...form, complemento: e.target.value })}/></label>
              </div>
              <label><span>Bairro</span><input placeholder="Seu bairro" value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })}/></label>
            </div>
          </section>
        )}

        <section className="checkout-section">
          <div className="checkout-section-title"><span>{etapaPagamento}</span><div><b>Pagamento</b><small>Escolha a forma de pagamento</small></div></div>
          <div className="checkout-payments">
            {[['pix','PIX','Pagamento rápido'],['credito','Cartão','Crédito'],['dinheiro','Dinheiro','Pague na entrega']].map(([id,titulo,sub]) => (
              <button type="button" key={id} className={form.pagamento === id ? 'active' : ''} onClick={() => setForm({ ...form, pagamento: id })}>
                <i>{id === 'pix' ? '◆' : id === 'credito' ? '▭' : '$'}</i><span><b>{titulo}</b><small>{sub}</small></span><em>{form.pagamento === id ? '✓' : ''}</em>
              </button>
            ))}
          </div>
          {form.pagamento === 'dinheiro' && (
            <div className="checkout-change">
              <label><span>Precisa de troco?</span><input inputMode="decimal" placeholder="Ex.: 50,00 — deixe em branco se não precisar" value={form.trocoPara} onChange={e => setForm({ ...form, trocoPara: e.target.value })}/></label>
              <small>O entregador levará o troco considerando o valor informado.</small>
            </div>
          )}
        </section>

        <section className="checkout-section checkout-coupon">
          <div><b>Cupom de desconto</b><small>Tem um código? Aplique antes de finalizar.</small></div>
          <div className="checkout-coupon-row"><input placeholder="CUPOM" value={cupomDigitado} onChange={e => setCupomDigitado(e.target.value.toUpperCase())}/><button type="button" onClick={validarCupom} disabled={validandoCupom}>{validandoCupom ? '...' : 'Aplicar'}</button></div>
          {erroCupom && <small className="erro">{erroCupom}</small>}
          {cupomAplicado && <small className="bag-coupon-ok">Cupom aplicado ✓</small>}
        </section>

        <section className="checkout-summary">
          <h3>Resumo</h3>
          <span>Subtotal <b>{subtotal}</b></span>
          {desconto && desconto !== 'R$ 0,00' ? <span className="discount">Desconto <b>− {desconto}</b></span> : null}
          <span>{form.tipo === 'entrega' ? 'Taxa de entrega' : 'Retirada'} <b>{form.tipo === 'entrega' ? taxaEntrega : 'Grátis'}</b></span>
          <span className="checkout-total">Total <b>{total}</b></span>
        </section>
        {erro && <div className="checkout-error">{erro}</div>}
      </div>

      <footer className="checkout-action">
        <button type="button" disabled={enviando || !aberto} onClick={finalizarPedido}><span>{enviando ? 'Enviando...' : aberto ? 'Fazer pedido' : 'Loja fechada'}</span><b>{total}</b></button>
      </footer>
    </div>
  );
}
