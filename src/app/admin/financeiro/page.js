import { redirect } from 'next/navigation';
import Link from 'next/link';
import { exigirAdmin } from '@/lib/supabaseServer';
import FinanceiroV15 from '@/components/FinanceiroV15';
import '../admin-v15.css';

export const dynamic = 'force-dynamic';

export default async function FinanceiroPage(){
  const user=await exigirAdmin();
  if(!user) redirect('/login');
  return <div className="admin-v15-shell">
    <header className="admin-v15-top"><div className="admin-v15-top-in"><div className="admin-v15-mark">JM</div><div className="admin-v15-title"><b>Jeito de Mãe</b><small>Gestão financeira</small></div><div className="admin-v15-actions"><Link href="/">Loja</Link><Link href="/admin">Pedidos</Link></div></div></header>
    <main className="admin-v15-main"><FinanceiroV15/></main>
    <nav className="admin-v15-bottom" aria-label="Navegação do painel">
      <Link href="/admin"><span className="ico">▣</span>Pedidos</Link>
      <Link href="/admin/cozinha"><span className="ico">♨</span>Cozinha</Link>
      <Link className="active" href="/admin/financeiro"><span className="ico">$</span>Financeiro</Link>
      <Link href="/admin#mais"><span className="ico">•••</span>Mais</Link>
    </nav>
  </div>;
}
