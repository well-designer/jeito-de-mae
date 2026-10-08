'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {useEffect,useState} from 'react';
const icons={
 home:<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-8h6v8"/></>,
 menu:<><path d="M4 4h16M4 10h16M4 16h16M4 22h16"/><circle cx="7" cy="7" r="1" fill="currentColor"/></>,
 orders:<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 9h6m-6 4h6"/></>,
 profile:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>
};
export default function CustomerBottomNav(){
 const pathname=usePathname();
 const [hash,setHash]=useState('');
 useEffect(()=>{const sync=()=>setHash(window.location.hash);sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync)},[pathname]);
 const items=[{href:'/',label:'Início',icon:'home'},{href:'/#cardapio',label:'Cardápio',icon:'menu'},{href:'/meus-pedidos',label:'Pedidos',icon:'orders'},{href:'/conta',label:'Perfil',icon:'profile'}];
 return <nav className="customer-bottom-nav" aria-label="Navegação principal">{items.map(item=>{const active=item.href==='/'?pathname==='/'&&hash!=='#cardapio':item.href.includes('#')?pathname==='/'&&hash==='#cardapio':pathname.startsWith(item.href);return <Link key={item.href} href={item.href} className={active?'active':''} aria-current={active?'page':undefined}><svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[item.icon]}</svg><b>{item.label}</b></Link>})}</nav>
}