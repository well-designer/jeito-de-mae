'use client';
import {useState} from 'react';
import {supabaseBrowser} from '@/lib/supabaseBrowser';
const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||'';
function bytes(base64){const s=atob((base64+'='.repeat((4-base64.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(s,c=>c.charCodeAt(0))}
export default function PushCliente(){
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const suportado=typeof window!=='undefined'&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
 async function sessao(){const {data:{session}}=await supabaseBrowser().auth.getSession();if(!session)throw Error('Entre na sua conta antes de continuar.');return session}
 async function ativar(){
  setBusy(true);setStatus('');
  try{
   if(!suportado)throw Error('Este navegador não oferece notificações push.');
   if(!publicKey)throw Error('A chave pública de notificações ainda não foi configurada.');
   await sessao();
   const permissao=await Notification.requestPermission();
   if(permissao!=='granted')throw Error('Permissão não concedida no aparelho.');
   const reg=await navigator.serviceWorker.register('/sw.js');
   const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(publicKey)});
   const session=await sessao();
   const r=await fetch('/api/conta/push',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON()})});
   const d=await r.json();if(!r.ok)throw Error(d.erro||'Falha ao cadastrar aparelho.');
   setStatus('Aparelho cadastrado. O envio de campanhas push ainda está desativado.');
  }catch(e){setStatus(e.message||'Não foi possível cadastrar.')}finally{setBusy(false)}
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
 <button type="button" disabled={busy||!suportado||!publicKey} onClick={ativar} style={{padding:10}}>{busy?'Aguarde…':'Cadastrar aparelho'}</button>
 <button type="button" disabled={busy||!suportado} onClick={desativar} style={{padding:10}}>Remover este aparelho</button>
 </div>
 {!publicKey&&<p style={{fontSize:13}}>Aguardando configuração da chave pública VAPID.</p>}
 {status&&<p role="status">{status}</p>}
 </section>;
}
