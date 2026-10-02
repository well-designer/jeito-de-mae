import { redirect } from 'next/navigation';
import Link from 'next/link';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Cozinha from '@/components/cozinha';

export const dynamic = 'force-dynamic';

export default async function AdminCozinhaPage() {
  const user = await exigirAdmin();
  if (!user) redirect('/login');

  const { data: pedidos, error } = await supabaseAdmin()
    .from('pedidos')
    .select('*')
    .not('status', 'in', '(concluido,cancelado)')
    .order('criado_em', { ascending: true });

  return (
    <div className="admin-cozinha-shell">
      <nav className="admin-cozinha-nav" aria-label="Navegação administrativa">
        <Link href="/admin">← Pedidos</Link>
        <strong>Cozinha</strong>
        <Link href="/admin">Painel</Link>
      </nav>

      {error ? (
        <div className="admin-cozinha-erro">
          Não foi possível carregar a fila da cozinha.
        </div>
      ) : (
        <Cozinha pedidosIniciais={pedidos || []} />
      )}

      <nav className="admin-mobile-nav" aria-label="Atalhos do painel">
        <Link href="/admin">Pedidos</Link>
        <Link className="active" href="/admin/cozinha">Cozinha</Link>
        <Link href="/admin#financeiro">Financeiro</Link>
        <Link href="/admin#mais">Mais</Link>
      </nav>

      <style>{`
        .admin-cozinha-shell{min-height:100vh;background:#f5f1ed;padding-bottom:74px}
        .admin-cozinha-nav{position:sticky;top:0;z-index:80;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;background:rgba(255,255,255,.96);border-bottom:1px solid #e8ded9;backdrop-filter:blur(12px)}
        .admin-cozinha-nav a{color:#7b263d;text-decoration:none;font-weight:800;font-size:14px}
        .admin-cozinha-nav strong{font-size:15px}
        .admin-cozinha-erro{max-width:900px;margin:30px auto;padding:16px;border-radius:14px;background:#fff;border:1px solid #e8ded9;color:#7b263d}
        .admin-mobile-nav{display:none}
        @media(max-width:700px){
          .admin-cozinha-nav{padding:10px 14px}
          .admin-mobile-nav{position:fixed;left:0;right:0;bottom:0;z-index:120;display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border-top:1px solid #e8ded9;padding:7px 8px calc(7px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(38,27,29,.08)}
          .admin-mobile-nav a{padding:8px 4px;text-align:center;text-decoration:none;color:#786f70;font-size:11px;font-weight:800;border-radius:10px}
          .admin-mobile-nav a.active{color:#7b263d;background:#f7ecee}
        }
      `}</style>
    </div>
  );
}
