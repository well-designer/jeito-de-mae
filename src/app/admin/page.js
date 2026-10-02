import { redirect } from 'next/navigation';
import Link from 'next/link';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Admin from '@/components/Admin';
import './admin-v15.css';

export const dynamic = 'force-dynamic';

export default async function PainelPage() {
  // Segunda barreira (o middleware ja e a primeira).
  const user = await exigirAdmin();
  if (!user) redirect('/login');

  const sb = supabaseAdmin();
  const [{ data: config }, { data: produtos }, { data: pedidos }] = await Promise.all([
    sb.from('config').select('*').eq('id', 1).single(),
    sb.from('produtos').select('*').order('ordem'),
    sb.from('pedidos').select('*').order('criado_em', { ascending: false }).limit(120),
  ]);

  const pedidosAtivos = (pedidos || []).filter(
    (p) => !['concluido', 'cancelado'].includes(p.status)
  ).length;

  return (
    <div className="admin-v15-shell">
      <header className="admin-v15-top">
        <div className="admin-v15-top-in">
          <div className="admin-v15-mark">JM</div>
          <div className="admin-v15-title">
            <b>Jeito de Mãe</b>
            <small>Painel da loja</small>
          </div>
          <div className="admin-v15-actions">
            <Link href="/">Ver loja</Link>
            <Link href="/admin/cozinha">Cozinha</Link>
          </div>
        </div>
      </header>

      <main className="admin-v15-main">
        <Admin
          configInicial={config || {}}
          produtosIniciais={produtos || []}
          pedidosIniciais={pedidos || []}
          email={user.email}
        />
      </main>

      <nav className="admin-v15-bottom" aria-label="Navegação do painel">
        <Link className="active" href="/admin">
          <span className="ico">▣</span>
          Pedidos
          {pedidosAtivos > 0 && <span className="admin-v15-badge">{pedidosAtivos > 9 ? '9+' : pedidosAtivos}</span>}
        </Link>
        <Link href="/admin/cozinha">
          <span className="ico">♨</span>
          Cozinha
        </Link>
        <Link href="/admin#financeiro">
          <span className="ico">$</span>
          Financeiro
        </Link>
        <Link href="/admin#mais">
          <span className="ico">•••</span>
          Mais
        </Link>
      </nav>
    </div>
  );
}
