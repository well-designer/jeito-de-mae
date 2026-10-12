'use client';
import {useState} from 'react';
import {supabaseBrowser} from '@/lib/supabaseBrowser';

function bytes(base64){const s=atob((base64+'='.repeat((4-base64.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(s,c=>c.charCodeAt(0))}
export default function PushCliente(){
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[inscricoes,setInscricoes]=useState(null),[endpointAtual,setEndpointAtual]=useState('');
 const suportado=typeof window!=='undefined'&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
 async function sessao(){const {data:{session}}=await supabaseBrowser().auth.getSession();if(!session)throw Error('Entre na sua conta antes de continuar.');return session}
 async function listar(){
  setBusy(true);setStatus('');
  try{
   const session=await sessao();
   const reg=typeof navigator!=='undefined'&&'serviceWorker'in navigator?await navigator.serviceWorker.getRegistration('/sw.js'):null;
   const sub=reg?.pushManager?await reg.pushManager.getSubscription():null;
   const endpoint=sub?.endpoint||'';
   const r=await fetch('/api/conta/push?endpoint='+encodeURIComponent(endpoint),{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
   const d=await r.json();if(!r.ok)throw Error(d.erro||'Falha ao consultar inscrições.');
   setEndpointAtual(endpoint);setInscricoes(d.inscricoes||[]);
   if(!endpoint)setStatus('Este navegador não tem uma inscrição push ativa. Abra o aplicativo instalado na tela inicial do iPhone para identificar a inscrição correta. Nenhum cadastro foi removido.');
   else if(!(d.inscricoes||[]).some(x=>x.atual))setStatus('A inscrição ativa neste navegador não corresponde aos cadastros salvos. Não remova nenhuma inscrição antes de cadastrar e testar este aplicativo.');
  }catch(e){setStatus(e.message||'Consulta indisponível.')}finally{setBusy(false)}
 }
 async function removerAntigo(id){
  if(!endpointAtual||busy)return;
  if(!window.confirm('Remover esta inscrição antiga? A inscrição atual do seu aparelho será preservada.'))return;
  setBusy(true);setStatus('');
  try{
   const session=await sessao();
   const reg=await navigator.serviceWorker.getRegistration('/sw.js');
   const sub=await reg?.pushManager.getSubscription();
   if(sub?.endpoint!==endpointAtual)throw Error('A inscrição atual mudou. Consulte os aparelhos novamente.');
   const r=await fetch('/api/conta/push',{method:'PATCH',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({id,endpoint_atual:endpointAtual})});
   const d=await r.json();if(!r.ok)throw Error(d.erro||'Não foi possível remover.');
   setInscricoes(a=>a.filter(x=>x.id!==id));setStatus('Inscrição antiga removida. O aparelho atual foi preservado.');
  }catch(e){setStatus(e.message)}finally{setBusy(false)}
 }
 async function ativar(){
  setBusy(true);setStatus('');
  try{
   if(!suportado)throw Error('Este navegador não oferece notificações push.');
   const chaveResposta=await fetch('/api/conta/push/chave-publica',{cache:'no-store'});
   if(!chaveResposta.ok)throw Error('A chave pública de notificações está indisponível.');
   const {publicKey}=await chaveResposta.json();
   if(!publicKey)throw Error('A chave pública de notificações ainda não foi configurada.');
   await sessao();
   const permissao=await Notification.requestPermission();
   if(permissao!=='granted')throw Error('Permissão não concedida no aparelho.');
   const reg=await navigator.serviceWorker.register('/sw.js');
   const existente=await reg.pushManager.getSubscription();
   const sub=existente||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(publicKey)});
   const session=await sessao();
   const r=await fetch('/api/conta/push',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON()})});
   const d=await r.json();if(!r.ok){if(!existente)await sub.unsubscribe().catch(()=>{});throw Error(d.erro||'Falha ao cadastrar aparelho.')}
   setStatus('Aparelho cadastrado. O envio de campanhas push ainda está desativado.');
  }catch(e){setStatus(e.message||'Não foi possível cadastrar.')}finally{setBusy(false)}
 }
 async function testar(){
  setBusy(true);setStatus('');
  try{
   const session=await sessao();
   const reg=await navigator.serviceWorker.getRegistration('/sw.js');
   const sub=await reg?.pushManager.getSubscription();
   if(!sub)throw Error('Cadastre este aparelho antes de enviar o teste.');
   const r=await fetch('/api/conta/push/teste',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});
   const d=await r.json();
   if(!r.ok)throw Error(d.erro||'Não foi possível enviar o teste.');
   setStatus('Teste enviado ao serviço de notificações. Verifique se o aviso apareceu no celular.');
  }catch(e){setStatus(e.message||'Não foi possível testar.')}finally{setBusy(false)}
 }
 async function desativar(){
  setBusy(true);setStatus('');
  try{
   const session=await sessao();
   const reg=await navigator.serviceWorker.getRegistration('/sw.js');
   const sub=await reg?.pushManager.getSubscription();
   if(!sub){setStatus('Nenhuma inscrição ativa neste aparelho.');return}
   const r=await fetch('/api/conta/push',{method:'DELETE',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});
   if(!r.ok){const d=await r.json();throw Error(d.erro||'Falha ao remover inscrição.')}
   await sub.unsubscribe();
   setStatus('Inscrição deste aparelho removida.');
  }catch(e){setStatus(e.message||'Não foi possível remover.')}finally{setBusy(false)}
 }
 return <section className="settings-card" style={{padding:16,marginTop:16}}>
 <h2 style={{fontSize:18,margin:'0 0 8px'}}>Notificações no celular</h2>
 <p style={{fontSize:14}}>Cadastre este aparelho para preparar as notificações do aplicativo. Isso não autoriza ofertas e nenhum disparo promocional está ativo.</p>
 <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
 <button type="button" disabled={busy||!suportado} onClick={ativar} style={{padding:10}}>{busy?'Aguarde…':'Cadastrar aparelho'}</button>
 <button type="button" disabled={busy||!suportado} onClick={testar} style={{padding:10}}>Enviar notificação de teste</button>
 <button type="button" disabled={busy||!suportado} onClick={desativar} style={{padding:10}}>Remover este aparelho</button>
 </div>
 <div style={{marginTop:12}}><button type="button" disabled={busy} onClick={listar}>Ver aparelhos cadastrados</button>{inscricoes&&<div style={{marginTop:10}}><strong>{inscricoes.length} inscrição(ões) nesta conta</strong>{!endpointAtual&&<p>Não foi possível identificar este aplicativo: nenhuma inscrição push ativa foi encontrada neste navegador. As inscrições abaixo não foram verificadas.</p>}{inscricoes.map((item,i)=><div key={item.id} style={{padding:'10px 0',borderBottom:'1px solid #e5ded4'}}><span>Inscrição {i+1} · {new Date(item.criado_em).toLocaleDateString('pt-BR')} · {item.atual?'Este aplicativo (confirmado)':endpointAtual?'Inscrição diferente da atual':'Não identificada neste navegador'}</span>{!item.atual&&endpointAtual&&inscricoes.some(x=>x.atual)&&<button type="button" disabled={busy} onClick={()=>removerAntigo(item.id)} style={{marginLeft:8}}>Remover inscrição antiga</button>}</div>)}</div>}</div>
 <p style={{fontSize:13}}>No iPhone, abra o site pelo Safari, escolha Compartilhar → Adicionar à Tela de Início e abra o aplicativo pelo ícone criado. Depois permita notificações quando solicitado.</p>
 {status&&<p role="status">{status}</p>}
 </section>;
}
