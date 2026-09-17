import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * A tela do Pix consulta aqui de tempos em tempos para saber se o
 * pagamento caiu. Devolve so o minimo - nada de dado pessoal.
 */
export async function GET(request) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ erro: 'id invalido' }, { status: 400 });
  }

  const { data } = await supabaseAdmin()
    .from('pedidos')
    .select('codigo, status, status_pagamento')
    .eq('id', id)
    .maybeSingle();

  if (!data) return NextResponse.json({ erro: 'nao encontrado' }, { status: 404 });
  return NextResponse.json(data);
}
