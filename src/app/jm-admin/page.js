'use client';

import { useEffect, useState } from 'react';

export default function JMAdminEntrada() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    fetch('/api/auth/destino', { cache: 'no-store' })
      .then(async (r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.destino?.startsWith('/admin')) window.location.replace('/admin#pedidos');
      })
      .catch(() => {})
      .finally(() => setVerificando(false));
  }, []);

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ email, senha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Não foi possível entrar.');
      if (!data.destino?.startsWith('/admin')) throw new Error('Esta conta não possui acesso administrativo.');
      window.location.replace('/admin#pedidos');
    } catch (e) {
      setErro(e.message || 'Falha ao entrar.');
    } finally {
      setCarregando(false);
    }
  }

  return <main style={{minHeight:'100dvh',background:'#fff8f1',display:'grid',placeItems:'center',padding:20}}>
    <section style={{width:'100%',maxWidth:420,background:'#fff',border:'1px solid #eadbd0',borderRadius:24,padding:24,boxShadow:'0 18px 50px rgba(71,24,34,.12)'}}>
      <div style={{textAlign:'center',marginBottom:22}}>
        <img src="/jeito%20de%20m%C3%A3e%20logo%20new.png" alt="Jeito de Mãe" style={{maxWidth:170,height:'auto'}}/>
        <div style={{marginTop:12,fontSize:12,fontWeight:800,letterSpacing:1.6,color:'#8B263D'}}>JM ADMIN</div>
        <h1 style={{margin:'7px 0 4px',fontSize:26,color:'#4b2029'}}>Painel da loja</h1>
        <p style={{margin:0,color:'#806a64',fontSize:14}}>Pedidos e operação em um app separado.</p>
      </div>
      {erro && <div style={{background:'#fff0ee',color:'#9e2d25',padding:12,borderRadius:12,marginBottom:14,fontSize:14}}>{erro}</div>}
      {verificando ? <p style={{textAlign:'center',color:'#806a64'}}>Verificando acesso…</p> :
      <form onSubmit={entrar}>
        <label style={{display:'block',fontSize:13,fontWeight:700,marginBottom:6}}>E-mail</label>
        <input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:13,border:'1px solid #d8cbc5',borderRadius:12,marginBottom:14,fontSize:16}}/>
        <label style={{display:'block',fontSize:13,fontWeight:700,marginBottom:6}}>Senha</label>
        <input type="password" autoComplete="current-password" required value={senha} onChange={e=>setSenha(e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:13,border:'1px solid #d8cbc5',borderRadius:12,marginBottom:18,fontSize:16}}/>
        <button disabled={carregando} style={{width:'100%',border:0,borderRadius:13,padding:14,background:'#8B263D',color:'#fff',fontSize:16,fontWeight:800}}>{carregando?'Entrando…':'Entrar no JM Admin'}</button>
      </form>}
      <p style={{textAlign:'center',margin:'18px 0 0',fontSize:12,color:'#9a8982'}}>Acesso restrito à equipe autorizada.</p>
    </section>
  </main>;
}
