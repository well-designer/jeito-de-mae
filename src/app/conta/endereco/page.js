'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import '../../loja-v15.css';

const V={nome:'',telefone:'',cep:'',endereco:'',numero:'',complemento:'',bairro:'',cidade:'',uf:''};

export default function Endereco(){
  const [f,setF]=useState(V),[buscando,setBuscando]=useState(false),[erro,setErro]=useState(''),[ok,setOk]=useState(false);
  useEffect(()=>{try{const d=JSON.parse(localStorage.getItem('jm_cliente')||'null');if(d)setF({...V,...d})}catch{}},[]);

  async function consultarCep(valor){
    const limpo=String(valor||'').replace(/\D/g,'').slice(0,8);
    setF(x=>({...x,cep:limpo}));setErro('');setOk(false);
    if(limpo.length!==8)return;
    setBuscando(true);
    try{
      const r=await fetch(`/api/cep/${limpo}`,{cache:'no-store'});
      const d=await r.json();
      if(!r.ok)throw new Error(d.erro||'Não foi possível consultar o CEP agora.');
      setF(x=>({...x,cep:limpo,endereco:d.endereco||'',bairro:d.bairro||'',cidade:d.cidade||'',uf:d.uf||''}));
    }catch(e){setErro(e.message||'Não foi possível consultar o CEP agora.')}finally{setBuscando(false)}
  }

  function salvar(e){
    e.preventDefault();setErro('');
    if(f.cep.replace(/\D/g,'').length!==8||!f.endereco||!f.numero){setErro('Informe um CEP válido e o número da residência.');return}
    localStorage.setItem('jm_cliente',JSON.stringify(f));window.dispatchEvent(new Event('jm-cliente-atualizado'));setOk(true);setTimeout(()=>setOk(false),1800);
  }

  const resumo=f.endereco?`${f.endereco}${f.numero?`, ${f.numero}`:''}`:'Seu endereço aparecerá aqui';
  return <><main className="customer-subpage">
    <div className="customer-subhead"><Link href="/conta">‹</Link><h1>Endereço de entrega</h1></div>
    <p>Digite seu CEP para localizar o endereço. Depois, complete somente o número e o complemento.</p>
    <form className="customer-card address-card" onSubmit={salvar}>
      <label>CEP<input value={f.cep} onChange={e=>consultarCep(e.target.value)} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000"/></label>
      {buscando&&<small className="address-loading">Buscando endereço…</small>}
      {!!f.endereco&&<div className="address-preview"><span className="address-pin">⌖</span><div><b>{resumo}</b><small>{[f.bairro,f.cidade,f.uf].filter(Boolean).join(' · ')}</small></div></div>}
      <label>Rua<input value={f.endereco} onChange={e=>setF({...f,endereco:e.target.value})} placeholder="Preenchida pelo CEP"/></label>
      <label>Bairro<input value={f.bairro} onChange={e=>setF({...f,bairro:e.target.value})} placeholder="Preenchido pelo CEP"/></label>
      <div className="address-row"><label>Número<input value={f.numero} onChange={e=>setF({...f,numero:e.target.value})} inputMode="numeric" placeholder="Ex.: 394"/></label><label>Complemento<input value={f.complemento} onChange={e=>setF({...f,complemento:e.target.value})} placeholder="Opcional"/></label></div>
      {!!f.cidade&&<small className="address-city">{f.cidade}{f.uf?` - ${f.uf}`:''}</small>}
      <div className="address-map-placeholder" aria-label="Prévia da localização"><span>⌖</span><div><b>Localização do endereço</b><small>O mapa será conectado na próxima evolução desta etapa. Seu endereço já está preparado para geolocalização.</small></div></div>
      {erro&&<div className="customer-error">{erro}</div>}
      <button disabled={buscando}>{buscando?'Consultando CEP…':'Salvar endereço'}</button>{ok&&<div className="customer-success">Endereço salvo ✓</div>}
    </form>
  </main><CustomerBottomNav/></>;
}
