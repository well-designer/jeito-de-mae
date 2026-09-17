import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { produtoSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await exigirAdmin())) return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 });
  const { data } = await supabaseAdmin().from('produtos').select('*').order('ordem');
  return NextResponse.json({ produtos: data || [] });
}

/** Cria ou atualiza um item do cardapio. */
export async function POST(request) {
  if (!(await exigirAdmin())) return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 });

  const parsed = produtoSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const { id, ...campos } = parsed.data;
  const sb = supabaseAdmin();

  const query = id
    ? sb.from('produtos').update(campos).eq('id', id).select().single()
    : sb.from('produtos').insert(campos).select().single();

  const { data, error } = await query;
  if (error) return NextResponse.json({ erro: 'falha ao salvar' }, { status: 500 });
  return NextResponse.json({ produto: data });
}

export async function DELETE(request) {
  if (!(await exigirAdmin())) return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ erro: 'id ausente' }, { status: 400 });
  await supabaseAdmin().from('produtos').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
