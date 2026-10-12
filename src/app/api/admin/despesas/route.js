import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const CATEGORIAS = [
  'alimentos',
  'carnes',
  'hortifruti',
  'embalagens',
  'bebidas',
  'gas',
  'limpeza',
  'entrega',
  'taxas',
  'marketing',
  'outros',
];

const UNIDADES = [
  'kg',
  'g',
  'l',
  'ml',
  'un',
  'pacote',
  'caixa',
  'fardo',
  'bandeja',
  'saco',
];

export async function GET() {
  if (!(await exigirAdmin())) {
    return NextResponse.json(
      { erro: 'nao autorizado' },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin()
    .from('despesas')
    .select('*')
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false });

  if (error) {
    return NextResponse.json(
      { erro: 'falha ao carregar despesas' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    despesas: data || [],
  });
}

export async function POST(request) {
  if (!(await exigirAdmin())) {
    return NextResponse.json(
      { erro: 'nao autorizado' },
      { status: 401 }
    );
  }

  const body = await request
    .json()
    .catch(() => ({}));

  const descricao = String(body.descricao || '').trim();
  const categoria = String(body.categoria || '').trim();
  const valor = Number(body.valor);
  const data = String(body.data || '').trim();
  const observacao = String(body.observacao || '').trim();
  const fornecedor = String(body.fornecedor || '').trim();
  const unidade = String(body.unidade || '').trim().toLowerCase();

  const quantidade =
    body.quantidade === '' || body.quantidade == null
      ? null
      : Number(body.quantidade);

  const valorUnitario =
    body.valor_unitario === '' || body.valor_unitario == null
      ? null
      : Number(body.valor_unitario);

  if (!descricao || descricao.length > 160) {
    return NextResponse.json(
      { erro: 'Informe uma descricao valida' },
      { status: 400 }
    );
  }

  if (!CATEGORIAS.includes(categoria)) {
    return NextResponse.json(
      { erro: 'Categoria invalida' },
      { status: 400 }
    );
  }

  if (!Number.isFinite(valor) || valor <= 0 || valor > 9999999) {
    return NextResponse.json(
      { erro: 'Informe um valor valido' },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json(
      { erro: 'Informe uma data valida' },
      { status: 400 }
    );
  }

  if (observacao.length > 500) {
    return NextResponse.json(
      { erro: 'Observacao muito longa' },
      { status: 400 }
    );
  }

  if (fornecedor.length > 120) {
    return NextResponse.json(
      { erro: 'Fornecedor muito longo' },
      { status: 400 }
    );
  }

  if (
    quantidade != null &&
    (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 999999)
  ) {
    return NextResponse.json(
      { erro: 'Informe uma quantidade valida' },
      { status: 400 }
    );
  }

  if (unidade && !UNIDADES.includes(unidade)) {
    return NextResponse.json(
      { erro: 'Unidade invalida' },
      { status: 400 }
    );
  }

  if (quantidade != null && !unidade) {
    return NextResponse.json(
      { erro: 'Informe a unidade da compra' },
      { status: 400 }
    );
  }

  if (
    valorUnitario != null &&
    (!Number.isFinite(valorUnitario) || valorUnitario < 0 || valorUnitario > 9999999)
  ) {
    return NextResponse.json(
      { erro: 'Informe um valor unitario valido' },
      { status: 400 }
    );
  }

  const { data: despesa, error } = await supabaseAdmin()
    .from('despesas')
    .insert({
      descricao,
      categoria,
      valor,
      data,
      observacao,
      fornecedor: fornecedor || null,
      quantidade,
      unidade: unidade || null,
      valor_unitario: valorUnitario,
    })
    .select()
    .single();

  if (error) {
    console.error('[despesas] insert:', error);
    return NextResponse.json(
      { erro: 'falha ao salvar despesa' },
      { status: 500 }
    );
  }

  return NextResponse.json({ despesa });
}

export async function DELETE(request) {
  if (!(await exigirAdmin())) {
    return NextResponse.json(
      { erro: 'nao autorizado' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ) {
    return NextResponse.json(
      { erro: 'id invalido' },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin()
    .from('despesas')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json(
      { erro: 'falha ao excluir despesa' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
