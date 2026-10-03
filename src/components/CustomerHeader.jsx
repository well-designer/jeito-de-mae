'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const VAZIO={nome:'',telefone:'',cep:'',endereco:'',numero:'',complemento:'',bairro:''};

export default function CustomerHeader(){
  const router=useRouter();
  const [cliente,setCliente]=useState(VAZIO);
  const [notificacoes,setNotificacoes]=useState(false);
  useEffect(()=>{const carregar=()=>{try{const d=JSON.parse(localStorage.getItem('jm_cliente')||'null');setCliente(d?{...VAZIO,...d}:VAZIO);}catch{setCliente(VAZIO);}};carregar();window.addEventListener('storage',carregar);window.addEventListener('jm-cliente-atualizado',carregar);return()=>{window.removeEventListener('storage',carregar);window.removeEventListener('jm-cliente-atualizado',carregar);};},[]);
  useEffect(()=>{const preencher=()=>{let d;try{d=JSON.parse(localStorage.getItem('jm_cliente')||'null');}catch{return;}if(!d)return;const mapa={Nome:d.nome,WhatsApp:d.telefone,CEP:d.cep,'Endereço':d.endereco,'Número':d.numero,'Complemento':d.complemento,'Bairro':d.bairro};document.querySelectorAll('.sheet input.inp').forEach(el=>{const valor=mapa[el.getAttribute('placeholder')];if(!valor||el.value)return;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;if(setter){setter.call(el,valor);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}});};const obs=new MutationObserver(()=>setTimeout(preencher,0));obs.observe(document.body,{childList:true,subtree:true});return()=>obs.disconnect();},[]);
  const saudacao=useMemo(()=>{const hora=Number(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(new Date()));return hora<12?'Bom dia':hora<18?'Boa tarde':'Boa noite';},[]);
  const primeiroNome=(cliente.nome||'').trim().split(/\s+/)[0];
  const endereco=cliente.endereco?`${cliente.endereco}${cliente.numero?`, ${cliente.numero}`:''}`:cliente.cep?`CEP ${cliente.cep}`:'Adicionar endereço de entrega';
  return <><header className="customer-app-header"><div className="customer-app-header-in"><img className="customer-app-logo" src="/jeito%20de%20m%C3%A3e%20logo%20branco.png" alt="Jeito de Mãe"/><button className="customer-bell" type="button" aria-label="Notificações" onClick={()=>setNotificacoes(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></button></div><div className="customer-welcome-row"><button className="customer-address" type="button" onClick={()=>router.push('/conta/endereco')}><span className="customer-greeting">{saudacao}{primeiroNome?`, ${primeiroNome}`:''}</span><span className="customer-address-line"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4"/></svg><b>{endereco}</b><span className="customer-chevron">›</span></span></button></div></header>{notificacoes&&<div className="customer-notice-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setNotificacoes(false)}><div className="customer-notice-sheet"><div><b>Notificações</b><button onClick={()=>setNotificacoes(false)}>×</button></div><span className="customer-notice-icon">🔔</span><h3>Tudo tranquilo por aqui</h3><p>Quando houver novidades sobre seus pedidos, cupons ou benefícios, elas poderão aparecer aqui.</p></div></div>}</>;
}
