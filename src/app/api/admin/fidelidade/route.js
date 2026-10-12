import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const user = await exigirAdmin();
  if (!user) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });

  const sb = supabaseAdmin();
  const [{ data: config, error: erroConfig }, { data: recompensas, error: erroRecompensas }] = await Promise.all([
    sb.from('fidelidade_config').select('*').eq('id', 1).single(),
    sb.from('fidelidade_recompensas')
      .select('id,nome,descricao,pontos,ativo,ordem,produto_id,produtos(id,nome,ativo)')
      .order('ordem', { ascending: true })
      .order('pontos', { ascending: true }),
  ]);

  if (erroConfig || erroRecompensas) {
    console.error('[fidelidade] admin carregar:', erroConfig || erroRecompensas);
    return NextResponse.json({ erro: 'Não foi possível carregar a fidelidade.' }, { status: 500 });
  }

  return NextResponse.json({ config, recompensas: recompensas || [] });
}

export async function PATCH(request) {
  const user = await exigirAdmin();
  if (!user) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const reais = Number(b.reais_por_ponto);
  const min = Number(b.pedido_minimo);
  const validade = b.validade_dias === '' || b.validade_dias == null ? null : Number(b.validade_dias);

  if (!Number.isFinite(reais) || reais <= 0 || !Number.isFinite(min) || min < 0 ||
      (validade !== null && (!Number.isInteger(validade) || validade <= 0))) {
    return NextResponse.json({ erro: 'Revise os valores informados.' }, { status: 400 });
  }

  const payload = {
    reais_por_ponto: reais,
    pedido_minimo: min,
    validade_dias: validade,
    incluir_taxa_entrega: !!b.incluir_taxa_entrega,
    permitir_com_cupom: !!b.permitir_com_cupom,
    atualizado_em: new Date().toISOString(),
  };

  // Ativação continua bloqueada até o QA final.
  const { data, error } = await supabaseAdmin()
    .from('fidelidade_config').update(payload).eq('id', 1).select().single();

  if (error) return NextResponse.json({ erro: 'Não foi possível salvar.' }, { status: 500 });
  return NextResponse.json({ config: data });
}
