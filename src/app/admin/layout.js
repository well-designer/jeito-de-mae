import Link from 'next/link';
import AdminHashBridge from '@/components/AdminHashBridge';
import './admin-v15.css';

export default function AdminLayout({ children }) {
  return (
    <div className="admin-v15-shell">
      <AdminHashBridge />
      <header className="admin-v15-top"><div className="admin-v15-top-in"><div className="admin-v15-mark"><img src="/jeito%20de%20m%C3%A3e%20logo%20new.png" alt="Jeito de Mãe" /></div><div className="admin-v15-title"><b>Jeito de Mãe</b><small>Painel administrativo</small></div><div className="admin-v15-actions"><Link href="/">Loja</Link><Link href="/admin/cozinha">Cozinha</Link></div></div></header>
      <main className="admin-v15-main">{children}</main>
      <nav className="admin-v15-bottom" aria-label="Navegação do painel">
        <Link href="/admin#pedidos"><span className="ico" aria-hidden="true">▤</span>Pedidos</Link>
        <Link href="/admin/cozinha"><span className="ico" aria-hidden="true">♨</span>Cozinha</Link>
        <Link href="/admin/financeiro"><span className="ico" aria-hidden="true">$</span>Financeiro</Link>
        <details className="admin-v15-more"><summary><span className="ico" aria-hidden="true">•••</span>Mais</summary><div className="admin-v15-more-menu"><Link href="/admin#cardapio"><span>🍽️</span><b>Cardápio</b><small>Pratos, preços e fotos</small></Link><Link href="/admin#cupons"><span>🏷️</span><b>Cupons</b><small>Descontos e campanhas</small></Link><Link href="/admin/marketing"><span>✦</span><b>Marketing</b><small>Banners, campanhas e IA</small></Link><Link href="/admin/fidelidade"><span>♡</span><b>Fidelidade</b><small>Pontos e recompensas</small></Link><Link href="/admin#config"><span>⚙️</span><b>Configurações</b><small>Loja, entrega e horários</small></Link><Link href="/admin/usuarios"><span>👥</span><b>Usuários</b><small>Equipe e permissões</small></Link><Link href="/"><span>↗</span><b>Ver loja</b><small>Abrir site do cliente</small></Link></div></details>
      </nav>
    </div>
  );
}
