'use client';

import { useState } from 'react';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import '../loja-v15.css';

export default function MeusPedidos() {
  const [codigo,setCodigo]=useState('');
  const [telefone,setTelefone]=useState('');
  const [erro,setErro]=useState('');
  const [carregando,setCarregando]=useState(false);

  async function consultar(e){
    e.preventDefault();setErro('');setCarregando(true);
    try{const r=await fetch('/api/pedidos/consultar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codigo,telefone})});const d=await r.json();if(!r.ok)throw new Error(d.erro||'Pedido não encontrado');window.location.href=`/pedido/${d.id}`;}catch(e){setErro(e.message);}finally{setCarregando(false);}
  }

  return <><main className="customer-page"><img className="customer-page-logo" src="/jeito%20de%20m%C3%A3e%20logo%20new.png" alt="Jeito de Mãe"/><h1>Meus pedidos</h1><p>Consulte um pedido usando o código recebido e o mesmo WhatsApp informado na compra.</p><form className="customer-card" onSubmit={consultar}><label>Código do pedido<input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} placeholder="Ex.: JDM-1234" required/></label><label>WhatsApp<input value={telefone} onChange={e=>setTelefone(e.target.value)} placeholder="(11) 99999-9999" inputMode="tel" required/></label>{erro&&<div className="customer-error">{erro}</div>}<button disabled={carregando}>{carregando?'Consultando...':'Acompanhar pedido'}</button></form></main><CustomerBottomNav/></>;
}
