import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import PedidoAcompanhamento from '@/components/PedidoAcompanhamento';
import './pedido.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PedidoPage({ params }) {
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: pedido } = await supabaseAdmin()
    .from('pedidos')
    .select('id,codigo,status,status_pagamento,tipo,total,criado_em')
    .eq('id', id)
    .maybeSingle();

  if (!pedido) notFound();

  return (
    <main className="track-page">
      <div className="track-top">
        <Link href="/" className="track-back">← Cardápio</Link>
        <span>Jeito de Mãe</span>
      </div>
      <PedidoAcompanhamento pedidoInicial={pedido} />
    </main>
  );
}
