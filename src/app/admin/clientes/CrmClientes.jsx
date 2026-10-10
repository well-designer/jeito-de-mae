'use client';

import { useMemo, useRef, useState } from 'react';

const fmt = n => Number(n || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
const dataBR = s => s ? new Date(s).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}) : '—';
const statusPromocional = s => ({autorizado:'Autorizado (registro interno)',revogado:'Revogado',nao_informado:'Não informado',indisponivel:'Indisponível'})[s]||'Não informado';
const SEG = ['Todos','Novo','Recorrente ativo','Inativo','Recorrente inativo','VIP'];
const precisaAcompanhamento = c => c.pedidos > 0 && c.diasSemComprar !== null && c.diasSemComprar >= 30
  && (!c.ultimoContato || Date.now() - new Date(c.ultimoContato).getTime() >= 14 * 86400000);
const css = {
  card:{background:'#fffdf9',border:'1px solid #e6dccb',borderRadius:10,padding:16},
  input:{padding:'10px 12px',border:'1px solid #d9cdbb',borderRadius:8,background:'#fffdf9',maxWidth:'100%'},
  button:{padding:'8px 12px',border:'1px solid #d9cdbb',borderRadius:8,background:'#fffdf9',cursor:'pointer'},
  th:{textAlign:'left',padding:'12px 10px',borderBottom:'1px solid #e6dccb',fontSize:12,color:'#756454'},
  td:{padding:'12px 10px',borderBottom:'1px solid #eee6db',verticalAlign:'top'},
};
function downloadCsv(rows){
  const csv='\uFEFF'+rows.map(row=>row.map(v=>{
    const valor=String(v??'');
    const seguro=/^[\\s]*[=+@-]/.test(valor)?"'"+valor:valor;
    return '"'+seguro.replace(/"/g,'""')+'"';
  }).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='clientes-jeito-de-mae.csv';a.click();
  URL.revokeObjectURL(url);
}
export default function CrmClientes({clientes=[],limite=1000}){
  const [busca,setBusca]=useState('');
  const [segmento,setSegmento]=useState('Todos');
  const [ordem,setOrdem]=useState('ultima');
  const [somenteAcompanhamento,setSomenteAcompanhamento]=useState(false);
  const [selecionado,setSelecionado]=useState(null);
  const [pagina,setPagina]=useState(1);
  const [mensagemAtendimento,setMensagemAtendimento]=useState('');
  const [aba,setAba]=useState('clientes');
  const [publicoCampanha,setPublicoCampanha]=useState('Todos');
  const [buscaCampanha,setBuscaCampanha]=useState('');
  const [previaServidor,setPreviaServidor]=useState(null);
  const [consultandoPrevia,setConsultandoPrevia]=useState(false);
  const [contatos,setContatos]=useState([]);
  const consultaAtual=useRef(0);
  const [statusContato,setStatusContato]=useState('');
  const [observacao,setObservacao]=useState('');
  const [consentimento,setConsentimento]=useState('nao_informado');
  const [notaConsentimento,setNotaConsentimento]=useState('');
  const [historicoConsentimento,setHistoricoConsentimento]=useState([]);
  const [salvandoConsentimento,setSalvandoConsentimento]=useState(false);
  const [carregandoPreferencia,setCarregandoPreferencia]=useState(false);
  const [erroPreferencia,setErroPreferencia]=useState('');
  const [salvandoContato,setSalvandoContato]=useState(false);
  const selecionarAtendimento=async id=>{
    const consulta=++consultaAtual.current;
    const cliente=clientes.find(c=>c.id===id)||null;
    setSelecionado(cliente);setMensagemAtendimento('');setContatos([]);setStatusContato('');
    setConsentimento('nao_informado');setNotaConsentimento('');setHistoricoConsentimento([]);setErroPreferencia('');setCarregandoPreferencia(!!cliente);
    if(!cliente)return;
    try{
      const r=await fetch('/api/admin/crm/contatos?cliente='+encodeURIComponent(cliente.id));
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||'Histórico indisponível');
      if(consulta===consultaAtual.current)setContatos(d.contatos||[]);
      const rc=await fetch('/api/admin/crm/consentimentos?cliente='+encodeURIComponent(cliente.id));
      const dc=await rc.json();
      if(!rc.ok)throw Error(dc.erro||'Preferências indisponíveis');
      if(consulta===consultaAtual.current){setConsentimento(dc.consentimento?.status||'nao_informado');setNotaConsentimento(dc.consentimento?.observacao||'');setHistoricoConsentimento(dc.historico||[]);}
    }catch(e){if(consulta===consultaAtual.current){setStatusContato(e.message);setErroPreferencia(e.message)}}
    finally{if(consulta===consultaAtual.current)setCarregandoPreferencia(false)}
  };
  const salvarConsentimento=async()=>{
    if(!selecionado||salvandoConsentimento||carregandoPreferencia||erroPreferencia)return;
    setSalvandoConsentimento(true);setStatusContato('');
    try{
      const r=await fetch('/api/admin/crm/consentimentos',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({cliente_chave:selecionado.id,cliente_nome:selecionado.nome,status:consentimento,observacao:notaConsentimento})});
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||'Não foi possível salvar');
      const rc=await fetch('/api/admin/crm/consentimentos?cliente='+encodeURIComponent(selecionado.id));
      if(rc.ok){const dc=await rc.json();setHistoricoConsentimento(dc.historico||[]);}
      setStatusContato('Preferência registrada. Nenhuma mensagem foi enviada.');
    }catch(e){setStatusContato(e.message)}
    finally{setSalvandoConsentimento(false)}
  };
  const registrarContato=async()=>{
    if(!selecionado||salvandoContato)return;
    setSalvandoContato(true);setStatusContato('');
    try{
      const r=await fetch('/api/admin/crm/contatos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cliente_chave:selecionado.id,cliente_nome:selecionado.nome,observacao})});
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||'Falha ao registrar');
      setContatos(prev=>[d.contato,...prev]);setObservacao('');
      setStatusContato('Atendimento registrado manualmente. Isto não comprova envio da mensagem.');
    }catch(e){setStatusContato(e.message)}
    finally{setSalvandoContato(false)}
  };
  const telefoneWhatsApp = cliente => {
    const n=String(cliente?.telefone||'').replace(/\D/g,'');
    const numero=n.length===11?'55'+n:n;
    return /^55\d{10,11}$/.test(numero)?numero:null;
  };
  const abrirWhatsApp = cliente => {
    const numero=telefoneWhatsApp(cliente);
    if(!numero)return;
    const texto=mensagemAtendimento.trim();
    if(!texto)return;
    window.open('https://wa.me/'+numero+'?text='+encodeURIComponent(texto),'_blank','noopener,noreferrer');
  };
  const filtrados=useMemo(()=>{
    const q=busca.toLocaleLowerCase('pt-BR').trim(), numeros=q.replace(/\D/g,'');
    return clientes.filter(c=>(!q||c.nome.toLocaleLowerCase('pt-BR').includes(q)||(numeros&&c.telefone.includes(numeros)))&&(segmento==='Todos'||(segmento==='VIP'?c.vip:c.segmento===segmento))&&(!somenteAcompanhamento||precisaAcompanhamento(c)))
      .sort((a,b)=>ordem==='pedidos'?b.pedidos-a.pedidos:ordem==='valor'?b.total-a.total:ordem==='nome'?a.nome.localeCompare(b.nome,'pt-BR'):String(b.ultima).localeCompare(String(a.ultima)));
  },[clientes,busca,segmento,ordem,somenteAcompanhamento]);
  const porPagina=15, paginas=Math.max(1,Math.ceil(filtrados.length/porPagina));
  const atual=Math.min(pagina,paginas);
  // Simulacao visual: autorizacao administrativa nao habilita envio.
  const publicoElegivel=useMemo(()=>clientes.filter(c=>
    c.consentimentoPromocional==='autorizado' &&
    (publicoCampanha==='Todos'||(publicoCampanha==='VIP'?c.vip:c.segmento===publicoCampanha)) &&
    (!buscaCampanha.trim()||c.nome.toLocaleLowerCase('pt-BR').includes(buscaCampanha.toLocaleLowerCase('pt-BR').trim()))
  ),[clientes,publicoCampanha,buscaCampanha]);
  const conferirPrevia=async()=>{
    if(consultandoPrevia)return;
    setConsultandoPrevia(true);setPreviaServidor(null);
    try{
      const r=await fetch('/api/admin/crm/campanhas/previa',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({segmento:publicoCampanha,clientes:clientes.filter(c=>
          (publicoCampanha==='Todos'||(publicoCampanha==='VIP'?c.vip:c.segmento===publicoCampanha)) &&
          (!buscaCampanha.trim()||c.nome.toLocaleLowerCase('pt-BR').includes(buscaCampanha.toLocaleLowerCase('pt-BR').trim()))
        ).map(c=>c.id)})
      });
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||'Consulta indisponível');
      setPreviaServidor({quantidade:d.quantidade,excluidos:d.excluidos});
    }catch(e){setPreviaServidor({erro:e.message})}
    finally{setConsultandoPrevia(false)}
  };
  const resumo=[
    ['Clientes',clientes.length],['Recorrentes',clientes.filter(c=>c.pedidos>=2).length],
    ['Inativos (30 dias)',clientes.filter(c=>c.diasSemComprar>=30).length],
    ['VIPs',clientes.filter(c=>c.vip).length],['Com atendimento',clientes.filter(c=>c.ultimoContato).length],['A acompanhar',clientes.filter(precisaAcompanhamento).length]
  ];
  return <div style={{fontFamily:'system-ui,sans-serif',color:'#2b2118'}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10,marginBottom:18}}>
      {resumo.map(([rotulo,valor])=><div key={rotulo} style={css.card}><div style={{fontSize:13,color:'#756454'}}>{rotulo}</div><strong style={{fontSize:28}}>{valor}</strong></div>)}
    </div>
    <nav aria-label="Seções do CRM" style={{display:'flex',gap:8,marginBottom:14}}>
      <button style={{...css.button,background:aba==='clientes'?'#b4492b':'#fffdf9',color:aba==='clientes'?'white':'#2b2118'}} onClick={()=>setAba('clientes')}>Clientes</button>
      <button style={{...css.button,background:aba==='relacionamento'?'#b4492b':'#fffdf9',color:aba==='relacionamento'?'white':'#2b2118'}} onClick={()=>setAba('relacionamento')}>Relacionamento</button>
      <button style={{...css.button,background:aba==='campanhas'?'#b4492b':'#fffdf9',color:aba==='campanhas'?'white':'#2b2118'}} onClick={()=>setAba('campanhas')}>Campanhas (simulação)</button>
    </nav>
    {aba==='campanhas'&&<section style={css.card}>
      <h2 style={{fontFamily:'Georgia,serif',marginTop:0}}>Público de campanhas · simulação</h2>
      <p>Prévia somente para planejamento. Não cria campanhas, não exporta contatos e não envia mensagens. Autorização administrativa não equivale a opt-in verificável.</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14}}>
        <select aria-label="Público da campanha" value={publicoCampanha} onChange={e=>{setPublicoCampanha(e.target.value);setPreviaServidor(null)}} style={css.input}>
          {SEG.map(x=><option key={x}>{x}</option>)}
        </select>
        <input aria-label="Buscar público" placeholder="Buscar pelo nome" value={buscaCampanha} onChange={e=>{setBuscaCampanha(e.target.value);setPreviaServidor(null)}} style={css.input}/>
      </div>
      <p><strong>{publicoElegivel.length}</strong> cliente(s) com registro administrativo de autorização dentro do filtro selecionado (dados carregados).</p>
      <button style={css.button} onClick={conferirPrevia} disabled={consultandoPrevia}>{consultandoPrevia?'Conferindo…':'Conferir preferências no servidor'}</button>
      {previaServidor?.erro&&<p role="alert">{previaServidor.erro}</p>}
      {previaServidor&&!previaServidor.erro&&<p role="status">Conferência atual no Supabase: <strong>{previaServidor.quantidade}</strong> registro(s) autorizados e {previaServidor.excluidos} excluído(s). Apenas simulação, não autoriza envios.</p>}
      <p style={{fontSize:13,color:'#756454'}}>Clientes com consentimento revogado, não informado ou indisponível ficam excluídos. A seleção é uma fotografia dos dados carregados e não deve ser usada como autorização de envio.</p>
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><th style={css.th}>Cliente</th><th style={css.th}>Segmento</th><th style={css.th}>Preferência</th></tr></thead>
        <tbody>{publicoElegivel.slice(0,50).map(c=><tr key={c.id}><td style={css.td}>{c.nome}</td><td style={css.td}>{c.segmento}{c.vip?' · VIP':''}</td><td style={css.td}>Registro interno</td></tr>)}</tbody>
      </table></div>
      {publicoElegivel.length>50&&<p style={{fontSize:13}}>Exibindo somente os primeiros 50 resultados.</p>}
    </section>}
    {aba==='relacionamento'&&<section style={css.card}>
      <h2 style={{fontFamily:'Georgia,serif',marginTop:0}}>Relacionamento · atendimento manual</h2>
      <p>Abra uma conversa de atendimento no WhatsApp com um cliente. O envio depende da confirmação manual no WhatsApp. Esta tela não envia mensagens automaticamente e não registra entrega.</p>
      <p style={{color:'#756454',fontSize:13}}>Campanhas promocionais, como reativação e ofertas, permanecerão desativadas até existir registro confiável de consentimento e descadastro.</p>
      <label style={{display:'block',marginBottom:8}}>Cliente
        <select aria-label="Cliente para atendimento" style={{...css.input,display:'block',width:'100%',marginTop:5}} value={selecionado?.id||''} onChange={e=>selecionarAtendimento(e.target.value)}>
          <option value="">Selecione um cliente</option>
          {clientes.filter(c=>telefoneWhatsApp(c)).map(c=><option key={c.id} value={c.id}>{c.nome} · {c.telefone}</option>)}
        </select>
      </label>
      <label style={{display:'block'}}>Mensagem de atendimento
        <textarea aria-label="Mensagem de atendimento" style={{...css.input,display:'block',width:'100%',minHeight:100,marginTop:5}} value={mensagemAtendimento} onChange={e=>setMensagemAtendimento(e.target.value)} placeholder="Olá! Aqui é do Jeito de Mãe. Como podemos ajudar?" />
      </label>
      <button style={{...css.button,marginTop:12,background:'#b4492b',color:'white'}} disabled={!selecionado||!telefoneWhatsApp(selecionado)||!mensagemAtendimento.trim()} onClick={()=>abrirWhatsApp(selecionado)}>Abrir conversa no WhatsApp</button>
      <div style={{marginTop:24,borderTop:'1px solid #e6dccb',paddingTop:16}}>
        <h3>Preferências de mensagens promocionais</h3>
        {carregandoPreferencia&&<p role="status">Carregando preferência do cliente…</p>}
        {erroPreferencia&&<p role="alert">Não foi possível confirmar a preferência anterior. Selecione novamente o cliente antes de editar.</p>}
        <p style={{fontSize:13,color:'#756454'}}>Registre apenas o que o cliente informou. Este registro não é prova independente de autorização. Nenhuma campanha será enviada por esta tela.</p>
        <label style={{display:'block',marginBottom:8}}>Situação
          <select style={{...css.input,display:'block',marginTop:5}} value={consentimento} onChange={e=>setConsentimento(e.target.value)}>
            <option value="nao_informado">Não informado</option><option value="autorizado">Autorizado pelo cliente</option><option value="revogado">Não deseja receber / revogou</option>
          </select>
        </label>
        <textarea aria-label="Registro da preferência" style={{...css.input,width:'100%',minHeight:64}} maxLength={1000}
          value={notaConsentimento} onChange={e=>setNotaConsentimento(e.target.value)} placeholder="Como e quando o cliente manifestou a preferência?"/>
        <button style={{...css.button,marginTop:8}} disabled={!selecionado||salvandoConsentimento||carregandoPreferencia||!!erroPreferencia||(consentimento==='autorizado'&&!notaConsentimento.trim())}
          onClick={salvarConsentimento}>{salvandoConsentimento?'Salvando…':'Salvar preferência'}</button>
        <h4>Histórico de preferências</h4>
        {historicoConsentimento.length===0&&<p style={{fontSize:13}}>Nenhuma alteração registrada até agora.</p>}
        {historicoConsentimento.map(h=><div key={h.id} style={{fontSize:13,padding:'8px 0',borderBottom:'1px solid #eee6db'}}>
          <strong>{new Date(h.alterado_em).toLocaleString('pt-BR')}</strong> · {h.status_anterior||'Sem registro anterior'} → {h.status_novo}
          {h.observacao&&<div>{h.observacao}</div>}
        </div>)}
      </div>
      <div style={{marginTop:24,borderTop:'1px solid #e6dccb',paddingTop:16}}>
        <h3>Histórico de atendimento</h3>
        <p style={{fontSize:13,color:'#756454'}}>Após realizar o atendimento, registre-o manualmente. Abrir o WhatsApp não significa que a mensagem foi enviada.</p>
        <textarea aria-label="Observação do atendimento" style={{...css.input,width:'100%',minHeight:72}} maxLength={1000} value={observacao} onChange={e=>setObservacao(e.target.value)} placeholder="Observação interna (opcional)" />
        <button style={{...css.button,marginTop:8}} disabled={!selecionado||salvandoContato} onClick={registrarContato}>{salvandoContato?'Salvando…':'Registrar atendimento manual'}</button>
        {statusContato&&<p role="status">{statusContato}</p>}
        {contatos.map(c=><div key={c.id} style={{...css.card,marginTop:8}}>
          <strong>{new Date(c.criado_em).toLocaleString('pt-BR')}</strong>
          <div>Atendimento registrado manualmente</div>
          {c.observacao&&<p>{c.observacao}</p>}
        </div>)}
      </div>
    </section>}
    {aba==='clientes'&&<section style={css.card}>
      <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center',marginBottom:16}}>
        <input aria-label="Buscar clientes" placeholder="Buscar nome ou telefone" value={busca} onChange={e=>{setBusca(e.target.value);setPagina(1)}} style={{...css.input,flex:'1 1 200px'}}/>
        <select aria-label="Segmento" value={segmento} onChange={e=>{setSegmento(e.target.value);setPagina(1)}} style={css.input}>{SEG.map(x=><option key={x}>{x}</option>)}</select>
        <label style={{display:'flex',gap:6,alignItems:'center',fontSize:13}}><input type="checkbox" checked={somenteAcompanhamento} onChange={e=>{setSomenteAcompanhamento(e.target.checked);setPagina(1)}}/> Precisam de acompanhamento</label>
        <select aria-label="Ordenar clientes" value={ordem} onChange={e=>setOrdem(e.target.value)} style={css.input}>
          <option value="ultima">Última compra</option><option value="pedidos">Mais pedidos</option><option value="valor">Maior valor pago</option><option value="nome">Nome</option>
        </select>
        <button style={css.button} onClick={()=>downloadCsv([['Nome','Telefone','Pedidos válidos','Total pago','Última compra','Segmento'],...filtrados.map(c=>[c.nome,c.telefone,c.pedidos,c.total.toFixed(2),dataBR(c.ultima),c.segmento])])}>Exportar CSV</button>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:790}}>
          <thead><tr>{['Cliente','Última compra','Último atendimento','Pedidos','Total pago','Segmento','Marketing'].map(t=><th key={t} style={css.th}>{t}</th>)}</tr></thead>
          <tbody>{filtrados.slice((atual-1)*porPagina,atual*porPagina).map(c=><tr key={c.id}>
            <td style={css.td}><button onClick={()=>setSelecionado(c)} style={{background:'none',border:0,padding:0,textAlign:'left',cursor:'pointer',color:'#a9432a',fontWeight:700}}>{c.nome}</button><div style={{fontSize:12,color:'#756454'}}>{c.telefone}</div></td>
            <td style={css.td}>{dataBR(c.ultima)}</td><td style={css.td}>{dataBR(c.ultimoContato)}</td><td style={css.td}>{c.pedidos}</td><td style={css.td}>{fmt(c.total)}</td>
            <td style={css.td}>{c.segmento}{c.vip?' · VIP':''}</td><td style={css.td}>{statusPromocional(c.consentimentoPromocional)}</td>
          </tr>)}</tbody>
        </table>
        {!filtrados.length&&<p>Nenhum cliente encontrado.</p>}
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:12,flexWrap:'wrap'}}>
        <span style={{color:'#756454'}}>{filtrados.length} cliente(s) · página {atual} de {paginas}</span>
        <div style={{display:'flex',gap:8}}><button style={css.button} disabled={atual===1} onClick={()=>setPagina(atual-1)}>Anterior</button><button style={css.button} disabled={atual===paginas} onClick={()=>setPagina(atual+1)}>Próxima</button></div>
      </div>
    </section>}
    <p style={{fontSize:12,color:'#756454'}}>Marketing: “Autorizado” representa somente registro administrativo, não comprovação independente de opt-in. Nenhum envio automático está habilitado.</p>
    <p style={{fontSize:12,color:'#756454'}}>A acompanhar: compra válida há pelo menos 30 dias e sem atendimento registrado nos últimos 14 dias. Sugestão interna para revisão manual, não autorização para marketing.</p>
    <p style={{fontSize:12,color:'#756454'}}>Dados derivados dos até {limite.toLocaleString('pt-BR')} pedidos mais recentes. Segmentação e valores podem estar incompletos se houver mais pedidos no histórico. VIP: 10 compras válidas ou R$ 500 pagos (critério inicial, apenas para o CRM).</p>
    {selecionado&&aba==='clientes'&&<div role="presentation" onClick={()=>setSelecionado(null)} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(30,20,12,.55)',display:'flex',justifyContent:'flex-end'}}>
      <section role="dialog" aria-modal="true" aria-label={'Perfil de '+selecionado.nome} onClick={e=>e.stopPropagation()} style={{background:'#fffdf9',width:'min(650px,100%)',height:'100%',overflowY:'auto',padding:24}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'start'}}><div><h2 style={{margin:'0 0 4px'}}>{selecionado.nome}</h2><div>{selecionado.telefone}</div></div><button style={css.button} onClick={()=>setSelecionado(null)}>Fechar</button></div>
        <h3>Resumo do cliente</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
          {[['Compras válidas',selecionado.pedidos],['Total pago',fmt(selecionado.total)],['Ticket médio',fmt(selecionado.pedidos?selecionado.total/selecionado.pedidos:0)],['Última compra',dataBR(selecionado.ultima)],['Último atendimento',selecionado.ultimoContato?new Date(selecionado.ultimoContato).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Nenhum registro'],['Pontos disponíveis',selecionado.pontosDisponiveis===null?'Não vinculado':selecionado.pontosDisponiveis+' pts']].map(([k,v])=><div key={k} style={css.card}><small>{k}</small><div style={{fontSize:20,fontWeight:700}}>{v}</div></div>)}
        </div>
        <h3>Fidelidade</h3>
        <div style={css.card}>
          <strong>{selecionado.pontosDisponiveis===null?'Sem saldo vinculado':'Saldo disponível: '+selecionado.pontosDisponiveis+' pontos'}</strong>
          <p style={{fontSize:12,color:'#756454'}}>Saldo consultado diretamente do cadastro oficial de fidelidade. Resgates e movimentações continuam no módulo de fidelidade existente.</p>
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
        <p style={{fontSize:12,color:'#756454'}}>Esta tela mostra os pedidos consultados e o saldo oficial de fidelidade. Nenhum resgate ou mensagem é realizado por esta tela.</p>
      </section>
    </div>}
  </div>;
}
