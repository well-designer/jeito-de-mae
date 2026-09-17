import { redirect } from 'next/navigation';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Admin from '@/components/Admin';

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

  return (
    <Admin
      configInicial={config || {}}
      produtosIniciais={produtos || []}
      pedidosIniciais={pedidos || []}
      email={user.email}
    />
  );
}
