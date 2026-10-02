import { redirect } from 'next/navigation';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Cozinha from '@/components/cozinha';
import CozinhaSync from '@/components/CozinhaSync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CozinhaPage() {
  // Segunda barreira de segurança.
  // O middleware já verifica se existe uma sessão válida.
  const user = await exigirAdmin();

  if (!user) {
    redirect('/login');
  }

  const sb = supabaseAdmin();

  const { data: pedidos, error } = await sb
    .from('pedidos')
    .select('*')
    .not('status', 'in', '(concluido,cancelado)')
    .order('criado_em', { ascending: true })
    .limit(120);

  if (error) {
    console.error(
      'Erro ao carregar pedidos da cozinha:',
      error
    );
  }

  return (
    <>
      <CozinhaSync />
      <Cozinha
        pedidosIniciais={pedidos || []}
      />
    </>
  );
}
