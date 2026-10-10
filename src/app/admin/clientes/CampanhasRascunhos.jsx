'use client';
import {useEffect,useState} from 'react';
const seg=['Todos','Novo','Recorrente ativo','Inativo','Recorrente inativo','VIP'];
const estilo={padding:'10px 12px',border:'1px solid #d9cdbb',borderRadius:8,background:'#fff',width:'100%',boxSizing:'border-box'};
export default function CampanhasRascunhos(){
 const [lista,setLista]=useState([]),[titulo,setTitulo]=useState(''),[mensagem,setMensagem]=useState(''),[segmento,setSegmento]=useState('Todos'),[aviso,setAviso]=useState(''),[salvando,setSalvando]=useState(false);
 useEffect(()=>{let ativo=true;(async()=>{try{const r=await fetch('/api/admin/crm/campanhas',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.erro);if(ativo)setLista(d.campanhas||[])}catch(e){if(ativo)setAviso(e.message||'Rascunhos indisponíveis')}})();return()=>{ativo=false}},[]);
 async function salvar(e){e.preventDefault();if(salvando)return;setSalvando(true);setAviso('');try{
 const r=await fetch('/api/admin/crm/campanhas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({titulo,mensagem,segmento})});
 const d=await r.json();if(!r.ok)throw Error(d.erro||'Erro ao salvar');setLista(a=>[d.campanha,...a]);setTitulo('');setMensagem('');setAviso('Rascunho salvo. Nenhuma mensagem enviada.');
 }catch(e){setAviso(e.message)}finally{setSalvando(false)}}
 return <section style={{marginTop:20,padding:16,background:'#fffdf9',border:'1px solid #e6dccb',borderRadius:10}}>
 <h3 style={{marginTop:0}}>Planejamento de campanhas</h3><p>Salve mensagens para revisar depois. Sem agendamento, disparo ou exportação de destinatários.</p>
 <form onSubmit={salvar} style={{display:'grid',gap:10}}>
 <label>Título<input style={estilo} required minLength={3} maxLength={120} value={titulo} onChange={e=>setTitulo(e.target.value)}/></label>
 <label>Público<select style={estilo} value={segmento} onChange={e=>setSegmento(e.target.value)}>{seg.map(x=><option key={x}>{x}</option>)}</select></label>
 <label>Mensagem<textarea style={estilo} rows={4} required maxLength={2000} value={mensagem} onChange={e=>setMensagem(e.target.value)}/></label>
 <button type="submit" disabled={salvando} style={{...estilo,width:'auto',cursor:'pointer'}}>{salvando?'Salvando…':'Salvar rascunho'}</button>
 </form>{aviso&&<p role="status">{aviso}</p>}
 <h4>Rascunhos salvos ({lista.length})</h4>{lista.length===0?<p>Nenhum rascunho salvo.</p>:<div style={{display:'grid',gap:10}}>{lista.map(c=><article key={c.id} style={{borderTop:'1px solid #eee6db',paddingTop:8}}><strong>{c.titulo}</strong> · {c.segmento}<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{c.mensagem}</p><small>Rascunho · {new Date(c.criado_em).toLocaleDateString('pt-BR')}</small></article>)}</div>}
 </section>;
}
