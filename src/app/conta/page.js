'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import '../loja-v15.css';

const Icon=({type})=>{const p={user:'M20 21a8 8 0 0 0-16 0m12-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',pin:'M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',bag:'M6 8h12l1 13H5L6 8Zm3 0V6a3 3 0 0 1 6 0v2',gift:'M4 10h16v11H4V10Zm8 0v11M3 6h18v4H3V6Zm9 0c-4 0-5-5-2-5 2 0 2 3 2 5Zm0 0c4 0 5-5 2-5-2 0-2 3-2 5Z',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4',lock:'M6 10h12v11H6V10Zm3 0V7a3 3 0 0 1 6 0v3'};return <svg viewBox="0 0 24 24"><path d={p[type]}/></svg>};

export default function Conta(){
 const [nome,setNome]=useState('');const [email,setEmail]=useState('');const [saldo,setSaldo]=useState(0);const [logado,setLogado]=useState(false);
 useEffect(()=>{(async()=>{try{const {data}=await supabaseBrowser().auth.getSession();const s=data.session;if(!s)return;setLogado(true);setEmail(s.user.email||'');const local=JSON.parse(localStorage.getItem('jm_cliente')||'null');setNome(local?.nome||s.user.user_metadata?.nome||'');const r=await fetch('/api/fidelidade/conta',{headers:{Authorization:'Bearer '+s.access_token}});if(r.ok){const d=await r.json();setSaldo(d.cliente?.saldo||0);if(d.cliente?.nome)setNome(d.cliente.nome)}}catch{}})()},[]);
 return <><main className="account-page app-profile-page">
   <section className="account-profile">
     <div className="account-avatar"><Icon type="user"/></div>
     <div><h1>{nome||'Jeito de Mãe'}</h1><p>{logado?(email||'Sua conta Jeito de Mãe'):'Entre para acompanhar seus pedidos'}</p></div>
     <Link href={logado?'/conta/dados':'/login?next=/conta'}>›</Link>
   </section>

   <Link href="/fidelidade" className="profile-points-card"><div><small>MEUS PONTOS</small><strong>{saldo} pontos</strong></div><span>Ver recompensas ›</span></Link>

   <section className="account-menu profile-menu">
     <Link href="/meus-pedidos"><span><Icon type="bag"/></span><div><b>Meus pedidos</b><small>Acompanhe seus pedidos</small></div><i>›</i></Link>
     <Link href="/fidelidade"><span><Icon type="gift"/></span><div><b>Recompensas e Benefícios</b><small>Pontos, produtos e novidades</small></div><i>›</i></Link>
     <Link href="/conta/endereco"><span><Icon type="pin"/></span><div><b>Endereços</b><small>Seus endereços de entrega</small></div><i>›</i></Link>
     <Link href="/conta/codigo-entrega"><span><Icon type="lock"/></span><div><b>Código de entrega</b><small>Segurança na confirmação do pedido</small></div><i>›</i></Link>
     <Link href="/conta/dados"><span><Icon type="user"/></span><div><b>Dados da conta</b><small>Nome, telefone e e-mail</small></div><i>›</i></Link>
     <Link href="/conta/notificacoes"><span><Icon type="bell"/></span><div><b>Notificações</b><small>Promoções, novidades e status</small></div><i>›</i></Link>
   </section>
   {!logado&&<Link className="btn profile-login-btn" href="/login?next=/conta">Entrar ou criar conta</Link>}
 </main><CustomerBottomNav/></>;
}
