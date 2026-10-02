import { redirect } from 'next/navigation';
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

  if (error) {
    return (
      <div style={{ maxWidth: 900, margin: '30px auto', padding: 16, borderRadius: 14, background: '#fff', border: '1px solid #e8ded9', color: '#7b263d' }}>
        Não foi possível carregar a fila da cozinha.
      </div>
    );
  }

  return <Cozinha pedidosIniciais={pedidos || []} />;
}
