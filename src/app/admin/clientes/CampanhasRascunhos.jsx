'use client';
import {useEffect,useState} from 'react';
const seg=['Todos','Novo','Recorrente ativo','Inativo','Recorrente inativo','VIP'];
const estilo={padding:'10px 12px',border:'1px solid #d9cdbb',borderRadius:8,background:'#fff',width:'100%',boxSizing:'border-box'};
export default function CampanhasRascunhos(){
 const [enviandoTeste,setEnviandoTeste]=useState(false);
 const [enviandoCampanha,setEnviandoCampanha]=useState(null);
 const [previa,setPrevia]=useState(null),[carregandoPrevia,setCarregandoPrevia]=useState(false);
 const [diagnostico,setDiagnostico]=useState(null),[lista,setLista]=useState([]),[titulo,setTitulo]=useState(''),[mensagem,setMensagem]=useState(''),[segmento,setSegmento]=useState('Todos'),[aviso,setAviso]=useState(''),[salvando,setSalvando]=useState(false);
 useEffect(()=>{fetch('/api/admin/crm/push/diagnostico',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>setDiagnostico(d)).catch(()=>{});let ativo=true;(async()=>{try{const r=await fetch('/api/admin/crm/campanhas',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.erro);if(ativo)setLista(d.campanhas||[])}catch(e){if(ativo)setAviso(e.message||'Rascunhos indisponíveis')}})();return()=>{ativo=false}},[]);
 async function consultarPrevia(){setCarregandoPrevia(true);setPrevia(null);try{const r=await fetch('/api/admin/crm/push/previa?segmento='+encodeURIComponent(segmento),{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.erro||'Prévia indisponível');setPrevia({...d,consultada_em:Date.now(),titulo_revisado:titulo.trim(),mensagem_revisada:mensagem.trim()})}catch(e){setAviso(e.message)}finally{setCarregandoPrevia(false)}}
 async function enviarTeste(){
  if(!previa||Date.now()-previa.consultada_em>120000||previa.titulo_revisado!==titulo.trim()||previa.mensagem_revisada!==mensagem.trim()||previa.clientes_aptos!==1||previa.aparelhos_com_opt_in!==1||segmento!=='Todos'){setAviso('Atualize a prévia (válida por 2 minutos) e confirme exatamente 1 cliente e 1 aparelho autorizado.');return}
  if(titulo.trim().length<3||mensagem.trim().length<3){setAviso('Preencha título e mensagem antes do teste.');return}
  if(!window.confirm('Enviar esta mensagem de teste para o único aparelho autorizado? Não é uma campanha em massa.'))return;
  setEnviandoTeste(true);setAviso('');
  try{
   const r=await fetch('/api/admin/crm/push/teste-campanha',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({titulo,mensagem,confirmacao:'TESTE INDIVIDUAL'})});
   const d=await r.json();if(!r.ok)throw Error(d.erro||'Falha no teste');
   setAviso('Teste enviado ao serviço. Confirme o recebimento no iPhone. Nenhuma campanha em massa foi disparada.');
  }catch(e){setAviso(e.message)}finally{setEnviandoTeste(false)}
 }
 async function disparar(campanha){
  if(enviandoCampanha)return;
  if(campanha.segmento!=='Todos'||campanha.status!=='rascunho')return;
  if(!window.confirm('Enviar esta campanha UMA VEZ aos clientes que autorizaram ofertas? Não será possível reenviar.'))return;
  setEnviandoCampanha(campanha.id);setAviso('');
  try{
   const r=await fetch('/api/admin/crm/push/campanha',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:campanha.id,confirmacao:'ENVIAR CAMPANHA'})});
   const d=await r.json();if(!r.ok)throw Error(d.erro||'Falha no envio');
   setLista(a=>a.map(c=>c.id===campanha.id?{...c,status:'arquivada'}:c));
   setAviso('Campanha finalizada: '+d.aceitos+' aceitos pelo serviço, '+d.falhas+' falhas, '+d.revogados+' desautorizados. Sem reenvio automático.');
  }catch(e){setAviso(e.message||'Não foi possível concluir. Atualize a página antes de tentar novamente.')}
  finally{setEnviandoCampanha(null)}
 }
 async function salvar(e){e.preventDefault();if(salvando)return;setSalvando(true);setAviso('');try{
 const r=await fetch('/api/admin/crm/campanhas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({titulo,mensagem,segmento})});
 const d=await r.json();if(!r.ok)throw Error(d.erro||'Erro ao salvar');setLista(a=>[d.campanha,...a]);setTitulo('');setMensagem('');setAviso('Rascunho salvo. Nenhuma mensagem enviada.');
 }catch(e){setAviso(e.message)}finally{setSalvando(false)}}
 async function alterar(id,status){
 setAviso('');
 try{
  const r=await fetch('/api/admin/crm/campanhas',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});
  const d=await r.json();if(!r.ok)throw Error(d.erro||'Falha ao atualizar');
  setLista(a=>a.map(c=>c.id===id?d.campanha:c));
  setAviso(status==='publicada'?'Publicado na página inicial, sem envio de notificações.':'Situação atualizada.');
 }catch(e){setAviso(e.message)}
 }
 return <section style={{marginTop:20,padding:16,background:'#fffdf9',border:'1px solid #e6dccb',borderRadius:10}}>
 <h3 style={{marginTop:0}}>Planejamento de campanhas</h3>{diagnostico&&<p role="status" style={{fontSize:13}}>Push: {diagnostico.aparelhos_cadastrados} aparelhos cadastrados · {diagnostico.consentimentos_autorizados} autorizações registradas · chaves VAPID {diagnostico.vapid_publica&&diagnostico.vapid_privada?'configuradas':'pendentes'} · envios com confirmação e limite de 25 aparelhos.</p>}<p>Salve mensagens para revisar depois. Campanhas do público Todos podem ser exibidas no app ou enviadas uma única vez por notificação push aos clientes autorizados. O envio tem limite inicial de 25 aparelhos. WhatsApp e e-mail não são disparados.</p>
 <form onSubmit={salvar} style={{display:'grid',gap:10}}>
 <label>Título<input style={estilo} required minLength={3} maxLength={120} value={titulo} onChange={e=>{setTitulo(e.target.value);setPrevia(null);setRevisao(false)}}/></label>
 <label>Público<select style={estilo} value={segmento} onChange={e=>{setSegmento(e.target.value);setPrevia(null);setRevisao(false)}}>{seg.map(x=><option key={x}>{x}</option>)}</select></label>
 <div><button type="button" onClick={consultarPrevia} disabled={carregandoPrevia}>{carregandoPrevia?'Consultando…':'Ver prévia de destinatários'}</button>{previa&&<p role="status">{previa.clientes_aptos} clientes aptos · {previa.aparelhos_com_opt_in} aparelhos autorizados. Nenhuma notificação será enviada.</p>}</div>
 <label>Mensagem<textarea style={estilo} rows={4} required maxLength={2000} value={mensagem} onChange={e=>{setMensagem(e.target.value);setPrevia(null);setRevisao(false)}}/></label>
 {previa?.clientes_aptos===1&&previa?.aparelhos_com_opt_in===1&&segmento==='Todos'&&<button type="button" disabled={enviandoTeste||salvando} onClick={enviarTeste} style={{padding:12,border:'1px solid #d9cdbb',borderRadius:8}}>{enviandoTeste?'Enviando teste…':'Enviar teste individual (1 aparelho)'}</button>}
 <button type="submit" disabled={salvando} style={{...estilo,width:'auto',cursor:'pointer'}}>{salvando?'Salvando…':'Salvar rascunho'}</button>
 </form>{aviso&&<p role="status">{aviso}</p>}
 <h4>Rascunhos salvos ({lista.length})</h4>{lista.length===0?<p>Nenhum rascunho salvo.</p>:<div style={{display:'grid',gap:10}}>{lista.map(c=><article key={c.id} style={{borderTop:'1px solid #eee6db',paddingTop:8}}><strong>{c.titulo}</strong> · {c.segmento}<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{c.mensagem}</p><small>{c.status} · {new Date(c.criado_em).toLocaleDateString('pt-BR')}</small><div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>{c.segmento==='Todos'&&c.status==='rascunho'&&<button type="button" disabled={!!enviandoCampanha} onClick={()=>disparar(c)} style={{background:'#205d3c',color:'white',padding:'9px 12px',borderRadius:8,border:0,cursor:'pointer'}}>{enviandoCampanha===c.id?'Enviando…':'Enviar push aos autorizados'}</button>}{c.segmento==='Todos'&&c.status!=='publicada'&&c.status!=='arquivada'&&<button type="button" onClick={()=>alterar(c.id,'publicada')}>Publicar no app</button>}{c.status!=='arquivada'&&<button type="button" onClick={()=>alterar(c.id,'arquivada')}>Arquivar</button>}{c.status==='publicada'&&<button type="button" onClick={()=>alterar(c.id,'rascunho')}>Retirar do app</button>}</div></article>)}</div>}
 </section>;
}
