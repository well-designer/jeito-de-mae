import { NextResponse } from 'next/server';
import { createDecipheriv, createHash, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const id = request.nextUrl.searchParams.get('id');
  const token = request.nextUrl.searchParams.get('token');

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
.select('codigo, status, status_pagamento, entrega_codigo_necessario, entrega_codigo_hash, acompanhamento_token_hash, entrega_codigo_cliente_cifrado')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[status-pedido] erro Supabase:', error);

      return NextResponse.json(
        { erro: 'erro ao consultar pedido' },
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

    let codigo_entrega = null;
    if (token && data.acompanhamento_token_hash && data.entrega_codigo_necessario) {
      const recebido = Buffer.from(createHash('sha256').update(token).digest('hex'), 'hex');
      const esperado = Buffer.from(data.acompanhamento_token_hash, 'hex');
      if (recebido.length === esperado.length && timingSafeEqual(recebido, esperado)) {
        const partes = String(data.entrega_codigo_cliente_cifrado || '').split('.');
        if (partes.length === 3) {
          try {
            const chave = createHash('sha256').update(token).digest();
            const dec = createDecipheriv('aes-256-gcm', chave, Buffer.from(partes[0], 'hex'));
            dec.setAuthTag(Buffer.from(partes[1], 'hex'));
            codigo_entrega = Buffer.concat([
              dec.update(Buffer.from(partes[2], 'hex')),
              dec.final(),
            ]).toString('utf8');
          } catch {
            codigo_entrega = null;
          }
        }
      }
    }
    const resposta = { codigo: data.codigo, status: data.status, status_pagamento: data.status_pagamento, entrega_codigo_necessario: data.entrega_codigo_necessario, codigo_entrega };
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
      { erro: 'erro interno' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  }
}
