'use client';

import { useEffect, useMemo, useState } from 'react';
import { brl } from '@/lib/format';

const categorias = [
  ['alimentos','Alimentos'],['carnes','Carnes'],['hortifruti','Hortifruti'],
  ['embalagens','Embalagens'],['bebidas','Bebidas'],['gas','Gás'],
  ['limpeza','Limpeza'],['entrega','Entrega'],['taxas','Taxas'],
  ['marketing','Marketing'],['outros','Outros'],
];
const unidades = ['kg','g','l','ml','un','pacote','caixa','fardo','bandeja','saco'];

export default function FinanceiroV15(){
  const [periodo,setPeriodo]=useState('semana');
  const [rel,setRel]=useState(null);
  const [despesas,setDespesas]=useState([]);
  const [carregando,setCarregando]=useState(true);
  const [salvando,setSalvando]=useState(false);
  const [erro,setErro]=useState('');
  const hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  const [form,setForm]=useState({descricao:'',categoria:'alimentos',valor:'',data:hoje,fornecedor:'',quantidade:'',unidade:'kg',valor_unitario:'',observacao:''});

  async function carregar(){
    setCarregando(true);setErro('');
    try{
      const [a,b]=await Promise.all([
        fetch(`/api/admin/relatorio?periodo=${periodo}`,{cache:'no-store'}),
        fetch('/api/admin/despesas',{cache:'no-store'})
      ]);
      const ra=await a.json(), rb=await b.json();
      if(!a.ok) throw new Error(ra.erro||'Falha no relatório');
      if(!b.ok) throw new Error(rb.erro||'Falha nas despesas');
      setRel(ra.relatorio||null);setDespesas(rb.despesas||[]);
    }catch(e){setErro(e.message||'Falha ao carregar financeiro');}
    finally{setCarregando(false)}
  }
  useEffect(()=>{carregar()},[periodo]);

  const totalLista=useMemo(()=>despesas.reduce((s,d)=>s+Number(d.valor||0),0),[despesas]);
  function mudar(k,v){setForm(f=>({...f,[k]:v}))}

  async function salvar(e){
    e.preventDefault();setErro('');
    const valor=Number(String(form.valor).replace(',','.'));
    if(!form.descricao.trim()||!Number.isFinite(valor)||valor<=0)return setErro('Preencha descrição e valor corretamente.');
    setSalvando(true);
    try{
      const payload={...form,descricao:form.descricao.trim(),valor,
        quantidade:form.quantidade===''?null:Number(String(form.quantidade).replace(',','.')),
        valor_unitario:form.valor_unitario===''?null:Number(String(form.valor_unitario).replace(',','.'))};
      const r=await fetch('/api/admin/despesas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const d=await r.json(); if(!r.ok)throw new Error(d.erro||'Falha ao salvar');
      setForm({descricao:'',categoria:'alimentos',valor:'',data:hoje,fornecedor:'',quantidade:'',unidade:'kg',valor_unitario:'',observacao:''});
      await carregar();
    }catch(e){setErro(e.message||'Falha ao salvar despesa')}finally{setSalvando(false)}
  }

  async function excluir(id){
    if(!confirm('Excluir esta despesa?'))return;
    const r=await fetch(`/api/admin/despesas?id=${id}`,{method:'DELETE'}); if(r.ok)await carregar();
  }

  return <div className="fin15">
    <div className="fin15-head"><div><small>GESTÃO</small><h1>Financeiro</h1><p>Vendas, custos e resultado da operação.</p></div>
      <select value={periodo} onChange={e=>setPeriodo(e.target.value)}><option value="hoje">Hoje</option><option value="semana">Esta semana</option><option value="semana_passada">Semana passada</option><option value="mes">Este mês</option><option value="tudo">Tudo</option></select>
    </div>
    {erro&&<div className="fin15-erro">{erro}</div>}
    {carregando?<div className="fin15-loading">Atualizando números…</div>:<>
      <div className="fin15-kpis">
        <article><span>Faturamento</span><b>{brl(rel?.totalValor||0)}</b><small>{rel?.totalVendas||0} pedidos pagos</small></article>
        <article><span>Despesas</span><b>{brl(rel?.totalDespesas||0)}</b><small>{rel?.quantidadeDespesas||0} lançamentos no período</small></article>
        <article className={(rel?.resultadoOperacional||0)<0?'negativo':'positivo'}><span>Resultado</span><b>{brl(rel?.resultadoOperacional||0)}</b><small>faturamento − despesas</small></article>
        <article><span>Ticket médio</span><b>{brl(rel?.ticketMedio||0)}</b><small>{rel?.entregas||0} entregas · {rel?.retiradas||0} retiradas</small></article>
      </div>
      <section className="fin15-card"><div className="fin15-card-title"><div><h2>Novo gasto</h2><p>Registre compras de alimentos, embalagens e demais custos.</p></div></div>
        <form onSubmit={salvar} className="fin15-form">
          <label className="wide">Descrição<input value={form.descricao} onChange={e=>mudar('descricao',e.target.value)} placeholder="Ex.: Arroz tipo 1"/></label>
          <label>Categoria<select value={form.categoria} onChange={e=>mudar('categoria',e.target.value)}>{categorias.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
          <label>Data<input type="date" value={form.data} onChange={e=>mudar('data',e.target.value)}/></label>
          <label>Quantidade<input inputMode="decimal" value={form.quantidade} onChange={e=>mudar('quantidade',e.target.value)} placeholder="5"/></label>
          <label>Unidade<select value={form.unidade} onChange={e=>mudar('unidade',e.target.value)}>{unidades.map(x=><option key={x}>{x}</option>)}</select></label>
          <label>Valor unitário<input inputMode="decimal" value={form.valor_unitario} onChange={e=>mudar('valor_unitario',e.target.value)} placeholder="0,00"/></label>
          <label>Valor total *<input inputMode="decimal" value={form.valor} onChange={e=>mudar('valor',e.target.value)} placeholder="0,00"/></label>
          <label className="wide">Fornecedor<input value={form.fornecedor} onChange={e=>mudar('fornecedor',e.target.value)} placeholder="Mercado / fornecedor"/></label>
          <label className="wide">Observação<textarea value={form.observacao} onChange={e=>mudar('observacao',e.target.value)} placeholder="Opcional"/></label>
          <button disabled={salvando}>{salvando?'Salvando…':'+ Registrar despesa'}</button>
        </form>
      </section>
      <section className="fin15-card"><div className="fin15-card-title"><div><h2>Despesas cadastradas</h2><p>Total registrado: {brl(totalLista)}</p></div><a href={`/api/admin/relatorio?periodo=${periodo}&formato=xlsx`}>Exportar relatório</a></div>
        <div className="fin15-lista">{despesas.length===0?<p className="vazio">Nenhuma despesa cadastrada.</p>:despesas.map(d=><article key={d.id}><div><b>{d.descricao}</b><small>{categorias.find(x=>x[0]===d.categoria)?.[1]||d.categoria} · {d.data}{d.fornecedor?` · ${d.fornecedor}`:''}</small>{d.quantidade&&<small>{d.quantidade} {d.unidade||''}{d.valor_unitario?` · ${brl(d.valor_unitario)}/un.`:''}</small>}</div><strong>{brl(d.valor)}</strong><button onClick={()=>excluir(d.id)} aria-label="Excluir despesa">×</button></article>)}</div>
      </section>
    </>}
    <style jsx>{`
      .fin15{max-width:1100px;margin:auto;padding:24px 18px 110px;color:#241d1f}.fin15-head{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:18px}.fin15-head small{font-weight:900;color:#8b263d;letter-spacing:.12em}.fin15 h1{font-size:30px;margin:3px 0}.fin15 p{margin:0;color:#786f71}.fin15 select,.fin15 input,.fin15 textarea{border:1px solid #e5dcda;background:#fff;border-radius:12px;padding:11px 12px;font:inherit;outline:none}.fin15-head select{min-width:170px}.fin15-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.fin15-kpis article,.fin15-card{background:#fff;border:1px solid #ece4e1;border-radius:18px;box-shadow:0 5px 20px rgba(40,25,29,.045)}.fin15-kpis article{padding:16px}.fin15-kpis span,.fin15-kpis small{display:block;color:#817779;font-size:12px}.fin15-kpis b{display:block;font-size:22px;margin:5px 0}.fin15-kpis .positivo b{color:#23754a}.fin15-kpis .negativo b{color:#b3262e}.fin15-card{padding:18px;margin-top:12px}.fin15-card-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:15px}.fin15-card-title h2{margin:0 0 3px;font-size:18px}.fin15-card-title p{font-size:12px}.fin15-card-title a{font-size:12px;font-weight:800;color:#7b263d;text-decoration:none;background:#f8ecef;padding:9px 11px;border-radius:10px}.fin15-form{display:grid;grid-template-columns:repeat(4,1fr);gap:11px}.fin15-form label{font-size:12px;font-weight:800;color:#655b5e;display:grid;gap:6px}.fin15-form label.wide{grid-column:span 2}.fin15-form textarea{min-height:76px;resize:vertical}.fin15-form button{grid-column:1/-1;border:0;background:#8b263d;color:#fff;padding:13px;border-radius:12px;font-weight:900;font-size:14px}.fin15-form button:disabled{opacity:.6}.fin15-lista{display:grid;gap:8px}.fin15-lista article{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:12px;border:1px solid #eee7e4;border-radius:14px}.fin15-lista b,.fin15-lista small{display:block}.fin15-lista small{font-size:11px;color:#817779;margin-top:3px}.fin15-lista strong{white-space:nowrap}.fin15-lista button{width:32px;height:32px;border:0;border-radius:10px;background:#fff0f0;color:#a3292f;font-size:20px}.fin15-erro{padding:12px;border-radius:12px;background:#fff0f0;color:#9e2830;margin-bottom:12px}.fin15-loading,.vazio{padding:30px;text-align:center;color:#817779}
      @media(max-width:700px){.fin15{padding:16px 12px 105px}.fin15-head{align-items:stretch;flex-direction:column}.fin15-head h1{font-size:25px}.fin15-head select{width:100%;min-height:44px}.fin15-kpis{grid-template-columns:1fr 1fr}.fin15-kpis article{padding:13px}.fin15-kpis b{font-size:18px}.fin15-card{padding:14px;border-radius:17px}.fin15-form{grid-template-columns:1fr 1fr}.fin15-form label.wide{grid-column:1/-1}.fin15-form input,.fin15-form select,.fin15-form textarea{min-width:0;font-size:16px}.fin15-card-title{align-items:flex-start}.fin15-lista article{grid-template-columns:1fr auto}.fin15-lista article button{grid-column:2}.fin15-lista strong{align-self:start}.fin15-card-title a{white-space:nowrap}}
    `}</style>
  </div>
}
