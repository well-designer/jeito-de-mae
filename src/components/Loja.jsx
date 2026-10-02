'use client';

import { useMemo, useState, useEffect } from 'react';

const CATEGORIAS = ['Pratos do dia', 'Bebidas', 'Sobremesas', 'Extras'];
const PIX_CHAVE = '11944012837';
const PIX_NOME = 'Wellington Duarte Costa';

function brl(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function IconePrato({ tam = 34 }) {
  return <span style={{ fontSize: tam, lineHeight: 1 }}>🍽️</span>;
}

export default function Loja({ config, produtos }) {
  const [catAtiva, setCatAtiva] = useState('Todos');
  const [selecionado, setSelecionado] = useState(null);
  const [opcao, setOpcao] = useState(null);
  const [adicionais, setAdicionais] = useState([]);
  const [observacao, setObservacao] = useState('');
  const [talher, setTalher] = useState('');
  const [qtd, setQtd] = useState(1);
  const [carrinho, setCarrinho] = useState([]);
  const [checkout, setCheckout] = useState(false);
  const [tipo, setTipo] = useState('entrega');
  const [pagamento, setPagamento] = useState('pix');
  const [trocoPara, setTrocoPara] = useState('');
  const [cupom, setCupom] = useState('');
  const [cupomInfo, setCupomInfo] = useState(null);
  const [cupomErro, setCupomErro] = useState('');
  const [validandoCupom, setValidandoCupom] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(null);
  const [form, setForm] = useState({ nome: '', telefone: '', cep: '', endereco: '', numero: '', complemento: '', bairro: '' });

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  const aberto = !!config.aberto;
  const taxaEntrega = Number(config.taxa_entrega || 0);

  const subtotal = useMemo(() => carrinho.reduce((s, i) => s + Number(i.preco || 0) * i.qtd, 0), [carrinho]);
  const desconto = useMemo(() => {
    if (!cupomInfo) return 0;
    if (cupomInfo.tipo === 'percentual') return subtotal * Number(cupomInfo.valor || 0) / 100;
    return Math.min(subtotal, Number(cupomInfo.valor || 0));
  }, [cupomInfo, subtotal]);
  const total = Math.max(0, subtotal - desconto) + (tipo === 'entrega' ? taxaEntrega : 0);

  function abrirProduto(p) {
    setSelecionado(p);
    setOpcao(Array.isArray(p.opcoes) && p.opcoes.length ? p.opcoes[0] : null);
    setAdicionais([]);
    setObservacao('');
    setTalher('');
    setQtd(1);
  }

  function precoAtual() {
    const base = Number(opcao?.preco ?? selecionado?.preco ?? 0);
    const adds = adicionais.reduce((s, a) => s + Number(a.preco || 0), 0);
    return base + adds;
  }

  function toggleAdicional(a) {
    setAdicionais((atual) => atual.some((x) => x.nome === a.nome) ? atual.filter((x) => x.nome !== a.nome) : [...atual, a]);
  }

  function adicionarCarrinho() {
    if (!selecionado) return;
    const preco = precoAtual();
    setCarrinho((atual) => [...atual, {
      key: `${selecionado.id}-${Date.now()}`,
      produto_id: selecionado.id,
      nome: selecionado.nome,
      opcao: opcao?.nome || null,
      adicionais,
      observacao,
      talher,
      preco,
      qtd,
    }]);
    setSelecionado(null);
  }

  function removerItem(key) { setCarrinho((c) => c.filter((i) => i.key !== key)); }
  function mudarQtd(key, delta) { setCarrinho((c) => c.map((i) => i.key === key ? { ...i, qtd: Math.max(1, i.qtd + delta) } : i)); }

  async function validarCupom() {
    setCupomErro(''); setCupomInfo(null);
    if (!cupom.trim()) return;
    setValidandoCupom(true);
    try {
      const r = await fetch('/api/cupons/validar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: cupom.trim(), subtotal }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Cupom inválido');
      setCupomInfo(d);
    } catch (e) { setCupomErro(e.message); } finally { setValidandoCupom(false); }
  }

  async function buscarCep() {
    const cep = form.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (!d.erro) setForm((f) => ({ ...f, endereco: d.logradouro || f.endereco, bairro: d.bairro || f.bairro }));
    } catch {}
  }

  async function finalizarPedido() {
    setErro('');
    if (!form.nome.trim() || !form.telefone.trim()) return setErro('Preencha nome e telefone.');
    if (tipo === 'entrega' && (!form.endereco.trim() || !form.numero.trim() || !form.bairro.trim())) return setErro('Preencha o endereço de entrega.');
    if (!carrinho.length) return setErro('Seu carrinho está vazio.');
    setEnviando(true);
    try {
      const payload = {
        cliente_nome: form.nome.trim(), cliente_telefone: form.telefone.trim(), tipo, pagamento,
        troco_para: pagamento === 'dinheiro' ? trocoPara : null,
        endereco: tipo === 'entrega' ? `${form.endereco}, ${form.numero}${form.complemento ? ` - ${form.complemento}` : ''} - ${form.bairro} - CEP ${form.cep}` : null,
        itens: carrinho.map(({ key, ...i }) => i), subtotal, desconto, taxa_entrega: tipo === 'entrega' ? taxaEntrega : 0, total,
        cupom: cupomInfo?.codigo || null,
      };
      const r = await fetch('/api/pedidos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Não foi possível enviar o pedido.');
      setSucesso(d); setCarrinho([]); setCheckout(false);
    } catch (e) {
      setErro(e?.message || 'Falha de conexão. Tente novamente.');
      throw e;
    } finally { setEnviando(false); }
  }

  const diaAtual = (() => {
    const nomeDia = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date());
    return { Monday:'segunda', Tuesday:'terca', Wednesday:'quarta', Thursday:'quinta', Friday:'sexta', Saturday:'sabado', Sunday:'domingo' }[nomeDia];
  })();

  const visiveis = produtos.filter((p) => p.ativo !== false && (Array.isArray(p.dias_semana) ? p.dias_semana : []).includes(diaAtual));
  const cats = catAtiva === 'Todos' ? CATEGORIAS.filter((c) => visiveis.some((p) => p.categoria === c)) : [catAtiva];
  const catsDisponiveis = ['Todos', ...CATEGORIAS.filter((c) => visiveis.some((p) => p.categoria === c))];
  const qtdCarrinho = carrinho.reduce((s, i) => s + i.qtd, 0);
  const Foto = ({ p, tam = 34 }) => p?.foto_url ? <img src={p.foto_url} alt={p.nome} loading="lazy" /> : <IconePrato tam={tam} />;

  return <>
    <header className={`topbar ${config.banner_url ? 'tem-banner' : ''}`}>
      {config.banner_url && <><img className="banner-img" src={config.banner_url} alt=""/><div className="banner-fade" /></>}
      <div className="wrap">
        <div className="topbar-in">
          <div className="logo brand-logo"><img src="/jeito%20de%20m%C3%A3e%20logo%20new.png" alt="Jeito de Mãe" /></div>
          <div className="brand brand-info">
            {!!config.nota_media && <div className="rating"><span className="estrela">★</span>{Number(config.nota_media).toFixed(1)}<small>({config.total_avaliacoes} avaliações)</small></div>}
          </div>
        </div>
        <div className="statusbar">
          <span className="status-pill"><span className={`dot ${aberto ? 'on' : 'off'}`} />{aberto ? 'Aberto agora' : 'Fechado'}</span>
          <span className="sep">•</span><span className="status-info">{config.horario}</span>
          {aberto && <><span className="sep">•</span><span className="status-info">Entrega em {config.tempo_entrega || '30–50 min'}</span></>}
        </div>
      </div>
    </header>

    {!aberto && <div className="wrap"><div className="closed-banner"><b>Loja fechada no momento.</b> Você pode consultar o cardápio e voltar no horário de atendimento.</div></div>}

    <nav className="cats"><div className="cats-in wrap">{catsDisponiveis.map((c) => <button key={c} className={`cat ${catAtiva === c ? 'active' : ''}`} onClick={() => setCatAtiva(c)}>{c}</button>)}</div></nav>

    <main className="wrap">
      {cats.map((cat) => <section key={cat}><h2 className="sec">{cat}</h2><div className="grid">{visiveis.filter((p) => p.categoria === cat).map((p) => <button className="card" key={p.id} onClick={() => abrirProduto(p)}><div className="card-body">{p.destaque && <span className="tag">Destaque</span>}<h3>{p.nome}</h3><p>{p.descricao}</p><div className="price">{Array.isArray(p.opcoes) && p.opcoes.length ? `A partir de ${brl(Math.min(...p.opcoes.map(o => Number(o.preco))))}` : brl(p.preco)}</div></div><div className="thumb card-photo"><Foto p={p}/></div></button>)}</div></section>)}
      {!visiveis.length && <div className="empty">Nenhum item disponível para hoje.</div>}
    </main>

    {!!qtdCarrinho && <div className="cartbar"><div className="cartbar-in wrap"><button className="btn" onClick={() => setCheckout(true)}><span>Ver carrinho <span className="count">{qtdCarrinho}</span></span><b>{brl(total)}</b></button></div></div>}

    {selecionado && <div className="sheet" onMouseDown={(e) => e.target === e.currentTarget && setSelecionado(null)}><div className="sheet-card"><div className="sheet-head"><h3>{selecionado.nome}</h3><button className="close" onClick={() => setSelecionado(null)}>×</button></div>{selecionado.foto_url && <div className="hero-img"><img src={selecionado.foto_url} alt={selecionado.nome}/></div>}<div className="sheet-body">
      {Array.isArray(selecionado.opcoes) && selecionado.opcoes.length > 0 && <div><b>Escolha uma opção</b>{selecionado.opcoes.map((o) => <label className="opt" key={o.nome}><input type="radio" checked={opcao?.nome === o.nome} onChange={() => setOpcao(o)}/><span>{o.nome}</span><b>{brl(o.preco)}</b></label>)}</div>}
      {Array.isArray(selecionado.adicionais) && selecionado.adicionais.length > 0 && <div><b>Adicionais</b>{selecionado.adicionais.map((a) => <label className="opt" key={a.nome}><input type="checkbox" checked={adicionais.some(x => x.nome === a.nome)} onChange={() => toggleAdicional(a)}/><span>{a.nome}</span><b>+ {brl(a.preco)}</b></label>)}</div>}
      {selecionado.perguntar_talher && <div><b>Precisa de talher?</b><label className="opt"><input type="radio" name="talher" checked={talher === 'sim'} onChange={() => setTalher('sim')}/>Sim</label><label className="opt"><input type="radio" name="talher" checked={talher === 'nao'} onChange={() => setTalher('nao')}/>Não</label></div>}
      <textarea className="inp" placeholder="Observações (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)}/>
      <div className="qty"><button onClick={() => setQtd(Math.max(1,qtd-1))}>−</button><b>{qtd}</b><button onClick={() => setQtd(qtd+1)}>+</button></div>
      <button className="btn" onClick={adicionarCarrinho}>Adicionar • {brl(precoAtual()*qtd)}</button>
    </div></div></div>}

    {checkout && <div className="sheet"><div className="sheet-card"><div className="sheet-head"><h3>Seu pedido</h3><button className="close" onClick={() => setCheckout(false)}>×</button></div><div className="sheet-body">
      {carrinho.map((i) => <div className="cart-item" key={i.key}><div><b>{i.nome}{i.opcao ? ` — ${i.opcao}` : ''}</b>{i.adicionais?.length > 0 && <small>{i.adicionais.map(a=>a.nome).join(', ')}</small>}</div><div className="cart-item-actions"><button onClick={() => mudarQtd(i.key,-1)}>−</button><span>{i.qtd}</span><button onClick={() => mudarQtd(i.key,1)}>+</button><b>{brl(i.preco*i.qtd)}</b><button onClick={() => removerItem(i.key)}>×</button></div></div>)}
      <div className="checkout-block"><b>Como quer receber?</b><label className="opt"><input type="radio" checked={tipo==='entrega'} onChange={()=>setTipo('entrega')}/>Entrega</label><label className="opt"><input type="radio" checked={tipo==='retirada'} onChange={()=>setTipo('retirada')}/>Retirada</label></div>
      <div className="checkout-block"><b>Seus dados</b><input className="inp" placeholder="Nome" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/><input className="inp" placeholder="WhatsApp" value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value})}/>{tipo==='entrega' && <><input className="inp" placeholder="CEP" value={form.cep} onChange={e=>setForm({...form,cep:e.target.value})} onBlur={buscarCep}/><input className="inp" placeholder="Endereço" value={form.endereco} onChange={e=>setForm({...form,endereco:e.target.value})}/><input className="inp" placeholder="Número" value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})}/><input className="inp" placeholder="Complemento" value={form.complemento} onChange={e=>setForm({...form,complemento:e.target.value})}/><input className="inp" placeholder="Bairro" value={form.bairro} onChange={e=>setForm({...form,bairro:e.target.value})}/></>}</div>
      <div className="checkout-block"><b>Pagamento</b>{['pix','cartao','dinheiro'].map(p=><label className="opt" key={p}><input type="radio" checked={pagamento===p} onChange={()=>setPagamento(p)}/>{p==='pix'?'Pix':p==='cartao'?'Cartão na entrega':'Dinheiro'}</label>)}{pagamento==='dinheiro' && <input className="inp" placeholder="Troco para quanto?" value={trocoPara} onChange={e=>setTrocoPara(e.target.value)}/>}</div>
      {pagamento==='pix' && <div className="pix-box"><b>Pix</b><span>Chave: {PIX_CHAVE}</span><small>{PIX_NOME}</small></div>}
      <div className="cupom"><input className="inp" placeholder="Cupom" value={cupom} onChange={e=>setCupom(e.target.value.toUpperCase())}/><button onClick={validarCupom} disabled={validandoCupom}>{validandoCupom?'...':'Aplicar'}</button></div>{cupomErro && <small className="erro">{cupomErro}</small>}
      <div className="totais"><span>Subtotal <b>{brl(subtotal)}</b></span>{desconto>0&&<span>Desconto <b>− {brl(desconto)}</b></span>}{tipo==='entrega'&&<span>Entrega <b>{brl(taxaEntrega)}</b></span>}<span className="total">Total <b>{brl(total)}</b></span></div>
      {erro && <div className="erro">{erro}</div>}<button className="btn" disabled={enviando || !aberto} onClick={finalizarPedido}>{enviando?'Enviando...':aberto?'Fazer pedido':'Loja fechada'}</button>
    </div></div></div>}

    {sucesso && <div className="sheet"><div className="sheet-card"><div className="sheet-head"><h3>Pedido recebido!</h3></div><div className="sheet-body"><div className="success"><b>Pedido {sucesso.codigo}</b><p>Recebemos seu pedido. Acompanhe o andamento pelo botão abaixo.</p>{sucesso.id && <a className="btn" href={`/pedido/${sucesso.id}`}>Acompanhar pedido</a>}<button className="btn secondary" onClick={()=>setSucesso(null)}>Voltar ao cardápio</button></div></div></div></div>}
  </>;
}
