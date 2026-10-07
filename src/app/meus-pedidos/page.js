'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CustomerBottomNav from '@/components/CustomerBottomNav';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import '../loja-v15.css';
import './pedidos.css';

const statusInfo = (p) => {
  if (p.status === 'cancelado') return ['Cancelado', 'Pedido cancelado'];
  if (p.status === 'concluido') return [p.tipo === 'retirada' ? 'Retirado' : 'Entregue', 'Pedido finalizado'];
  if (p.status === 'saiu_entrega') return [p.tipo === 'retirada' ? 'Pronto para retirada' : 'Saiu para entrega', p.tipo === 'retirada' ? 'Já pode vir buscar' : 'Seu pedido está a caminho'];
  if (p.status === 'preparo') return ['Em preparo', 'A cozinha está preparando seu pedido'];
  if (p.status === 'confirmado') return ['Confirmado', 'Seu pedido foi confirmado'];
  return ['Pedido recebido', 'Aguardando confirmação da loja'];
};

export default function MeusPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [logado, setLogado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { data } = await supabaseBrowser().auth.getSession();
        const session = data.session;
        if (!ativo) return;
        setLogado(!!session);
        if (!session) return;
        const r = await fetch('/api/minha-conta/pedidos', {
          cache: 'no-store',
          headers: { Authorization: 'Bearer ' + session.access_token },
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro || 'Não foi possível carregar seus pedidos');
        if (ativo) setPedidos(d.pedidos || []);
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, []);

  return <><main className="orders-page">
    <header className="orders-head"><div><h1>Meus pedidos</h1><p>Acompanhe tudo sem precisar guardar código de pedido.</p></div></header>

    {carregando && <div className="empty">Carregando seus pedidos...</div>}

    {!carregando && !logado && <section className="orders-lookup">
      <div className="orders-lookup-title"><b>Entre na sua conta</b><small>Seus pedidos, pontos e recompensas ficam ligados à sua conta Jeito de Mãe.</small></div>
      <Link className="btn" href="/login?next=/meus-pedidos">Entrar ou criar conta</Link>
    </section>}

    {!carregando && logado && erro && <div className="customer-error">{erro}</div>}

    {!carregando && logado && !erro && pedidos.length === 0 && <section className="orders-lookup">
      <div className="orders-lookup-title"><b>Você ainda não fez pedidos nesta conta</b><small>Quando fizer sua primeira compra, ela aparecerá aqui automaticamente.</small></div>
      <Link className="btn" href="/#cardapio">Ver cardápio</Link>
    </section>}

    {!carregando && logado && pedidos.map((p, i) => {
      const [titulo, texto] = statusInfo(p);
      const atual = !['concluido','cancelado'].includes(p.status);
      return <Link href={`/pedido/${p.id}`} className={`last-order-card ${atual && i === 0 ? 'current-order' : ''}`} key={p.id}>
        <div className="last-order-icon">{p.status === 'concluido' ? '✓' : p.status === 'cancelado' ? '×' : '●'}</div>
        <div><small>{atual && i === 0 ? 'PEDIDO EM ANDAMENTO' : new Date(p.criado_em).toLocaleDateString('pt-BR')}</small><b>Pedido {p.codigo} · {titulo}</b><span>{texto}</span><span>{Number(p.total || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span></div>
        <i>›</i>
      </Link>;
    })}
  </main><CustomerBottomNav/></>;
}
