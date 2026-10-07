'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import '../../loja-v15.css';

export default function CodigoEntrega(){
 const [telefone,setTelefone]=useState('');
 useEffect(()=>{try{const c=JSON.parse(localStorage.getItem('jm_cliente')||'null');setTelefone(String(c?.telefone||'').replace(/\D/g,''));}catch{}},[]);
 const final=telefone.slice(-4);
 return <><main className="delivery-code-page">
   <header className="delivery-code-head"><Link href="/conta">‹</Link><h1>Código de entrega</h1><span/></header>
   <section className="delivery-code-illustration">
     <div className="delivery-woman" aria-hidden="true"><span>JM</span><b>♡</b></div>
   </section>
   <section className="delivery-code-content">
     <h2>Seu código de entrega</h2>
     <div className="delivery-code-card">
       <strong>{final||'••••'}</strong>
       <button type="button" disabled>Alterar código</button>
     </div>
     <div className="delivery-code-off"><b>Recurso preparado, mas desativado</b><p>Por enquanto seus pedidos não exigem código na entrega. Quando ativarmos, você poderá escolher e alterar seu código aqui.</p></div>
     <ul className="delivery-code-rules">
       <li>O código poderá ser solicitado por quem fizer a entrega.</li>
       <li>Informe somente quando estiver com o seu pedido.</li>
       <li>Não compartilhe o código por mensagem.</li>
       <li>Quando o recurso for ativado, você poderá alterar o código sem pedido em andamento.</li>
     </ul>
   </section>
 </main><CustomerBottomNav/></>;
}
