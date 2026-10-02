import Link from 'next/link';
import './admin-v15.css';

export default function AdminLayout({ children }) {
  return (
    <div className="admin-v15-shell">
      <header className="admin-v15-top">
        <div className="admin-v15-top-in">
          <div className="admin-v15-mark" aria-hidden="true">JM</div>
          <div className="admin-v15-title">
            <b>Jeito de Mãe</b>
            <small>Painel administrativo</small>
          </div>
          <div className="admin-v15-actions">
            <Link href="/">Loja</Link>
            <Link href="/admin/cozinha">Cozinha</Link>
          </div>
        </div>
      </header>

      <main className="admin-v15-main">{children}</main>

      <nav className="admin-v15-bottom" aria-label="Navegação do painel">
        <Link href="/admin#pedidos">
          <span className="ico" aria-hidden="true">▤</span>
          Pedidos
        </Link>
        <Link href="/admin/cozinha">
          <span className="ico" aria-hidden="true">♨</span>
          Cozinha
        </Link>
        <Link href="/admin#financeiro">
          <span className="ico" aria-hidden="true">$</span>
          Financeiro
        </Link>
        <Link href="/admin#mais">
          <span className="ico" aria-hidden="true">•••</span>
          Mais
        </Link>
      </nav>
    </div>
  );
}
