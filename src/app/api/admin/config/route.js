import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { configSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function PUT(request) {
  if (!(await exigirAdmin())) return NextResponse.json({ erro: 'nao autorizado' }, { status: 401 });

  const parsed = configSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from('config')
    .update({ ...parsed.data, atualizado_em: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single();

  if (error) return NextResponse.json({ erro: 'falha ao salvar' }, { status: 500 });
  return NextResponse.json({ config: data });
}
