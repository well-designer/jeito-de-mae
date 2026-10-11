'use client';
import {useEffect,useState} from 'react';
import {supabaseBrowser} from '@/lib/supabaseBrowser';

export default function DescadastroMarketing(){
  const [estado,setEstado]=useState('carregando');
  const [mensagem,setMensagem]=useState('');
  const [salvando,setSalvando]=useState(false);
  useEffect(()=>{let ativo=true;(async()=>{
    try{
      const {data:{session}}=await supabaseBrowser().auth.getSession();
      if(!session){if(ativo)setEstado('sem_login');return;}
      const r=await fetch('/api/conta/marketing',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||'Não foi possível consultar.');
      if(ativo)setEstado(d.status);
    }catch(e){if(ativo){setEstado('erro');setMensagem(e.message)}}
  })();return()=>{ativo=false}},[]);
  async function autorizar(){
    if(salvando)return;
    setSalvando(true);setMensagem('');
    try{
      const {data:{session}}=await supabaseBrowser().auth.getSession();
      if(!session)throw Error('Entre na sua conta para continuar.');
      const r=await fetch('/api/conta/marketing',{
        method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({acao:'autorizar_push',confirmacao:true})
      });
      const d=await r.json();if(!r.ok)throw Error(d.erro||'Não foi possível registrar.');
      setEstado('autorizado');setMensagem('Autorização para ofertas via push registrada. O envio ainda não está ativo.');
    }catch(e){setMensagem(e.message)}finally{setSalvando(false)}
  }
  async function revogar(){
    if(salvando)return;
    setSalvando(true);setMensagem('');
    try{
      const {data:{session}}=await supabaseBrowser().auth.getSession();
      if(!session)throw Error('Entre na sua conta para continuar.');
      const r=await fetch('/api/conta/marketing',{
        method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({acao:'revogar'})
      });
      const d=await r.json();
      if(!r.ok)throw Error(d.erro||'Não foi possível registrar.');
      setEstado('revogado');setMensagem('Descadastro registrado com sucesso.');
    }catch(e){setMensagem(e.message)}finally{setSalvando(false)}
  }
  return <section className="settings-card" style={{padding:16,marginTop:16}}>
    <h2 style={{fontSize:18,margin:'0 0 8px'}}>Mensagens promocionais</h2>
    <p style={{fontSize:14}}>Você decide se quer receber ofertas por notificações push. A autorização é opcional e pode ser retirada a qualquer momento. Avisos essenciais dos pedidos não são afetados.</p>
    <p style={{fontSize:14}}>Situação: <strong>{({carregando:'Consultando…',sem_login:'Entre na sua conta',erro:'Indisponível',autorizado:'Autorizado (registro interno)',revogado:'Descadastrado',nao_informado:'Não informado'})[estado]||'Não informado'}</strong></p>
    {(estado==='nao_informado'||estado==='revogado')&&<div style={{margin:'12px 0'}}><p style={{fontSize:13}}>Ao tocar em autorizar, você concorda em receber novidades e ofertas da Jeito de Mãe por notificações no celular. Você poderá cancelar aqui quando quiser. A permissão do aparelho é solicitada separadamente.</p><button type="button" disabled={salvando} onClick={autorizar} style={{padding:12,borderRadius:8}}>{salvando?'Salvando…':'Quero receber ofertas por push'}</button></div>}
    {estado==='autorizado'&&
      <button type="button" onClick={revogar} disabled={salvando} style={{padding:12,border:'1px solid #b4492b',borderRadius:8,background:'white',color:'#8c301c',cursor:'pointer'}}>{salvando?'Salvando…':'Não quero receber promoções'}</button>}
    {estado==='sem_login'&&<p>Faça login para registrar o descadastro na sua conta.</p>}
    {mensagem&&<p role="status">{mensagem}</p>}
  </section>;
}
