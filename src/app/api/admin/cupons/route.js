import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cupomSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * Lista todos os cupons para o painel administrativo.
 */
export async function GET() {
  if (!(await exigirAdmin())) {
    return NextResponse.json(
      { erro: 'nao autorizado' },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin()
    .from('cupons')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('[cupons] listar:', error);

    return NextResponse.json(
      { erro: 'falha ao carregar cupons' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    cupons: data || [],
  });
}

/**
 * Cria ou atualiza um cupom.
 */
export async function POST(request) {
  if (!(await exigirAdmin())) {
    return NextResponse.json(
      { erro: 'nao autorizado' },
      { status: 401 }
    );
  }

  const corpo = await request.json().catch(() => ({}));

  const parsed = cupomSchema.safeParse(corpo);

  if (!parsed.success) {
    return NextResponse.json(
      {
        erro:
          parsed.error.issues[0]?.message ||
          'Dados invalidos',
      },
      { status: 400 }
    );
  }

  const { id, ...campos } = parsed.data;

  // Garante que o codigo seja sempre salvo em maiusculas.
  campos.codigo = campos.codigo
    .trim()
    .toUpperCase();

  const sb = supabaseAdmin();

  /*
   * Não permitimos dois cupons com o mesmo código.
   * A tabela também possui UNIQUE, mas verificamos aqui
   * para retornar uma mensagem melhor ao administrador.
   */
  let existenteQuery = sb
    .from('cupons')
    .select('id')
    .eq('codigo', campos.codigo)
    .limit(1);

  if (id) {
    existenteQuery = existenteQuery.neq('id', id);
  }

  const { data: existente } = await existenteQuery;

  if (existente?.length) {
    return NextResponse.json(
      {
        erro: 'Ja existe um cupom com este codigo',
      },
      { status: 409 }
    );
  }

  const query = id
    ? sb
        .from('cupons')
        .update(campos)
        .eq('id', id)
        .select()
        .single()
    : sb
        .from('cupons')
        .insert(campos)
        .select()
        .single();

  const { data, error } = await query;

  if (error) {
    console.error('[cupons] salvar:', error);

    return NextResponse.json(
      { erro: 'falha ao salvar cupom' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    cupom: data,
  });
}

/**
 * Exclui um cupom.
 */
export async function DELETE(request) {
  if (!(await exigirAdmin())) {
    return NextResponse.json(
      { erro: 'nao autorizado' },
      { status: 401 }
    );
  }

  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { erro: 'id ausente' },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin()
    .from('cupons')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[cupons] excluir:', error);

    return NextResponse.json(
      { erro: 'falha ao excluir cupom' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
