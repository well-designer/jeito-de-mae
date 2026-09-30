import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json(
      { erro: 'id invalido' },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  }

  try {
    const { data, error } = await supabaseAdmin()
      .from('pedidos')
      .select('id, codigo, status, status_pagamento')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[status-pedido] erro Supabase:', error);

      return NextResponse.json(
        {
          erro: 'erro ao consultar pedido',
          diagnostico: error.message,
        },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        }
      );
    }

    if (!data) {
      return NextResponse.json(
        { erro: 'nao encontrado' },
        {
          status: 404,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        }
      );
    }

    const resposta = {
      codigo: data.codigo,
      status: data.status,
      status_pagamento: data.status_pagamento,

      // Diagnostico temporario.
      diagnostico: {
        pedido_id: data.id,
        consultado_em: new Date().toISOString(),
        instancia: process.env.VERCEL_REGION || 'local',
      },
    };

    return NextResponse.json(resposta, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[status-pedido] excecao:', e);

    return NextResponse.json(
      {
        erro: 'erro interno',
        diagnostico:
          e instanceof Error ? e.message : 'erro desconhecido',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  }
}
