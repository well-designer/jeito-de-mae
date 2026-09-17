'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

    setCarregando(false);
    if (error) {
      // Mensagem generica de proposito: nao revela se o e-mail existe.
      setErro('E-mail ou senha incorretos.');
      return;
    }
    router.replace('/admin');
    router.refresh();
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
