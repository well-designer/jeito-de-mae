'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabaseBrowser} from '@/lib/supabaseBrowser';
import '../loja-v15.css';

export default function RedefinirSenha(){
 const router=useRouter();
 const [senha,setSenha]=useState(''),[confirmacao,setConfirmacao]=useState(''),[pronto,setPronto]=useState(false),[verificando,setVerificando]=useState(true),[erro,setErro]=useState(''),[sucesso,setSucesso]=useState(false),[loading,setLoading]=useState(false);
 useEffect(()=>{
  let ativo=true;
  const sb=supabaseBrowser();
  async function verificar(){
   try{
    const params=new URLSearchParams(window.location.search);
    const code=params.get('code');
    if(code){const {error}=await sb.auth.exchangeCodeForSession(code);if(error)throw error;window.history.replaceState({},'',window.location.pathname);}
    const {data:{session},error}=await sb.auth.getSession();
    if(error)throw error;
    if(ativo)setPronto(!!session);
   }catch{if(ativo)setPronto(false)}
   finally{if(ativo)setVerificando(false)}
  }
  verificar();
  return()=>{ativo=false};
 },[]);
 async function salvar(e){
  e.preventDefault();setErro('');
  if(senha.length<8){setErro('Use uma senha com pelo menos 8 caracteres.');return}
  if(senha!==confirmacao){setErro('As senhas não coincidem.');return}
  setLoading(true);
  try{
   const {error}=await supabaseBrowser().auth.updateUser({password:senha});
   if(error)throw error;
   setSucesso(true);
   await supabaseBrowser().auth.signOut();
  }catch(e){setErro(e.message||'Não foi possível atualizar a senha. Solicite um novo link.')}
  finally{setLoading(false)}
 }
 return <main className="customer-auth-page"><div className="customer-auth-brand"><Link href="/entrar">‹ Voltar</Link><span>JEITO DE MÃE</span><h1>Nova senha</h1><p>Proteja sua conta e continue pedindo do seu jeito.</p></div><div className="customer-auth-form">
 {verificando?<p>Verificando link de recuperação…</p>:sucesso?<><p className="customer-auth-notice">Senha atualizada! Agora você pode entrar com a nova senha.</p><Link href="/entrar">Entrar na minha conta</Link></>:!pronto?<><p className="customer-error">O link não está válido ou expirou. Solicite outro e-mail de recuperação.</p><Link href="/entrar">Solicitar novo link</Link></>:<form onSubmit={salvar}><label>Nova senha<input required minLength={8} type="password" autoComplete="new-password" value={senha} onChange={e=>setSenha(e.target.value)}/></label><label>Confirme a senha<input required minLength={8} type="password" autoComplete="new-password" value={confirmacao} onChange={e=>setConfirmacao(e.target.value)}/></label>{erro&&<p className="customer-error">{erro}</p>}<button disabled={loading}>{loading?'Salvando…':'Atualizar minha senha'}</button></form>}
 </div></main>;
}
