import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

    if (!url) {
      return NextResponse.json(
        {
          ok: false,
          erro: 'NEXT_PUBLIC_SUPABASE_URL nao configurada',
        },
        { status: 500 }
      );
    }

    const hostname = new URL(url).hostname;
    const projectRef = hostname.split('.')[0];

    // Pedido usado apenas para diagnostico.
    // No Supabase ele foi alterado manualmente para "pago".
    const pedidoId = 'bbd6d397-e540-4d91-951d-53fad9368534';

    const { data, error } = await supabaseAdmin()
      .from('pedidos')
      .select('id, codigo, status, status_pagamento, total')
      .eq('id', pedidoId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          supabaseProject: projectRef,
          hostname,
          consultaBanco: {
            sucesso: false,
            erro: error.message,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      supabaseProject: projectRef,
      hostname,
      consultaBanco: {
        sucesso: true,
        pedidoEncontrado: !!data,
        pedido: data || null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        erro: e instanceof Error ? e.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
