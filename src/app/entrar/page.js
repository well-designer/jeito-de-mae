'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import '../loja-v15.css';

export default function EntrarCliente(){
 const router=useRouter();
 const [recuperar,setRecuperar]=useState(false);
 const [cadastroPendente,setCadastroPendente]=useState(false);
 const [email,setEmail]=useState(''),[senha,setSenha]=useState(''),[nome,setNome]=useState(''),[telefone,setTelefone]=useState(''),[cadastro,setCadastro]=useState(false),[erro,setErro]=useState(''),[aviso,setAviso]=useState(''),[loading,setLoading]=useState(false);
 async function enviar(e){
  e.preventDefault();setErro('');setAviso('');setCadastroPendente(false);setLoading(true);
  try{
   const sb=supabaseBrowser();
   if(recuperar){
    const {error}=await sb.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/redefinir-senha'});
    if(error)throw error;
    setAviso('Se existir uma conta com este e-mail, você receberá um link para redefinir sua senha. Confira também o spam.');return;
   }
   if(cadastro){
    const {data,error}=await sb.auth.signUp({email,password:senha,options:{data:{nome:nome.trim(),telefone:telefone.replace(/\D/g,'')}}});
    if(error)throw error;
    if(!data.session){setAviso('Se este e-mail ainda não tiver uma conta, você receberá uma mensagem de confirmação. Confira também a pasta de spam. Se já tiver cadastro, entre na sua conta ou recupere sua senha.');setCadastroPendente(true);setCadastro(false);return;}
   }else{
    const {error}=await sb.auth.signInWithPassword({email,password:senha});if(error)throw error;
   }
   const next=new URLSearchParams(window.location.search).get('next');
   router.replace(next&&next.startsWith('/')&&!next.startsWith('//')?next:'/conta');router.refresh();
  }catch(e){setErro(e.message||'Não foi possível acessar sua conta.');}finally{setLoading(false)}
 }
 return <main className="customer-auth-page"><div className="customer-auth-brand"><Link href="/">‹ Voltar</Link><span>JEITO DE MÃE</span><h1>{recuperar?'Recuperar minha senha':cadastro?'Crie sua conta':'Que bom ter você aqui!'}</h1><p>{recuperar?'Informe seu e-mail para receber um link de recuperação.':'Seus pedidos, endereços e benefícios sempre com você.'}</p></div><form className="customer-auth-form" onSubmit={enviar}>
 {cadastro&&<><label>Seu nome<input required autoComplete="name" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Como podemos chamar você?"/></label><label>WhatsApp<input required inputMode="tel" autoComplete="tel" value={telefone} onChange={e=>setTelefone(e.target.value)} placeholder="(11) 99999-9999"/></label></>}
 <label>E-mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seuemail@exemplo.com"/></label>
 {!recuperar&&<label>Senha<input required minLength={6} type="password" autoComplete={cadastro?'new-password':'current-password'} value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Mínimo de 6 caracteres"/></label>}
 {erro&&<p className="customer-error">{erro}</p>}{aviso&&<div className="customer-auth-notice" role="status"><p>{aviso}</p>{cadastroPendente&&<div style={{display:'flex',flexWrap:'wrap',gap:12,marginTop:12}}><button type="button" className="customer-auth-switch" onClick={()=>{setCadastro(false);setRecuperar(false);setCadastroPendente(false);setAviso('')}}>Entrar na minha conta</button><button type="button" className="customer-auth-switch" onClick={()=>{setCadastro(false);setRecuperar(true);setCadastroPendente(false);setAviso('')}}>Recuperar senha</button></div>}</div>}
 <button disabled={loading}>{loading?'Aguarde...':recuperar?'Enviar link de recuperação':cadastro?'Criar minha conta':'Entrar na minha conta'}</button>
 {!cadastro&&!recuperar&&<button type="button" className="customer-auth-switch" onClick={()=>{setRecuperar(true);setCadastroPendente(false);setErro('');setAviso('')}}>Esqueci minha senha</button>}
 <button type="button" className="customer-auth-switch" onClick={()=>{if(recuperar){setRecuperar(false);setCadastro(false)}else setCadastro(!cadastro);setCadastroPendente(false);setErro('');setAviso('')}}>{recuperar||cadastro?'Voltar para entrar':'Primeira vez aqui? Criar conta'}</button>
 </form><p className="customer-auth-footer">Feito com carinho, para pedir do seu jeito. ♡</p></main>;
}
