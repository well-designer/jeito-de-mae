'use client';

import { useEffect,useState } from 'react';
import Link from 'next/link';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import '../loja-v15.css';
import './pedidos.css';

export default function MeusPedidos() {
  const [codigo,setCodigo]=useState('');
  const [telefone,setTelefone]=useState('');
  const [erro,setErro]=useState('');
  const [carregando,setCarregando]=useState(false);
  const [ultimo,setUltimo]=useState(null);

  useEffect(()=>{try{const c=JSON.parse(localStorage.getItem('jm_cliente')||'null');if(c?.telefone)setTelefone(c.telefone);const u=JSON.parse(localStorage.getItem('jm_ultimo_pedido')||'null');if(u?.id)setUltimo(u);}catch{}},[]);

  async function consultar(e){
    e.preventDefault();setErro('');setCarregando(true);
    try{const r=await fetch('/api/pedidos/consultar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codigo,telefone})});const d=await r.json();if(!r.ok)throw new Error(d.erro||'Pedido não encontrado');window.location.href=`/pedido/${d.id}`;}catch(e){setErro(e.message);}finally{setCarregando(false);}
  }

  return <><main className="orders-page"><header className="orders-head"><div><h1>Meus pedidos</h1><p>Acompanhe seu pedido ou consulte uma compra anterior.</p></div></header>{ultimo?.id&&<section className="last-order-card"><div className="last-order-icon">✓</div><div><small>Pedido mais recente</small><b>{ultimo.codigo||'Pedido confirmado'}</b><span>Veja o andamento em tempo real</span></div><Link href={`/pedido/${ultimo.id}`}>Acompanhar</Link></section>}<section className="orders-lookup"><div className="orders-lookup-title"><b>Encontrar outro pedido</b><small>Use o código do pedido e o WhatsApp informado na compra.</small></div><form onSubmit={consultar}><label>Código do pedido<input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} placeholder="Ex.: JDM-1234" required/></label><label>WhatsApp<input value={telefone} onChange={e=>setTelefone(e.target.value)} placeholder="(11) 99999-9999" inputMode="tel" required/></label>{erro&&<div className="customer-error">{erro}</div>}<button disabled={carregando}>{carregando?'Consultando...':'Acompanhar pedido'}</button></form></section><section className="orders-help"><b>Onde encontro o código?</b><p>Ele aparece na confirmação da compra e na tela de acompanhamento do pedido.</p></section></main><CustomerBottomNav/></>;
}
