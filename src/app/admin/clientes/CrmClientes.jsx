'use client';

import { useMemo, useState } from 'react';

const fmt = n => Number(n || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
const dataBR = s => s ? new Date(s).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}) : '—';
const SEG = ['Todos','Novo','Recorrente ativo','Inativo','Recorrente inativo','VIP'];
const css = {
  card:{background:'#fffdf9',border:'1px solid #e6dccb',borderRadius:10,padding:16},
  input:{padding:'10px 12px',border:'1px solid #d9cdbb',borderRadius:8,background:'#fffdf9',maxWidth:'100%'},
  button:{padding:'8px 12px',border:'1px solid #d9cdbb',borderRadius:8,background:'#fffdf9',cursor:'pointer'},
  th:{textAlign:'left',padding:'12px 10px',borderBottom:'1px solid #e6dccb',fontSize:12,color:'#756454'},
  td:{padding:'12px 10px',borderBottom:'1px solid #eee6db',verticalAlign:'top'},
};
function downloadCsv(rows){
  const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='clientes-jeito-de-mae.csv';a.click();
  URL.revokeObjectURL(url);
}
export default function CrmClientes({clientes=[],limite=1000}){
  const [busca,setBusca]=useState('');
  const [segmento,setSegmento]=useState('Todos');
  const [ordem,setOrdem]=useState('ultima');
  const [selecionado,setSelecionado]=useState(null);
  const [pagina,setPagina]=useState(1);
  const filtrados=useMemo(()=>{
    const q=busca.toLocaleLowerCase('pt-BR').trim(), numeros=q.replace(/\D/g,'');
    return clientes.filter(c=>(!q||c.nome.toLocaleLowerCase('pt-BR').includes(q)||(numeros&&c.telefone.includes(numeros)))&&(segmento==='Todos'||(segmento==='VIP'?c.vip:c.segmento===segmento)))
      .sort((a,b)=>ordem==='pedidos'?b.pedidos-a.pedidos:ordem==='valor'?b.total-a.total:ordem==='nome'?a.nome.localeCompare(b.nome,'pt-BR'):String(b.ultima).localeCompare(String(a.ultima)));
  },[clientes,busca,segmento,ordem]);
  const porPagina=15, paginas=Math.max(1,Math.ceil(filtrados.length/porPagina));
  const atual=Math.min(pagina,paginas);
  const resumo=[
    ['Clientes',clientes.length],['Recorrentes',clientes.filter(c=>c.pedidos>=2).length],
    ['Inativos (30 dias)',clientes.filter(c=>c.diasSemComprar>=30).length],
    ['VIPs',clientes.filter(c=>c.vip).length]
  ];
  return <div style={{fontFamily:'system-ui,sans-serif',color:'#2b2118'}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:18}}>
      {resumo.map(([rotulo,valor])=><div key={rotulo} style={css.card}><div style={{fontSize:13,color:'#756454'}}>{rotulo}</div><strong style={{fontSize:28}}>{valor}</strong></div>)}
    </div>
    <section style={css.card}>
      <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center',marginBottom:16}}>
        <input aria-label="Buscar clientes" placeholder="Buscar nome ou telefone" value={busca} onChange={e=>{setBusca(e.target.value);setPagina(1)}} style={{...css.input,flex:'1 1 200px'}}/>
        <select aria-label="Segmento" value={segmento} onChange={e=>{setSegmento(e.target.value);setPagina(1)}} style={css.input}>{SEG.map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Ordenar clientes" value={ordem} onChange={e=>setOrdem(e.target.value)} style={css.input}>
          <option value="ultima">Última compra</option><option value="pedidos">Mais pedidos</option><option value="valor">Maior valor pago</option><option value="nome">Nome</option>
        </select>
        <button style={css.button} onClick={()=>downloadCsv([['Nome','Telefone','Pedidos válidos','Total pago','Última compra','Segmento'],...filtrados.map(c=>[c.nome,c.telefone,c.pedidos,c.total.toFixed(2),dataBR(c.ultima),c.segmento])])}>Exportar CSV</button>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:650}}>
          <thead><tr>{['Cliente','Última compra','Pedidos','Total pago','Segmento'].map(t=><th key={t} style={css.th}>{t}</th>)}</tr></thead>
          <tbody>{filtrados.slice((atual-1)*porPagina,atual*porPagina).map(c=><tr key={c.id}>
            <td style={css.td}><button onClick={()=>setSelecionado(c)} style={{background:'none',border:0,padding:0,textAlign:'left',cursor:'pointer',color:'#a9432a',fontWeight:700}}>{c.nome}</button><div style={{fontSize:12,color:'#756454'}}>{c.telefone}</div></td>
            <td style={css.td}>{dataBR(c.ultima)}</td><td style={css.td}>{c.pedidos}</td><td style={css.td}>{fmt(c.total)}</td>
            <td style={css.td}>{c.segmento}{c.vip?' · VIP':''}</td>
          </tr>)}</tbody>
        </table>
        {!filtrados.length&&<p>Nenhum cliente encontrado.</p>}
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:12,flexWrap:'wrap'}}>
        <span style={{color:'#756454'}}>{filtrados.length} cliente(s) · página {atual} de {paginas}</span>
        <div style={{display:'flex',gap:8}}><button style={css.button} disabled={atual===1} onClick={()=>setPagina(atual-1)}>Anterior</button><button style={css.button} disabled={atual===paginas} onClick={()=>setPagina(atual+1)}>Próxima</button></div>
      </div>
    </section>
    <p style={{fontSize:12,color:'#756454'}}>Dados derivados dos até {limite.toLocaleString('pt-BR')} pedidos mais recentes. Segmentação e valores podem estar incompletos se houver mais pedidos no histórico. VIP: 10 compras válidas ou R$ 500 pagos (critério inicial, apenas para o CRM).</p>
    {selecionado&&<div role="presentation" onClick={()=>setSelecionado(null)} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(30,20,12,.55)',display:'flex',justifyContent:'flex-end'}}>
      <section role="dialog" aria-modal="true" aria-label={'Perfil de '+selecionado.nome} onClick={e=>e.stopPropagation()} style={{background:'#fffdf9',width:'min(650px,100%)',height:'100%',overflowY:'auto',padding:24}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'start'}}><div><h2 style={{margin:'0 0 4px'}}>{selecionado.nome}</h2><div>{selecionado.telefone}</div></div><button style={css.button} onClick={()=>setSelecionado(null)}>Fechar</button></div>
        <h3>Resumo do cliente</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
          {[['Compras válidas',selecionado.pedidos],['Total pago',fmt(selecionado.total)],['Ticket médio',fmt(selecionado.pedidos?selecionado.total/selecionado.pedidos:0)],['Última compra',dataBR(selecionado.ultima)]].map(([k,v])=><div key={k} style={css.card}><small>{k}</small><div style={{fontSize:20,fontWeight:700}}>{v}</div></div>)}
        </div>
        <h3>Preferências de consumo</h3>
        {selecionado.produtosFavoritos?.length ? <div style={css.card}>
          <strong>Pratos mais pedidos</strong>
          <ul>{selecionado.produtosFavoritos.map(([nome,quantidade])=><li key={nome}>{nome} · {quantidade} unidade(s)</li>)}</ul>
          <strong>Dias da semana com mais compras</strong>
          <div style={{display:'grid',gap:6,marginTop:8}}>
            {['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map((dia,i)=><div key={dia} style={{display:'flex',justifyContent:'space-between',gap:10}}><span>{dia}</span><strong>{selecionado.diasSemana?.[i]||0} pedido(s)</strong></div>)}
          </div>
          <p style={{fontSize:12,color:'#756454'}}>Preferências estimadas apenas pelos pedidos válidos disponíveis no histórico consultado.</p>
        </div> : <p style={{color:'#756454'}}>Ainda não há itens suficientes no histórico consultado para identificar preferências.</p>}
        <h3>Histórico recente de pedidos</h3>
        {selecionado.historico.map(p=><details key={p.id} style={{...css.card,marginBottom:8}}>
          <summary style={{cursor:'pointer'}}>{dataBR(p.criado_em)} · {fmt(p.total)} · {p.status}</summary>
          <p>Pagamento: {p.status_pagamento||'não informado'}</p>
          {Array.isArray(p.itens)?<ul>{p.itens.map((item,i)=><li key={i}>{String(item.quantidade??item.qtd??1)}× {String(item.nome??item.name??'Produto')}</li>)}</ul>:<p>Itens indisponíveis neste pedido.</p>}
        </details>)}
        {!selecionado.historico.length&&<p>Sem pedidos no histórico consultado.</p>}
        <p style={{fontSize:12,color:'#756454'}}>O histórico completo e a fidelidade serão conectados em etapas posteriores. Nenhum resgate ou mensagem é realizado por esta tela.</p>
      </section>
    </div>}
  </div>;
}
