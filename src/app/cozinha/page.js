import { redirect } from 'next/navigation';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

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
    .not('status', 'in', '("concluido","cancelado")')
    .order('criado_em', { ascending: true })
    .limit(120);

  if (error) {
    console.error('Erro ao carregar pedidos da cozinha:', error);
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f7f4f1',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 28,
          }}
        >
          Cozinha
        </h1>

        <p
          style={{
            marginTop: 6,
            color: '#777',
          }}
        >
          Jeito de Mãe — Pedidos em produção
        </p>

        <div
          style={{
            marginTop: 24,
            padding: 20,
            background: '#fff',
            borderRadius: 16,
            border: '1px solid #eee',
          }}
        >
          <strong>
            Pedidos em andamento: {(pedidos || []).length}
          </strong>

          <p
            style={{
              marginBottom: 0,
              marginTop: 8,
              color: '#777',
            }}
          >
            A tela operacional da cozinha será exibida aqui.
          </p>
        </div>
      </div>
    </main>
  );
}
