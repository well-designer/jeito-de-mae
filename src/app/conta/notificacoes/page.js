'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {supabaseBrowser} from '@/lib/supabaseBrowser';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import PushCliente from './PushCliente';
import '../../loja-v15.css';

function bytes(base64){const s=atob((base64+'='.repeat((4-base64.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(s,c=>c.charCodeAt(0))}
export default function Notificacoes(){
 const [estado,setEstado]=useState('carregando'),[ocupado,setOcupado]=useState(false),[aviso,setAviso]=useState(''),[avancado,setAvancado]=useState(false);
 const suportado=typeof window!=='undefined'&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
 async function sessao(){const {data:{session}}=await supabaseBrowser().auth.getSession();if(!session)throw Error('Entre na sua conta para continuar.');return session}
 async function consultar(){try{const s=await sessao();const r=await fetch('/api/conta/marketing',{headers:{Authorization:'Bearer '+s.access_token},cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.erro||'Não foi possível consultar.');setEstado(d.status)}catch(e){setEstado('erro');setAviso(e.message)}}
 useEffect(()=>{consultar()},[]);
 async function aceitar(){
  if(ocupado)return;setOcupado(true);setAviso('');
  try{
   if(!suportado)throw Error('Este navegador não suporta notificações. No iPhone, abra o aplicativo adicionado à Tela de Início.');
   const s=await sessao();
   const k=await fetch('/api/conta/push/chave-publica',{cache:'no-store'});if(!k.ok)throw Error('Notificações indisponíveis no momento.');
   const {publicKey}=await k.json();if(!publicKey)throw Error('Notificações ainda não configuradas.');
   const perm=await Notification.requestPermission();if(perm!=='granted')throw Error('Permissão não concedida. Você pode ativar as notificações nos ajustes do aparelho.');
   const reg=await navigator.serviceWorker.register('/sw.js');
   const anterior=await reg.pushManager.getSubscription();
   const sub=anterior||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(publicKey)});
   const cadastro=await fetch('/api/conta/push',{method:'POST',headers:{Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON()})});
   const cd=await cadastro.json();if(!cadastro.ok)throw Error(cd.erro||'Não foi possível configurar este aparelho.');
   const r=await fetch('/api/conta/marketing',{method:'POST',headers:{Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify({acao:'autorizar_push',confirmacao:true})});
   const d=await r.json();if(!r.ok)throw Error(d.erro||'Não foi possível registrar sua escolha.');
   setEstado('autorizado');setAviso('Pronto! Você poderá receber novidades e ofertas neste aparelho.');
  }catch(e){setAviso(e.message||'Não foi possível ativar.')}finally{setOcupado(false)}
 }
 async function cancelar(){
  if(ocupado)return;setOcupado(true);setAviso('');
  try{const s=await sessao();const r=await fetch('/api/conta/marketing',{method:'POST',headers:{Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify({acao:'revogar'})});const d=await r.json();if(!r.ok)throw Error(d.erro||'Não foi possível cancelar.');setEstado('revogado');setAviso('Ofertas desativadas. Avisos importantes sobre seus pedidos continuam disponíveis.')}
  catch(e){setAviso(e.message)}finally{setOcupado(false)}
 }
 return <><main className="customer-subpage settings-page">
  <header className="customer-subhead"><Link href="/conta">‹</Link><div><h1>Notificações</h1><p>Você escolhe o que deseja receber.</p></div></header>
  <section className="settings-card" style={{padding:18}}>
   <h2 style={{fontSize:19,margin:'0 0 8px'}}>Novidades e ofertas deliciosas</h2>
   <p>Quer receber novidades do cardápio, promoções e ofertas especiais do Jeito de Mãe no seu celular? É gratuito e você pode cancelar quando quiser.</p>
   <p style={{fontSize:14}}>Sua escolha: <strong>{estado==='carregando'?'Consultando…':estado==='autorizado'?'Quero receber':estado==='revogado'?'Não receber':estado==='erro'?'Indisponível':'Ainda não escolhi'}</strong></p>
   {estado==='autorizado'?<button type="button" disabled={ocupado} onClick={cancelar} style={{padding:12,borderRadius:9}}>{ocupado?'Aguarde…':'Não quero receber ofertas'}</button>:<button type="button" disabled={ocupado||estado==='carregando'||!suportado} onClick={aceitar} style={{padding:12,borderRadius:9}}>{ocupado?'Configurando…':'Quero receber'}</button>}
   {!suportado&&<p style={{fontSize:13}}>Para ativar no iPhone, abra o aplicativo instalado pela Tela de Início.</p>}
   {aviso&&<p role="status" style={{fontSize:14,marginTop:10}}>{aviso}</p>}
  </section>
  <p className="settings-note">Sua autorização é usada somente para novidades e ofertas por notificações do aplicativo. A permissão do aparelho é solicitada ao ativar. Avisos sobre pedidos são independentes dessa escolha.</p>
  <div style={{marginTop:18}}><button type="button" onClick={()=>setAvancado(v=>!v)} aria-expanded={avancado} style={{fontSize:13,padding:10}}>{avancado?'Ocultar detalhes técnicos':'Ajuda com notificações'}</button>{avancado&&<PushCliente/>}</div>
 </main><CustomerBottomNav/></>;
}
