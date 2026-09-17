'use client';

import { useEffect, useMemo, useState } from 'react';
import { brl, EMOJI, CATEGORIAS } from '@/lib/format';

export default function Loja({ config, produtos }) {
  const [catAtiva, setCatAtiva] = useState('Todos');
  const [carrinho, setCarrinho] = useState([]);
  const [modal, setModal] = useState(null); // produto | carrinho | checkout | pix | sucesso
  const [produtoSel, setProdutoSel] = useState(null);
  const [opcaoSel, setOpcaoSel] = useState(0);
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState('');
  const [toast, setToast] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pix, setPix] = useState(null);
  const [pedidoFeito, setPedidoFeito] = useState(null);
  const [pago, setPago] = useState(false);

  const [form, setForm] = useState({
    nome: '', telefone: '', endereco: '', referencia: '',
    tipo: 'entrega', pagamento: 'pix',
  });

  const aberto = !!config.aberto;
  const taxa = form.tipo === 'retirada' ? 0 : Number(config.taxa_entrega || 0);
  const subtotal = useMemo(
    () => carrinho.reduce((s, i) => s + i.preco * i.qtd, 0), [carrinho]
  );

  function avisar(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  // ---- Consulta o pagamento enquanto a tela do Pix estiver aberta ----
  useEffect(() => {
    if (modal !== 'pix' || !pedidoFeito) return;
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/pedidos/status?id=${pedidoFeito.id}`, { cache: 'no-store' });
        const d = await r.json();
        if (d.status_pagamento === 'pago') {
          clearInterval(timer);
          setPago(true);
          setModal('sucesso');
        }
      } catch {}
    }, 5000);
    return () => clearInterval(timer);
  }, [modal, pedidoFeito]);

  function abrirProduto(p) {
    setProdutoSel(p); setOpcaoSel(0); setQtd(1); setObs(''); setModal('produto');
  }

  function adicionar() {
    const o = produtoSel.opcoes[opcaoSel];
    setCarrinho((c) => [...c, {
      key: Math.random().toString(36).slice(2),
      produtoId: produtoSel.id, nome: produtoSel.nome, opcao: o.nome,
      preco: Number(o.preco), qtd, obs, foto_url: produtoSel.foto_url,
    }]);
    setModal(null);
    avisar(`${produtoSel.nome} adicionado`);
  }

  async function confirmar() {
    setErro('');
    setEnviando(true);
    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          telefone: form.telefone,
          endereco: form.endereco,
          referencia: form.referencia,
          tipo: form.tipo,
          pagamento: form.pagamento,
          itens: carrinho.map((i) => ({
            produtoId: i.produtoId, opcao: i.opcao, qtd: i.qtd, obs: i.obs,
          })),
        }),
      });
      const dados = await res.json();
      if (!res.ok) { setErro(dados.erro || 'Não foi possível enviar o pedido.'); return; }

      setPedidoFeito(dados.pedido);
      setCarrinho([]);
      if (dados.pix) { setPix(dados.pix); setModal('pix'); }
      else { setPago(false); setModal('sucesso'); }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  const visiveis = produtos;
  const cats = catAtiva === 'Todos'
    ? CATEGORIAS.filter((c) => visiveis.some((p) => p.categoria === c))
    : [catAtiva];
  const catsDisponiveis = ['Todos', ...CATEGORIAS.filter((c) => visiveis.some((p) => p.categoria === c))];
  const qtdCarrinho = carrinho.reduce((s, i) => s + i.qtd, 0);

  const Foto = ({ p, tam = 34 }) =>
    p?.foto_url
      ? <img src={p.foto_url} alt={p.nome} loading="lazy" />
      : <span style={{ fontSize: tam }}>{EMOJI[p?.categoria] || '🍽️'}</span>;

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <div className="topbar-in">
            <div className="logo">JM</div>
            <div className="brand">
              <h1>Jeito de Mãe</h1>
              <p>Delícias Caseiras</p>
            </div>
          </div>
          <div className="statusbar">
            <span className="status-pill">
              <span className={`dot ${aberto ? 'on' : 'off'}`} />
              {aberto ? 'Aberto agora' : 'Fechado'}
            </span>
            <span className="sep">•</span><span>{config.horario}</span>
            {aberto && (<><span className="sep">•</span><span>Entrega em {config.tempo_entrega}</span></>)}
            <span className="sep">•</span><span>Taxa {brl(config.taxa_entrega)}</span>
          </div>
        </div>
      </header>

      <main className="wrap">
        {aberto && config.prato_do_dia && (
          <div className="hoje">
            <span className="badge">Prato do dia</span>
            <div><strong>{config.prato_do_dia}</strong><small>{config.recado}</small></div>
          </div>
        )}
        {!aberto && (
          <div className="closed-banner">
            <b>Estamos fechados no momento.</b><br />
            {config.mensagem_fechado} Você pode olhar o cardápio, mas os pedidos só voltam quando reabrirmos.
          </div>
        )}

        <nav className="cats">
          <div className="cats-in">
            {catsDisponiveis.map((c) => (
              <button key={c} className={`cat ${c === catAtiva ? 'active' : ''}`}
                onClick={() => setCatAtiva(c)}>
                {c === 'Todos' ? 'Todos' : `${EMOJI[c] || ''} ${c}`}
              </button>
            ))}
          </div>
        </nav>

        {visiveis.length === 0 && <div className="empty">O cardápio ainda está vazio.</div>}

        {cats.map((c) => {
          const itens = visiveis.filter((p) => p.categoria === c);
          if (!itens.length) return null;
          return (
            <section key={c}>
              <h2 className="sec">{EMOJI[c] || ''} {c}</h2>
              <div className="grid">
                {itens.map((p) => {
                  const menor = Math.min(...(p.opcoes || []).map((o) => Number(o.preco)));
                  return (
                    <button key={p.id} className="card" onClick={() => abrirProduto(p)}>
                      <div className="thumb"><Foto p={p} /></div>
                      <div className="card-body">
                        {p.destaque && <span className="tag">Prato do dia</span>}
                        <h3>{p.nome}</h3>
                        <p>{p.descricao}</p>
                        <div className="price">
                          {(p.opcoes || []).length > 1 && <small>a partir de </small>}
                          {brl(menor)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      <footer>
        Jeito de Mãe — Delícias Caseiras<br />
        Seus dados são usados apenas para entregar o pedido.
      </footer>

      <div className={`cartbar ${qtdCarrinho ? 'show' : ''}`}>
        <div className="cartbar-in">
          <button className="btn" onClick={() => setModal('carrinho')}>
            <span className="count">{qtdCarrinho}</span>
            <span>Ver meu pedido</span>
            <span style={{ marginLeft: 'auto' }}>{brl(subtotal)}</span>
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {/* ------------------------------ Modais ------------------------------ */}
      {modal && (
        <div className="sheet">
          <div className="sheet-bg" onClick={() => setModal(null)} />
          <div className={`sheet-card ${modal === 'checkout' ? '' : ''}`}>

            {modal === 'produto' && produtoSel && (
              <>
                <div className="hero-img"><Foto p={produtoSel} tam={64} /></div>
                <div className="sheet-head">
                  <h3>{produtoSel.nome}</h3>
                  <button className="close" onClick={() => setModal(null)}>✕</button>
                </div>
                <div className="sheet-body">
                  <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 14 }}>
                    {produtoSel.descricao}
                  </p>
                  <label className="f">
                    {produtoSel.opcoes.length > 1 ? 'Escolha o tamanho' : 'Item'}
                  </label>
                  {produtoSel.opcoes.map((o, i) => (
                    <label key={i} className={`opt ${i === opcaoSel ? 'active' : ''}`}
                      onClick={() => setOpcaoSel(i)}>
                      <input type="radio" readOnly checked={i === opcaoSel} />
                      <span className="on">{o.nome}</span>
                      <span className="op">{brl(o.preco)}</span>
                    </label>
                  ))}
                  <label className="f">Alguma observação?</label>
                  <textarea className="inp" value={obs} maxLength={200}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Ex.: sem couve, caprichar na farofa..." />
                  <div className="row" style={{ marginTop: 18, alignItems: 'center' }}>
                    <div className="qty" style={{ flex: '0 0 auto' }}>
                      <button onClick={() => setQtd((q) => Math.max(1, q - 1))}>−</button>
                      <span>{qtd}</span>
                      <button onClick={() => setQtd((q) => Math.min(20, q + 1))}>+</button>
                    </div>
                    <button className="btn" disabled={!aberto} onClick={adicionar}>
                      {aberto
                        ? `Adicionar · ${brl(produtoSel.opcoes[opcaoSel].preco * qtd)}`
                        : 'Loja fechada'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {modal === 'carrinho' && (
              <>
                <div className="sheet-head">
                  <h3>Seu pedido</h3>
                  <button className="close" onClick={() => setModal(null)}>✕</button>
                </div>
                <div className="sheet-body">
                  {carrinho.map((i) => (
                    <div className="line" key={i.key}>
                      <div className="n">
                        <b>{i.qtd}× {i.nome}</b>
                        <small>{i.opcao}{i.obs ? ` · ${i.obs}` : ''}</small>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700 }}>{brl(i.preco * i.qtd)}</div>
                        <button className="mini del"
                          onClick={() => setCarrinho((c) => c.filter((x) => x.key !== i.key))}>
                          remover
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 16 }}>
                    <div className="tot"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
                    <div className="tot"><span>Entrega</span><span>{brl(taxa)}</span></div>
                    <div className="tot big"><span>Total</span><span>{brl(subtotal + taxa)}</span></div>
                  </div>
                  <div className="row" style={{ marginTop: 18 }}>
                    <button className="btn ghost" onClick={() => setModal(null)}>Continuar comprando</button>
                    <button className="btn" disabled={!aberto || !carrinho.length}
                      onClick={() => setModal('checkout')}>Fechar pedido</button>
                  </div>
                </div>
              </>
            )}

            {modal === 'checkout' && (
              <>
                <div className="sheet-head">
                  <h3>Dados da entrega</h3>
                  <button className="close" onClick={() => setModal(null)}>✕</button>
                </div>
                <div className="sheet-body">
                  {erro && <div className="alert err">{erro}</div>}

                  <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                    {['entrega', 'retirada'].map((t) => (
                      <button key={t} style={{ flex: 1, width: 'auto' }}
                        className={`btn sm ${form.tipo === t ? '' : 'ghost'}`}
                        onClick={() => setForm({ ...form, tipo: t })}>
                        {t === 'entrega' ? 'Entrega' : 'Retirar no local'}
                      </button>
                    ))}
                  </div>

                  <label className="f">Nome completo</label>
                  <input className="inp" maxLength={80} value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Como devemos te chamar" />

                  <label className="f">Telefone / WhatsApp</label>
                  <input className="inp" inputMode="tel" maxLength={20} value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    placeholder="(11) 90000-0000" />

                  {form.tipo === 'entrega' ? (
                    <>
                      <label className="f">Endereço completo</label>
                      <input className="inp" maxLength={200} value={form.endereco}
                        onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                        placeholder="Rua, número, bairro, complemento" />
                      <label className="f">Ponto de referência</label>
                      <input className="inp" maxLength={160} value={form.referencia}
                        onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                        placeholder="Ex.: portão verde, ao lado da padaria" />
                    </>
                  ) : (
                    <div className="alert" style={{ marginTop: 16 }}>
                      Retirada no balcão. Avisaremos pelo telefone quando estiver pronto.
                    </div>
                  )}

                  <label className="f" style={{ marginTop: 22 }}>Forma de pagamento</label>
                  <div className="pay">
                    {[
                      ['pix', 'Pix pelo app', 'Confirmação automática assim que o pagamento cair'],
                      ['dinheiro', 'Dinheiro na entrega', 'Combine o troco pelo telefone'],
                    ].map(([v, t, s]) => (
                      <label key={v} className={`opt ${form.pagamento === v ? 'active' : ''}`}
                        onClick={() => setForm({ ...form, pagamento: v })}>
                        <input type="radio" readOnly checked={form.pagamento === v} />
                        <span className="on">{t}<br />
                          <small style={{ fontWeight: 400, color: 'var(--muted)' }}>{s}</small>
                        </span>
                      </label>
                    ))}
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div className="tot"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
                    <div className="tot"><span>Entrega</span><span>{brl(taxa)}</span></div>
                    <div className="tot big"><span>Total</span><span>{brl(subtotal + taxa)}</span></div>
                  </div>

                  <button className="btn" style={{ marginTop: 16 }} disabled={enviando} onClick={confirmar}>
                    {enviando ? 'Enviando...' : 'Confirmar pedido'}
                  </button>
                  <button className="btn ghost" style={{ marginTop: 8 }}
                    onClick={() => setModal('carrinho')}>Voltar</button>

                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 14, textAlign: 'center' }}>
                    Usamos seu nome, telefone e endereço apenas para preparar e entregar este pedido.
                  </p>
                </div>
              </>
            )}

            {modal === 'pix' && pix && pedidoFeito && (
              <>
                <div className="sheet-head">
                  <h3>Pagamento via Pix</h3>
                  <button className="close" onClick={() => setModal('sucesso')}>✕</button>
                </div>
                <div className="sheet-body" style={{ textAlign: 'center' }}>
                  <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
                    Pedido {pedidoFeito.codigo}
                  </p>
                  <div className="big-amount">{brl(pedidoFeito.total)}</div>

                  {pix.qrCodeBase64 && (
                    <div className="qrbox">
                      <img src={`data:image/png;base64,${pix.qrCodeBase64}`}
                        alt="QR Code Pix" width={200} height={200} />
                    </div>
                  )}
                  <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '0 0 10px' }}>
                    Escaneie o QR Code ou use o copia e cola:
                  </p>
                  <div className="copiacola">{pix.qrCode}</div>
                  <button className="btn" style={{ marginTop: 12 }}
                    onClick={() => {
                      navigator.clipboard?.writeText(pix.qrCode)
                        .then(() => avisar('Código Pix copiado'))
                        .catch(() => avisar('Selecione e copie o código'));
                    }}>
                    Copiar código Pix
                  </button>
                  <div className="alert" style={{ textAlign: 'left', marginTop: 16 }}>
                    Assim que o pagamento cair, esta tela muda sozinha e a cozinha é avisada
                    na hora. Não precisa mandar comprovante.
                  </div>
                </div>
              </>
            )}

            {modal === 'sucesso' && pedidoFeito && (
              <>
                <div className="sheet-head">
                  <h3>Pedido enviado!</h3>
                  <button className="close" onClick={() => setModal(null)}>✕</button>
                </div>
                <div className="sheet-body" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 56, margin: '8px 0' }}>🍲</div>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, margin: '0 0 6px' }}>
                    Obrigado, {(form.nome || '').split(' ')[0]}!
                  </h3>
                  <p style={{ color: 'var(--muted)', margin: '0 0 4px' }}>
                    Pedido <b>{pedidoFeito.codigo}</b> · {brl(pedidoFeito.total)}
                  </p>
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                    {pedidoFeito.tipo === 'retirada'
                      ? 'Avisaremos quando estiver pronto para retirada.'
                      : `Previsão de entrega: ${config.tempo_entrega}.`}
                  </p>
                  <div className={`alert ${pago ? 'ok' : ''}`} style={{ textAlign: 'left', marginTop: 16 }}>
                    {pago
                      ? <><b>Pagamento confirmado.</b> Já estamos preparando.</>
                      : form.pagamento === 'dinheiro'
                        ? <><b>Pagamento na entrega.</b> Separe o valor ou avise o troco pelo telefone.</>
                        : <><b>Aguardando o pagamento.</b> O preparo começa assim que ele for confirmado.</>}
                  </div>
                  <button className="btn" style={{ marginTop: 16 }} onClick={() => setModal(null)}>
                    Voltar ao cardápio
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
