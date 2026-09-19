'use client';

import { useEffect, useMemo, useState } from 'react';
import { brl, CATEGORIAS } from '@/lib/format';
import IconePrato from './IconePrato';
import IconeSucesso from './IconeSucesso';
import CartaoMercadoPago from './CartaoMercadoPago';

export default function Loja({ config, produtos }) {
  const [catAtiva, setCatAtiva] = useState('Todos');
  const [carrinho, setCarrinho] = useState([]);
  const [modal, setModal] = useState(null); // produto | carrinho | checkout | pix | sucesso
  const [produtoSel, setProdutoSel] = useState(null);
  const [opcaoSel, setOpcaoSel] = useState(0);
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState('');
  const [adicionaisSel, setAdicionaisSel] = useState([]);
  const [talherSel, setTalherSel] = useState(null);
  const [toast, setToast] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pix, setPix] = useState(null);
  const [pedidoFeito, setPedidoFeito] = useState(null);
  const [pago, setPago] = useState(false);
  const [cupomDigitado, setCupomDigitado] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState(null);
  const [validandoCupom, setValidandoCupom] = useState(false);
  const [erroCupom, setErroCupom] = useState('');

  const [form, setForm] = useState({
    nome: '', telefone: '', endereco: '', referencia: '',
    tipo: 'entrega', pagamento: 'pix',
  });

  const aberto = !!config.aberto;
  const taxa = form.tipo === 'retirada' ? 0 : Number(config.taxa_entrega || 0);
  const subtotal = useMemo(
    () => carrinho.reduce((s, i) => s + i.preco * i.qtd, 0), [carrinho]
  );
  const descontoCupom = Number(cupomAplicado?.desconto || 0);
  const totalCheckout = Math.max(0, subtotal - descontoCupom) + taxa;

  function avisar(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  // ---- Consulta o pagamento enquanto a tela do Pix estiver aberta ----
  useEffect(() => {
    if (modal !== 'pix' || !pedidoFeito) return;

    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/pedidos/status?id=${pedidoFeito.id}`, {
          cache: 'no-store',
        });
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
    setProdutoSel(p);
    setOpcaoSel(0);
    setQtd(1);
    setObs('');
    setAdicionaisSel([]);
    setTalherSel(null);
    setModal('produto');
  }

  function adicionar() {
    const o = produtoSel.opcoes[opcaoSel];
    const adicionaisDisponiveis = Array.isArray(produtoSel.adicionais)
      ? produtoSel.adicionais
      : [];

    if (produtoSel.perguntar_talher && typeof talherSel !== 'boolean') {
      avisar('Escolha se deseja talher descartável');
      return;
    }

    const adicionais = adicionaisDisponiveis.filter((a) =>
      adicionaisSel.includes(a.nome)
    );

    const totalAdicionais = adicionais.reduce(
      (s, a) => s + Number(a.preco || 0),
      0
    );

    const precoUnitario = Number(
      (Number(o.preco) + totalAdicionais).toFixed(2)
    );

    setCarrinho((c) => [
      ...c,
      {
        key: Math.random().toString(36).slice(2),
        produtoId: produtoSel.id,
        nome: produtoSel.nome,
        opcao: o.nome,
        preco: precoUnitario,
        precoBase: Number(o.preco),
        qtd,
        obs,
        adicionais,
        talher: produtoSel.perguntar_talher ? talherSel : null,
        foto_url: produtoSel.foto_url,
      },
    ]);

    setModal(null);
    avisar(`${produtoSel.nome} adicionado`);
  }

  async function aplicarCupom() {
    const codigo = cupomDigitado.trim().toUpperCase();

    setErroCupom('');

    if (!codigo) {
      setCupomAplicado(null);
      setErroCupom('Digite o código do cupom.');
      return;
    }

    setValidandoCupom(true);

    try {
      const res = await fetch('/api/cupons/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          telefone: form.telefone,
          subtotal,
        }),
      });

      const dados = await res.json();

      if (!res.ok) {
        setCupomAplicado(null);
        setErroCupom(dados.erro || 'Não foi possível aplicar o cupom.');
        return;
      }

      setCupomDigitado(dados.cupom.codigo);
      setCupomAplicado({
        ...dados.cupom,
        desconto: Number(dados.desconto || 0),
      });
      avisar('Cupom aplicado com sucesso');
    } catch {
      setCupomAplicado(null);
      setErroCupom('Falha de conexão ao validar o cupom.');
    } finally {
      setValidandoCupom(false);
    }
  }

  async function confirmar(dadosCartao = null) {
    setErro('');
    setEnviando(true);

    try {
      const payload = {
        nome: form.nome,
        telefone: form.telefone,
        endereco: form.endereco,
        referencia: form.referencia,
        tipo: form.tipo,
        pagamento: form.pagamento,
        cupom: cupomAplicado?.codigo || '',
        itens: carrinho.map((i) => ({
          produtoId: i.produtoId,
          opcao: i.opcao,
          qtd: i.qtd,
          adicionais: (i.adicionais || []).map((a) => a.nome),
          talher: i.talher,
          obs: i.obs,
        })),
      };

      if (form.pagamento === 'credito') {
        if (!dadosCartao) {
          throw new Error(
            'Preencha os dados do cartão para continuar.'
          );
        }

        payload.cartao = dadosCartao;
      }

      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const dados = await res.json();

      if (!res.ok) {
        throw new Error(
          dados.erro || 'Não foi possível enviar o pedido.'
        );
      }

      if (
        form.pagamento === 'credito' &&
        dados.cartao &&
        !dados.cartao.aprovado
      ) {
        const recusado = [
          'rejected',
          'cancelled',
          'canceled',
          'expired',
        ].includes(dados.cartao.status);

        if (recusado) {
          throw new Error(
            'O pagamento não foi aprovado. Confira os dados do cartão ou tente outra forma de pagamento.'
          );
        }
      }

      setPedidoFeito(dados.pedido);
      setCarrinho([]);
      setCupomDigitado('');
      setCupomAplicado(null);
      setErroCupom('');

      if (dados.pix) {
        setPago(false);
        setPix(dados.pix);
        setModal('pix');
        return;
      }

      if (form.pagamento === 'credito') {
        setPago(!!dados.cartao?.aprovado);
        setModal('sucesso');
        return;
      }

      setPago(false);
      setModal('sucesso');
    } catch (e) {
      const mensagem =
        e?.message || 'Falha de conexão. Tente novamente.';

      setErro(mensagem);
      throw e;
    } finally {
      setEnviando(false);
    }
  }

  const diaAtual = (() => {
    const nomeDia = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date());

    return {
      Monday: 'segunda',
      Tuesday: 'terca',
      Wednesday: 'quarta',
      Thursday: 'quinta',
      Friday: 'sexta',
      Saturday: 'sabado',
      Sunday: 'domingo',
    }[nomeDia];
  })();

  const visiveis = produtos.filter((p) => {
    if (p.ativo === false) return false;
    const dias = Array.isArray(p.dias_semana) ? p.dias_semana : [];
    return dias.includes(diaAtual);
  });

  const cats = catAtiva === 'Todos'
    ? CATEGORIAS.filter((c) => visiveis.some((p) => p.categoria === c))
    : [catAtiva];

  const catsDisponiveis = [
    'Todos',
    ...CATEGORIAS.filter((c) => visiveis.some((p) => p.categoria === c)),
  ];

  const qtdCarrinho = carrinho.reduce((s, i) => s + i.qtd, 0);

  const Foto = ({ p, tam = 34 }) =>
    p?.foto_url
      ? <img src={p.foto_url} alt={p.nome} loading="lazy" />
      : <IconePrato tam={tam} />;

  return (
    <>
      <header className={`topbar ${config.banner_url ? 'tem-banner' : ''}`}>
        {config.banner_url && (
          <>
            <img
              className="banner-img"
              src={config.banner_url}
              alt=""
            />
            <div className="banner-fade" />
          </>
        )}

        <div className="wrap">
          <div className="topbar-in">
            <div className="logo">
              <img src="/logo.png" alt="Jeito de Mãe" />
            </div>

            <div className="brand">
              <h1>Jeito de Mãe</h1>
              <p>Delícias Caseiras</p>

              {!!config.nota_media && (
                <div className="rating">
                  <span className="estrela">★</span>
                  {Number(config.nota_media).toFixed(1)}
                  <small>({config.total_avaliacoes} avaliações)</small>
                </div>
              )}
            </div>
          </div>

          <div className="statusbar">
            <span className="status-pill">
              <span className={`dot ${aberto ? 'on' : 'off'}`} />
              {aberto ? 'Aberto agora' : 'Fechado'}
            </span>

            <span className="sep">•</span>

            <span className="status-info">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              {config.horario}
            </span>

            {aberto && (
              <>
                <span className="sep">•</span>

                <span className="status-info">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="7" cy="17" r="2.2" />
                    <circle cx="17" cy="17" r="2.2" />
                    <path d="M5 17H3l2-6h8l3 3h3l2 3h-2" />
                    <path d="M10 11l2-4h3" />
                  </svg>
                  Entrega em {config.tempo_entrega}
                </span>
              </>
            )}

            <span className="sep">•</span>

            <span className="status-info">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 13l-7 7-9-9V4h7z" />
                <circle cx="8" cy="8" r="1.5" />
              </svg>
              Taxa {brl(config.taxa_entrega)}
            </span>
          </div>
        </div>
      </header>
            <nav className="cats">
        <div className="cats-in">
          {catsDisponiveis.map((c) => (
            <button
              key={c}
              className={`cat ${c === catAtiva ? 'active' : ''}`}
              onClick={() => setCatAtiva(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </nav>

      <main className="wrap">
        {visiveis.length === 0 && (
          <div className="empty">
            Não temos itens cadastrados para o cardápio de hoje.
          </div>
        )}

        {cats.map((c) => {
          const itens = visiveis.filter((p) => p.categoria === c);

          if (!itens.length) return null;

          return (
            <section key={c}>
              <h2 className="sec">{c}</h2>

              <div className="grid">
                {itens.map((p) => {
                  const opcoes = p.opcoes || [];

                  const principal = opcoes.reduce(
                    (m, o) =>
                      Number(o.preco) < Number(m.preco) ? o : m,
                    opcoes[0] || { preco: 0 }
                  );

                  const temDesconto =
                    principal?.precoDe > principal?.preco;

                  const percentual = temDesconto
                    ? Math.round(
                        100 - (principal.preco / principal.precoDe) * 100
                      )
                    : 0;

                  return (
                    <button
                      key={p.id}
                      className="card"
                      onClick={() => abrirProduto(p)}
                    >
                      <div className="card-body">
                        {p.destaque && (
                          <span className="tag">Prato do dia</span>
                        )}

                        <h3>{p.nome}</h3>
                        <p>{p.descricao}</p>

                        <div className="price">
                          {opcoes.length > 1 && (
                            <small>a partir de </small>
                          )}

                          {brl(principal?.preco)}

                          {temDesconto && (
                            <>
                              <span className="de">
                                {brl(principal.precoDe)}
                              </span>
                              <span className="desconto-selo">
                                -{percentual}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {p.foto_url && (
                        <div className="thumb card-photo">
                          <img
                            src={p.foto_url}
                            alt={p.nome}
                            loading="lazy"
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      <footer>
        Jeito de Mãe — Delícias Caseiras
        <br />
        Seus dados são usados apenas para entregar o pedido.
      </footer>

      <div className={`cartbar ${qtdCarrinho ? 'show' : ''}`}>
        <div className="cartbar-in">
          <button
            className="btn"
            onClick={() => setModal('carrinho')}
          >
            <span className="count">{qtdCarrinho}</span>
            <span>Ver meu pedido</span>
            <span style={{ marginLeft: 'auto' }}>
              {brl(subtotal)}
            </span>
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {/* ------------------------------ Modais ------------------------------ */}

      {modal && (
        <div className="sheet">
          <div
            className="sheet-bg"
            onClick={() => setModal(null)}
          />

          <div className={`sheet-card ${modal === 'checkout' ? '' : ''}`}>

            {modal === 'produto' && produtoSel && (
              <>
                <div className="hero-img">
                  <Foto p={produtoSel} tam={64} />
                </div>

                <div className="sheet-head">
                  <h3>{produtoSel.nome}</h3>
                  <button
                    className="close"
                    onClick={() => setModal(null)}
                  >
                    ✕
                  </button>
                </div>

                <div className="sheet-body">
                  <p
                    style={{
                      margin: '0 0 4px',
                      color: 'var(--muted)',
                      fontSize: 14,
                    }}
                  >
                    {produtoSel.descricao}
                  </p>

                  <label className="f">
                    {produtoSel.opcoes.length > 1
                      ? 'Escolha o tamanho'
                      : 'Item'}
                  </label>

                  {produtoSel.opcoes.map((o, i) => (
                    <label
                      key={i}
                      className={`opt ${i === opcaoSel ? 'active' : ''}`}
                      onClick={() => setOpcaoSel(i)}
                    >
                      <input
                        type="radio"
                        readOnly
                        checked={i === opcaoSel}
                      />

                      <span className="on">{o.nome}</span>

                      <span className="op">
                        {o.precoDe > o.preco && (
                          <span
                            className="de"
                            style={{ marginRight: 6 }}
                          >
                            {brl(o.precoDe)}
                          </span>
                        )}

                        {brl(o.preco)}
                      </span>
                    </label>
                  ))}

                  {(produtoSel.adicionais || []).length > 0 && (
                    <>
                      <label className="f" style={{ marginTop: 20 }}>
                        Quer adicionar algo?
                      </label>

                      <div className="adicionais-lista">
                        {(produtoSel.adicionais || []).map((a, i) => {
                          const marcado = adicionaisSel.includes(a.nome);

                          return (
                            <label
                              key={`${a.nome}-${i}`}
                              className={`opt adicional-opt ${marcado ? 'active' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() =>
                                  setAdicionaisSel((atuais) =>
                                    marcado
                                      ? atuais.filter((nome) => nome !== a.nome)
                                      : [...atuais, a.nome]
                                  )
                                }
                              />

                              <span className="on">{a.nome}</span>
                              <span className="op">+ {brl(a.preco)}</span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {produtoSel.perguntar_talher && (
                    <>
                      <label className="f" style={{ marginTop: 20 }}>
                        Precisa de talher descartável?
                      </label>

                      <label
                        className={`opt ${talherSel === true ? 'active' : ''}`}
                        onClick={() => setTalherSel(true)}
                      >
                        <input
                          type="radio"
                          readOnly
                          checked={talherSel === true}
                        />
                        <span className="on">Sim, quero talher</span>
                      </label>

                      <label
                        className={`opt ${talherSel === false ? 'active' : ''}`}
                        onClick={() => setTalherSel(false)}
                      >
                        <input
                          type="radio"
                          readOnly
                          checked={talherSel === false}
                        />
                        <span className="on">Não preciso de talher</span>
                      </label>
                    </>
                  )}

                  <label className="f">
                    Alguma observação?
                  </label>

                  <textarea
                    className="inp"
                    value={obs}
                    maxLength={200}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Ex.: sem couve, caprichar na farofa..."
                  />

                  <div
                    className="row"
                    style={{
                      marginTop: 18,
                      alignItems: 'center',
                    }}
                  >
                    <div
                      className="qty"
                      style={{ flex: '0 0 auto' }}
                    >
                      <button
                        onClick={() =>
                          setQtd((q) => Math.max(1, q - 1))
                        }
                      >
                        −
                      </button>

                      <span>{qtd}</span>

                      <button
                        onClick={() =>
                          setQtd((q) => Math.min(20, q + 1))
                        }
                      >
                        +
                      </button>
                    </div>

                    <button
                      className="btn"
                      disabled={!aberto}
                      onClick={adicionar}
                    >
                      {aberto
                        ? `Adicionar · ${brl(
                            (
                              Number(produtoSel.opcoes[opcaoSel].preco) +
                              (produtoSel.adicionais || [])
                                .filter((a) => adicionaisSel.includes(a.nome))
                                .reduce((s, a) => s + Number(a.preco || 0), 0)
                            ) * qtd
                          )}`
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
                  <button
                    className="close"
                    onClick={() => setModal(null)}
                  >
                    ✕
                  </button>
                </div>

                <div className="sheet-body">
                  {carrinho.map((i) => (
                    <div className="line" key={i.key}>
                      <div className="n">
                        <b>
                          {i.qtd}× {i.nome}
                        </b>

                        <small>
                          {i.opcao}
                          {(i.adicionais || []).map((a) => (
                            <span key={a.nome} style={{ display: 'block' }}>
                              + {a.nome} ({brl(a.preco)})
                            </span>
                          ))}
                          {typeof i.talher === 'boolean' && (
                            <span style={{ display: 'block' }}>
                              Talher: {i.talher ? 'Sim' : 'Não'}
                            </span>
                          )}
                          {i.obs && (
                            <span style={{ display: 'block' }}>
                              Obs.: {i.obs}
                            </span>
                          )}
                        </small>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700 }}>
                          {brl(i.preco * i.qtd)}
                        </div>

                        <button
                          className="mini del"
                          onClick={() =>
                            setCarrinho((c) =>
                              c.filter((x) => x.key !== i.key)
                            )
                          }
                        >
                          remover
                        </button>
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: 16 }}>
                    <div className="tot">
                      <span>Subtotal</span>
                      <span>{brl(subtotal)}</span>
                    </div>

                    <div className="tot">
                      <span>Entrega</span>
                      <span>{brl(taxa)}</span>
                    </div>

                    <div className="tot big">
                      <span>Total</span>
                      <span>{brl(subtotal + taxa)}</span>
                    </div>
                  </div>

                  <div
                    className="row"
                    style={{ marginTop: 18 }}
                  >
                    <button
                      className="btn ghost"
                      onClick={() => setModal(null)}
                    >
                      Continuar comprando
                    </button>

                    <button
                      className="btn"
                      disabled={!aberto || !carrinho.length}
                      onClick={() => setModal('checkout')}
                    >
                      Fechar pedido
                    </button>
                  </div>
                </div>
              </>
            )}
                        {modal === 'checkout' && (
              <>
                <div className="sheet-head">
                  <h3>Dados da entrega</h3>
                  <button
                    className="close"
                    onClick={() => setModal(null)}
                  >
                    ✕
                  </button>
                </div>

                <div className="sheet-body">
                  {erro && (
                    <div className="alert err">{erro}</div>
                  )}

                  <div
                    className="row"
                    style={{
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    {['entrega', 'retirada'].map((t) => (
                      <button
                        key={t}
                        style={{
                          flex: 1,
                          width: 'auto',
                        }}
                        className={`btn sm ${
                          form.tipo === t ? '' : 'ghost'
                        }`}
                        onClick={() =>
                          setForm({ ...form, tipo: t })
                        }
                      >
                        {t === 'entrega'
                          ? 'Entrega'
                          : 'Retirar no local'}
                      </button>
                    ))}
                  </div>

                  <label className="f">
                    Nome completo
                  </label>

                  <input
                    className="inp"
                    maxLength={80}
                    value={form.nome}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        nome: e.target.value,
                      })
                    }
                    placeholder="Como devemos te chamar"
                  />

                  <label className="f">
                    Telefone / WhatsApp
                  </label>

                  <input
                    className="inp"
                    inputMode="tel"
                    maxLength={20}
                    value={form.telefone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        telefone: e.target.value,
                      })
                    }
                    placeholder="(11) 90000-0000"
                  />

                  <label className="f">
                    Cupom de desconto
                  </label>

                  <div
                    className="row"
                    style={{
                      gap: 8,
                      alignItems: 'stretch',
                    }}
                  >
                    <input
                      className="inp"
                      maxLength={40}
                      value={cupomDigitado}
                      onChange={(e) => {
                        setCupomDigitado(
                          e.target.value.toUpperCase()
                        );
                        setCupomAplicado(null);
                        setErroCupom('');
                      }}
                      placeholder="Ex.: TESTE10"
                      style={{
                        margin: 0,
                        flex: 1,
                      }}
                    />

                    <button
                      type="button"
                      className="btn sm"
                      disabled={
                        validandoCupom ||
                        !carrinho.length
                      }
                      onClick={aplicarCupom}
                      style={{
                        width: 'auto',
                        flex: '0 0 auto',
                      }}
                    >
                      {validandoCupom
                        ? 'Validando...'
                        : 'Aplicar'}
                    </button>
                  </div>

                  {erroCupom && (
                    <div
                      className="alert err"
                      style={{ marginTop: 8 }}
                    >
                      {erroCupom}
                    </div>
                  )}

                  {cupomAplicado && (
                    <div
                      className="alert ok"
                      style={{ marginTop: 8 }}
                    >
                      <b>{cupomAplicado.codigo}</b> aplicado · desconto de{' '}
                      <b>{brl(descontoCupom)}</b>
                    </div>
                  )}

                  {form.tipo === 'entrega' ? (
                    <>
                      <label className="f">
                        Endereço completo
                      </label>

                      <input
                        className="inp"
                        maxLength={200}
                        value={form.endereco}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            endereco:
                              e.target.value,
                          })
                        }
                        placeholder="Rua, número, bairro, complemento"
                      />

                      <label className="f">
                        Ponto de referência
                      </label>

                      <input
                        className="inp"
                        maxLength={160}
                        value={form.referencia}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            referencia:
                              e.target.value,
                          })
                        }
                        placeholder="Ex.: portão verde, ao lado da padaria"
                      />
                    </>
                  ) : (
                    <div
                      className="alert"
                      style={{ marginTop: 16 }}
                    >
                      Retirada no balcão. Avisaremos pelo telefone
                      quando estiver pronto.
                    </div>
                  )}

                  <label
                    className="f"
                    style={{ marginTop: 22 }}
                  >
                    Forma de pagamento
                  </label>

                  <div className="pay">
                    {[
                      [
                        'pix',
                        'Pix pelo app',
                        'Confirmação automática assim que o pagamento cair',
                      ],
                      [
                        'credito',
                        'Cartão de crédito',
                        'Pagamento seguro pelo Mercado Pago',
                      ],
                      [
                        'dinheiro',
                        'Dinheiro na entrega',
                        'Combine o troco pelo telefone',
                      ],
                    ].map(([v, t, s]) => (
                      <label
                        key={v}
                        className={`opt ${
                          form.pagamento === v
                            ? 'active'
                            : ''
                        }`}
                        onClick={() => {
                          setErro('');
                          setForm({
                            ...form,
                            pagamento: v,
                          });
                        }}
                      >
                        <input
                          type="radio"
                          readOnly
                          checked={
                            form.pagamento === v
                          }
                        />

                        <span className="on">
                          {t}
                          <br />
                          <small
                            style={{
                              fontWeight: 400,
                              color:
                                'var(--muted)',
                            }}
                          >
                            {s}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>

                  {form.pagamento === 'credito' && (
                    <CartaoMercadoPago
                      valor={totalCheckout}
                      desabilitado={enviando}
                      onPagar={confirmar}
                      onErro={(mensagem) =>
                        setErro(mensagem)
                      }
                    />
                  )}

                  <div style={{ marginTop: 18 }}>
                    <div className="tot">
                      <span>Subtotal</span>
                      <span>{brl(subtotal)}</span>
                    </div>

                    {cupomAplicado &&
                      descontoCupom > 0 && (
                        <div className="tot">
                          <span>
                            Desconto (
                            {cupomAplicado.codigo})
                          </span>
                          <span>
                            - {brl(descontoCupom)}
                          </span>
                        </div>
                      )}

                    <div className="tot">
                      <span>Entrega</span>
                      <span>{brl(taxa)}</span>
                    </div>

                    <div className="tot big">
                      <span>Total</span>
                      <span>
                        {brl(totalCheckout)}
                      </span>
                    </div>
                  </div>

                  {form.pagamento !== 'credito' && (
                    <button
                      className="btn"
                      style={{ marginTop: 16 }}
                      disabled={enviando}
                      onClick={() => confirmar()}
                    >
                      {enviando
                        ? 'Enviando...'
                        : 'Confirmar pedido'}
                    </button>
                  )}

                  <button
                    className="btn ghost"
                    style={{ marginTop: 8 }}
                    onClick={() =>
                      setModal('carrinho')
                    }
                  >
                    Voltar
                  </button>

                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--muted)',
                      marginTop: 14,
                      textAlign: 'center',
                    }}
                  >
                    Usamos seu nome, telefone e endereço apenas para
                    preparar e entregar este pedido.
                  </p>
                </div>
              </>
            )}
                        {modal === 'pix' && pix && pedidoFeito && (
              <>
                <div className="sheet-head">
                  <h3>Pagamento via Pix</h3>
                  <button
                    className="close"
                    onClick={() => setModal('sucesso')}
                  >
                    ✕
                  </button>
                </div>

                <div
                  className="sheet-body"
                  style={{ textAlign: 'center' }}
                >
                  <p
                    style={{
                      color: 'var(--muted)',
                      fontSize: 14,
                      margin: 0,
                    }}
                  >
                    Pedido {pedidoFeito.codigo}
                  </p>

                  <div className="big-amount">
                    {brl(pedidoFeito.total)}
                  </div>

                  {pix.qrCodeBase64 && (
                    <div className="qrbox">
                      <img
                        src={`data:image/png;base64,${pix.qrCodeBase64}`}
                        alt="QR Code Pix"
                        width={200}
                        height={200}
                      />
                    </div>
                  )}

                  <p
                    style={{
                      fontSize: 13.5,
                      color: 'var(--muted)',
                      margin: '0 0 10px',
                    }}
                  >
                    Escaneie o QR Code ou use o copia e cola:
                  </p>

                  <div className="copiacola">
                    {pix.qrCode}
                  </div>

                  <button
                    className="btn"
                    style={{ marginTop: 12 }}
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(pix.qrCode)
                        .then(() =>
                          avisar('Código Pix copiado')
                        )
                        .catch(() =>
                          avisar(
                            'Selecione e copie o código'
                          )
                        );
                    }}
                  >
                    Copiar código Pix
                  </button>

                  <div
                    className="alert"
                    style={{
                      textAlign: 'left',
                      marginTop: 16,
                    }}
                  >
                    Assim que o pagamento cair, esta tela muda
                    sozinha e a cozinha é avisada na hora. Não
                    precisa mandar comprovante.
                  </div>
                </div>
              </>
            )}

            {modal === 'sucesso' && pedidoFeito && (
              <>
                <div className="sheet-head">
                  <h3>Pedido enviado!</h3>
                  <button
                    className="close"
                    onClick={() => setModal(null)}
                  >
                    ✕
                  </button>
                </div>

                <div
                  className="sheet-body"
                  style={{ textAlign: 'center' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      margin: '8px 0',
                    }}
                  >
                    <IconeSucesso />
                  </div>

                  <h3
                    style={{
                      fontFamily: 'var(--serif)',
                      fontSize: 24,
                      margin: '0 0 6px',
                    }}
                  >
                    Obrigado, {(form.nome || '').split(' ')[0]}!
                  </h3>

                  <p
                    style={{
                      color: 'var(--muted)',
                      margin: '0 0 4px',
                    }}
                  >
                    Pedido <b>{pedidoFeito.codigo}</b> ·{' '}
                    {brl(pedidoFeito.total)}
                  </p>

                  <p
                    style={{
                      color: 'var(--muted)',
                      fontSize: 14,
                    }}
                  >
                    {pedidoFeito.tipo === 'retirada'
                      ? 'Avisaremos quando estiver pronto para retirada.'
                      : `Previsão de entrega: ${config.tempo_entrega}.`}
                  </p>

                  <div
                    className={`alert ${pago ? 'ok' : ''}`}
                    style={{
                      textAlign: 'left',
                      marginTop: 16,
                    }}
                  >
                    {pago ? (
                      <>
                        <b>Pagamento confirmado.</b> Seu pedido foi
                        recebido com sucesso.
                      </>
                    ) : form.pagamento === 'dinheiro' ? (
                      <>
                        <b>Pagamento na entrega.</b> Separe o valor
                        ou avise o troco pelo telefone.
                      </>
                    ) : (
                      <>
                        <b>Aguardando o pagamento.</b> O pedido
                        seguirá normalmente assim que o pagamento
                        for confirmado.
                      </>
                    )}
                  </div>

                  <button
                    className="btn"
                    style={{ marginTop: 16 }}
                    onClick={() => setModal(null)}
                  >
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
