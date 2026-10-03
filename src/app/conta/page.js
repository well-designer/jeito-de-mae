'use client';

import { useEffect, useState } from 'react';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import '../loja-v15.css';

const VAZIO={nome:'',telefone:'',cep:'',endereco:'',numero:'',complemento:'',bairro:''};
export default function Conta(){
 const [form,setForm]=useState(VAZIO);const [salvo,setSalvo]=useState(false);
 useEffect(()=>{try{const d=JSON.parse(localStorage.getItem('jm_cliente')||'null');if(d)setForm({...VAZIO,...d});}catch{}},[]);
 function salvar(e){e.preventDefault();localStorage.setItem('jm_cliente',JSON.stringify(form));setSalvo(true);setTimeout(()=>setSalvo(false),2200);}
 return <><main className="customer-page"><img className="customer-page-logo" src="/jeito%20de%20m%C3%A3e%20logo%20new.png" alt="Jeito de Mãe"/><h1>Sua conta</h1><p>Salve seus dados neste aparelho para facilitar seus próximos pedidos.</p><form className="customer-card" onSubmit={salvar}>{[['nome','Nome'],['telefone','WhatsApp'],['cep','CEP'],['endereco','Endereço'],['numero','Número'],['complemento','Complemento'],['bairro','Bairro']].map(([k,l])=><label key={k}>{l}<input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} inputMode={k==='telefone'?'tel':k==='cep'?'numeric':undefined}/></label>)}<button>Salvar meus dados</button>{salvo&&<div className="customer-success">Dados salvos neste aparelho ✓</div>}</form></main><CustomerBottomNav/></>;
}
