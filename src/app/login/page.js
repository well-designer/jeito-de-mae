'use client';

import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const res = await fetch('/api/auth/login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'same-origin',
        cache:'no-store',
        body:JSON.stringify({email,senha}),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro || 'Não foi possível entrar. Tente novamente.');
        return;
      }
      if (!data.destino || !data.destino.startsWith('/')) {
        setErro('O servidor não retornou um destino válido.');
        return;
      }
      window.location.assign(data.destino);
    } catch {
      setErro('Falha de comunicação com o servidor. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="wrap">
      <form className="login-card" onSubmit={entrar}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 24, margin: '0 0 6px' }}>
          Painel da loja
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 18px' }}>
          Jeito de Mãe — acesso restrito à família.
        </p>

        {erro && <div className="alert err">{erro}</div>}

        <label className="f">E-mail</label>
        <input className="inp" type="email" autoComplete="username" required
          value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="f">Senha</label>
        <input className="inp" type="password" autoComplete="current-password" required
          value={senha} onChange={(e) => setSenha(e.target.value)} />

        <button className="btn" style={{ marginTop: 20 }} disabled={carregando}>
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
        <a href="/" className="btn ghost" style={{ marginTop: 8 }}>Voltar ao cardápio</a>
      </form>
    </main>
  );
}
