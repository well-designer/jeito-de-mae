'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const CATEGORIAS = ['Pratos do dia', 'Bebidas', 'Sobremesas', 'Extras'];

const PIX_CHAVE = '11944012837';
const PIX_NOME = 'Wellington Duarte Costa';

function brl(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function IconePrato({ tam = 34 }) {
  return <span style={{ fontSize: tam, lineHeight: 1 }}>🍽️</span>;
}

export default function Loja({ config, produtos }) {
  const [catAtiva, setCatAtiva] = useState('Todos');
  const [produtoSel, setProdutoSel] = useState(null);
  const [opcaoSel, setOpcaoSel] = useState(0);
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState('');
  const [adicionaisSel, setAdicionaisSel] = useState([]);
  const [talherSel, setTalherSel] = useState(null);
  const [carrinho, setCarrinho] = useState([]);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pedidoFeito, setPedidoFeito] = useState(null);
  const [pix, setPix] = useState(null);
  const [pago, setPago] = useState(false);
  const [cupomDigitado, setCupomDigitado] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState(null);
  const [erroCupom, setErroCupom] = useState('');
  const [validandoCupom, setValidandoCupom] = useState(false);
  const checkoutIdRef = useRef(null);
  const [form, setForm] = useState({
    nome: '', telefone: '', cep: '', endereco: '', numero: '', complemento: '', bairro: '',
    tipo: 'entrega', pagamento: 'pix', trocoPara: '',
  });

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!modal || modal !== 'pix' || !pedidoFeito?.id) return;
    let ativo = true;
    let timer;
    async function consultarPagamento() {
      try {
        const r = await fetch(`/api/pedidos/status?id=${encodeURIComponent(pedidoFeito.id)}`, { cache: 'no-store' });
        const d = await r.json();
        if (!ativo || !r.ok) return;
        if (d.status_pagamento === 'pago') {
          setPago(true);
          setModal('sucesso');
          if (timer) clearInterval(timer);
        }
      } catch {}
    }
    consultarPagamento();
    timer = setInterval(consultarPagamento, 3000);
    return () => { ativo = false; if (timer) clearInterval(timer); };
  }, [modal, pedidoFeito?.id]);

  const aberto = !!config.aberto;
  const taxaEntrega = Number(config.taxa_entrega || 0);

  const subtotal = useMemo(() => carrinho.reduce((s, i) => s + Number(i.precoUnitario || 0) * i.qtd, 0), [carrinho]);
  const desconto = useMemo(() => {
    if (!cupomAplicado) return 0;
    if (cupomAplicado.tipo === 'percentual') return subtotal * Number(cupomAplicado.valor || 0) / 100;
    return Math.min(subtotal, Number(cupomAplicado.valor || 0));
  }, [cupomAplicado, subtotal]);
  const total = Math.max(0, subtotal - desconto) + (form.tipo === 'entrega' ? taxaEntrega : 0);

  function avisar(msg) { setToast(msg); setTimeout(() => setToast(''), 2200); }
  function abrirProduto(p) { setProdutoSel(p); setOpcaoSel(0); setQtd(1); setObs(''); setAdicionaisSel([]); setTalherSel(null); setModal('produto'); }

  function adicionar() {
    const o = produtoSel.opcoes[opcaoSel];
    const adicionaisDisponiveis = Array.isArray(produtoSel.adicionais) ? produtoSel.adicionais : [];
    if (produtoSel.perguntar_talher && typeof talherSel !== 'boolean') { avisar('Escolha se deseja talher descartável'); return; }
    const adicionais = adicionaisDisponiveis.filter((a) => adicionaisSel.includes(a.nome));
    const totalAdicionais = adicionais.reduce((s, a) => s + Number(a.preco || 0), 0);
    const precoUnitario = Number((Number(o.preco) + totalAdicionais).toFixed(2));
    setCarrinho((c) => [...c, { key:`${produtoSel.id}-${Date.now()}`, produto_id:produtoSel.id, nome:produtoSel.nome, opcao:o.nome, adicionais, observacao:obs, talher:talherSel, precoUnitario, qtd }]);
    setModal(null); avisar('Adicionado ao carrinho');
  }

  function removerItem(key) { setCarrinho((c) => c.filter((i) => i.key !== key)); }
  function mudarQtd(key, delta) { setCarrinho((c) => c.map((i) => i.key === key ? {...i, qtd:Math.max(1,i.qtd+delta)} : i)); }

  async function validarCupom() {
    setErroCupom(''); setCupomAplicado(null);
    if (!cupomDigitado.trim()) return;
    setValidandoCupom(true);
    try {
      const r = await fetch('/api/cupons/validar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codigo:cupomDigitado.trim(),subtotal})});
      const d = await r.json(); if(!r.ok) throw new Error(d.erro||'Cupom inválido'); setCupomAplicado(d);
    } catch(e){setErroCupom(e.message);} finally{setValidandoCupom(false);}
  }

  async function buscarCep() {
    const cep=form.cep.replace(/\D/g,''); if(cep.length!==8)return;
    try{const r=await fetch(`https://viacep.com.br/ws/${cep}/json/`);const d=await r.json();if(!d.erro)setForm(f=>({...f,endereco:d.logradouro||f.endereco,bairro:d.bairro||f.bairro}));}catch{}
  }

  async function finalizarPedido() {
    setErro('');
    if(!form.nome.trim()||!form.telefone.trim())return setErro('Preencha nome e telefone.');
    if(form.tipo==='entrega'&&(!form.endereco.trim()||!form.numero.trim()||!form.bairro.trim()))return setErro('Preencha o endereço de entrega.');
    if(!carrinho.length)return setErro('Seu carrinho está vazio.');
    setEnviando(true);
    try{
      if(!checkoutIdRef.current) checkoutIdRef.current=crypto.randomUUID();
      const payload={cliente_nome:form.nome.trim(),cliente_telefone:form.telefone.trim(),tipo:form.tipo,pagamento:form.pagamento,troco_para:form.pagamento==='dinheiro'?form.trocoPara:null,endereco:form.tipo==='entrega'?`${form.endereco}, ${form.numero}${form.complemento?` - ${form.complemento}`:''} - ${form.bairro} - CEP ${form.cep}`:null,itens:carrinho.map(({key,...i})=>i),subtotal,desconto,taxa_entrega:form.tipo==='entrega'?taxaEntrega:0,total,cupom:cupomAplicado?.codigo||null,checkout_id:checkoutIdRef.current};
      const r=await fetch('/api/pedidos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const dados=await r.json();if(!r.ok)throw new Error(dados.erro||'Não foi possível enviar o pedido.');
      if(form.pagamento==='credito'&&dados.cartao&&!dados.cartao.aprovado){const recusado=['rejected','cancelled','canceled','expired'].includes(dados.cartao.status);if(recusado)throw new Error('O pagamento não foi aprovado. Confira os dados do cartão ou tente outra forma de pagamento.');}
      setPedidoFeito(dados.pedido);checkoutIdRef.current=null;setCarrinho([]);setCupomDigitado('');setCupomAplicado(null);setErroCupom('');
      if(dados.pix){setPago(false);setPix(dados.pix);setModal('pix');return;}
      if(form.pagamento==='credito'){setPago(!!dados.cartao?.aprovado);setModal('sucesso');return;}
      setPago(false);setModal('sucesso');
    }catch(e){setErro(e?.message||'Falha de conexão. Tente novamente.');throw e;}finally{setEnviando(false);}
  }

  const diaAtual=(()=>{const n=new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'America/Sao_Paulo'}).format(new Date());return{Monday:'segunda',Tuesday:'terca',Wednesday:'quarta',Thursday:'quinta',Friday:'sexta',Saturday:'sabado',Sunday:'domingo'}[n];})();
  const visiveis=produtos.filter(p=>p.ativo!==false&&(Array.isArray(p.dias_semana)?p.dias_semana:[]).includes(diaAtual));
  const cats=catAtiva==='Todos'?CATEGORIAS.filter(c=>visiveis.some(p=>p.categoria===c)):[catAtiva];
  const catsDisponiveis=['Todos',...CATEGORIAS.filter(c=>visiveis.some(p=>p.categoria===c))];
  const qtdCarrinho=carrinho.reduce((s,i)=>s+i.qtd,0);
  const Foto=({p,tam=34})=>p?.foto_url?<img src={p.foto_url} alt={p.nome} loading="lazy"/>:<IconePrato tam={tam}/>;

  return <>
    <header className={`topbar ${config.banner_url?'tem-banner':''}`}>
      {config.banner_url&&<><img className="banner-img" src={config.banner_url} alt=""/><div className="banner-fade"/></>}
      <div className="wrap"><div className="topbar-in">
        <div className="logo brand-logo"><img src="/jeito%20de%20m%C3%A3e%20logo%20new.png" alt="Jeito de Mãe"/></div>
        <div className="brand brand-info">{!!config.nota_media&&<div className="rating"><span className="estrela">★</span>{Number(config.nota_media).toFixed(1)}<small>({config.total_avaliacoes} avaliações)</small></div>}</div>
      </div><div className="statusbar"><span className="status-pill"><span className={`dot ${aberto?'on':'off'}`}/>{aberto?'Aberto agora':'Fechado'}</span><span className="sep">•</span><span className="status-info">{config.horario}</span>{aberto&&<><span className="sep">•</span><span className="status-info">Entrega em {config.tempo_entrega||'30–50 min'}</span></>}</div></div>
    </header>
    {!aberto&&<div className="wrap"><div className="closed-banner"><b>Loja fechada no momento.</b> Você pode consultar o cardápio e voltar no horário de atendimento.</div></div>}
    <nav className="cats"><div className="cats-in wrap">{catsDisponiveis.map(c=><button key={c} className={`cat ${catAtiva===c?'active':''}`} onClick={()=>setCatAtiva(c)}>{c}</button>)}</div></nav>
    <main className="wrap">{cats.map(cat=><section key={cat}><h2 className="sec">{cat}</h2><div className="grid">{visiveis.filter(p=>p.categoria===cat).map(p=><button className="card" key={p.id} onClick={()=>abrirProduto(p)}><div className="card-body">{p.destaque&&<span className="tag">Destaque</span>}<h3>{p.nome}</h3><p>{p.descricao}</p><div className="price">{Array.isArray(p.opcoes)&&p.opcoes.length?`A partir de ${brl(Math.min(...p.opcoes.map(o=>Number(o.preco))))}`:brl(p.preco)}</div></div><div className="thumb card-photo"><Foto p={p}/></div></button>)}</div></section>)}{!visiveis.length&&<div className="empty">Nenhum item disponível para hoje.</div>}</main>
    {!!qtdCarrinho&&<div className="cartbar"><div className="cartbar-in wrap"><button className="btn" onClick={()=>setModal('carrinho')}><span>Ver carrinho <span className="count">{qtdCarrinho}</span></span><b>{brl(total)}</b></button></div></div>}
    {modal==='produto'&&produtoSel&&<div className="sheet" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}><div className="sheet-card"><div className="sheet-head"><h3>{produtoSel.nome}</h3><button className="close" onClick={()=>setModal(null)}>×</button></div>{produtoSel.foto_url&&<div className="hero-img"><img src={produtoSel.foto_url} alt={produtoSel.nome}/></div>}<div className="sheet-body">{Array.isArray(produtoSel.opcoes)&&produtoSel.opcoes.length>0&&<div><b>Escolha uma opção</b>{produtoSel.opcoes.map((o,idx)=><label className="opt" key={o.nome}><input type="radio" checked={opcaoSel===idx} onChange={()=>setOpcaoSel(idx)}/><span>{o.nome}</span><b>{brl(o.preco)}</b></label>)}</div>}{Array.isArray(produtoSel.adicionais)&&produtoSel.adicionais.length>0&&<div><b>Adicionais</b>{produtoSel.adicionais.map(a=><label className="opt" key={a.nome}><input type="checkbox" checked={adicionaisSel.includes(a.nome)} onChange={()=>setAdicionaisSel(s=>s.includes(a.nome)?s.filter(x=>x!==a.nome):[...s,a.nome])}/><span>{a.nome}</span><b>+ {brl(a.preco)}</b></label>)}</div>}{produtoSel.perguntar_talher&&<div><b>Precisa de talher?</b><label className="opt"><input type="radio" name="talher" checked={talherSel===true} onChange={()=>setTalherSel(true)}/>Sim</label><label className="opt"><input type="radio" name="talher" checked={talherSel===false} onChange={()=>setTalherSel(false)}/>Não</label></div>}<textarea className="inp" placeholder="Observações (opcional)" value={obs} onChange={e=>setObs(e.target.value)}/><div className="qty"><button onClick={()=>setQtd(Math.max(1,qtd-1))}>−</button><b>{qtd}</b><button onClick={()=>setQtd(qtd+1)}>+</button></div><button className="btn" onClick={adicionar}>Adicionar</button></div></div></div>}
    {modal==='carrinho'&&<div className="sheet"><div className="sheet-card"><div className="sheet-head"><h3>Seu pedido</h3><button className="close" onClick={()=>setModal(null)}>×</button></div><div className="sheet-body">{carrinho.map(i=><div className="cart-item" key={i.key}><div><b>{i.nome} — {i.opcao}</b>{i.adicionais?.length>0&&<small>{i.adicionais.map(a=>a.nome).join(', ')}</small>}</div><div className="cart-item-actions"><button onClick={()=>mudarQtd(i.key,-1)}>−</button><span>{i.qtd}</span><button onClick={()=>mudarQtd(i.key,1)}>+</button><b>{brl(i.precoUnitario*i.qtd)}</b><button onClick={()=>removerItem(i.key)}>×</button></div></div>)}<button className="btn" onClick={()=>setModal('checkout')}>Continuar</button></div></div></div>}
    {modal==='checkout'&&<div className="sheet"><div className="sheet-card"><div className="sheet-head"><h3>Finalizar pedido</h3><button className="close" onClick={()=>setModal(null)}>×</button></div><div className="sheet-body"><label className="opt"><input type="radio" checked={form.tipo==='entrega'} onChange={()=>setForm({...form,tipo:'entrega'})}/>Entrega</label><label className="opt"><input type="radio" checked={form.tipo==='retirada'} onChange={()=>setForm({...form,tipo:'retirada'})}/>Retirada</label><input className="inp" placeholder="Nome" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/><input className="inp" placeholder="WhatsApp" value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value})}/>{form.tipo==='entrega'&&<><input className="inp" placeholder="CEP" value={form.cep} onChange={e=>setForm({...form,cep:e.target.value})} onBlur={buscarCep}/><input className="inp" placeholder="Endereço" value={form.endereco} onChange={e=>setForm({...form,endereco:e.target.value})}/><input className="inp" placeholder="Número" value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})}/><input className="inp" placeholder="Complemento" value={form.complemento} onChange={e=>setForm({...form,complemento:e.target.value})}/><input className="inp" placeholder="Bairro" value={form.bairro} onChange={e=>setForm({...form,bairro:e.target.value})}/></>}<div><b>Pagamento</b>{['pix','credito','dinheiro'].map(p=><label className="opt" key={p}><input type="radio" checked={form.pagamento===p} onChange={()=>setForm({...form,pagamento:p})}/>{p==='pix'?'Pix':p==='credito'?'Cartão':'Dinheiro'}</label>)}{form.pagamento==='dinheiro'&&<input className="inp" placeholder="Troco para quanto?" value={form.trocoPara} onChange={e=>setForm({...form,trocoPara:e.target.value})}/>}</div><div className="cupom"><input className="inp" placeholder="Cupom" value={cupomDigitado} onChange={e=>setCupomDigitado(e.target.value.toUpperCase())}/><button onClick={validarCupom} disabled={validandoCupom}>{validandoCupom?'...':'Aplicar'}</button></div>{erroCupom&&<small className="erro">{erroCupom}</small>}<div className="totais"><span>Subtotal <b>{brl(subtotal)}</b></span>{desconto>0&&<span>Desconto <b>− {brl(desconto)}</b></span>}{form.tipo==='entrega'&&<span>Entrega <b>{brl(taxaEntrega)}</b></span>}<span className="total">Total <b>{brl(total)}</b></span></div>{erro&&<div className="erro">{erro}</div>}<button className="btn" disabled={enviando||!aberto} onClick={finalizarPedido}>{enviando?'Enviando...':aberto?'Fazer pedido':'Loja fechada'}</button></div></div></div>}
    {modal==='pix'&&pix&&<div className="sheet"><div className="sheet-card"><div className="sheet-head"><h3>Pagamento Pix</h3></div><div className="sheet-body"><div className="pix-box"><b>Finalize o pagamento</b>{pix.qr_code_base64&&<img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code Pix"/>}<textarea className="inp" readOnly value={pix.qr_code||''}/><small>Assim que o pagamento for confirmado, esta tela atualiza automaticamente.</small></div></div></div></div>}
    {modal==='sucesso'&&pedidoFeito&&<div className="sheet"><div className="sheet-card"><div className="sheet-head"><h3>Pedido recebido!</h3></div><div className="sheet-body"><div className="success"><b>Pedido {pedidoFeito.codigo}</b><p>{pago?'Pagamento confirmado. ':'Recebemos seu pedido. '}Acompanhe o andamento pelo botão abaixo.</p><a className="btn" href={`/pedido/${pedidoFeito.id}`}>Acompanhar pedido</a><button className="btn secondary" onClick={()=>setModal(null)}>Voltar ao cardápio</button></div></div></div></div>}
    {toast&&<div className="toast">{toast}</div>}
  </>;
}
