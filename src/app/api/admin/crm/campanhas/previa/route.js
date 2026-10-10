import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
const SEGMENTOS = new Set(['Todos','Novo','Recorrente ativo','Inativo','Recorrente inativo','VIP']);

// Apenas contagem: nenhuma lista de telefone e nenhuma autorizacao de disparo.
export async function POST(request) {
  const usuario = await exigirAdmin();
  if (!usuario) return NextResponse.json({erro:'Acesso restrito.'},{status:403});
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({erro:'Dados inválidos.'},{status:400}); }
  const segmento = String(body?.segmento || 'Todos');
  const chaves = body?.clientes;
  if (!SEGMENTOS.has(segmento) || !Array.isArray(chaves) || chaves.length > 1000 ||
      chaves.some(chave => typeof chave !== 'string' || chave.length < 5 || chave.length > 120))
    return NextResponse.json({erro:'Seleção inválida.'},{status:400});
  const unicas = [...new Set(chaves)];
  if (!unicas.length) return NextResponse.json({quantidade:0,excluidos:0,modo:'simulacao'});
  const {data,error} = await supabaseAdmin().from('crm_consentimentos')
    .select('cliente_chave,status').in('cliente_chave',unicas);
  if (error) return NextResponse.json({erro:'Não foi possível conferir as preferências.'},{status:503});
  const autorizadas = new Set((data || []).filter(item => item.status === 'autorizado').map(item => item.cliente_chave));
  return NextResponse.json({
    quantidade:unicas.filter(chave => autorizadas.has(chave)).length,
    excluidos:unicas.filter(chave => !autorizadas.has(chave)).length,
    modo:'simulacao',
    aviso:'Registro administrativo não comprova opt-in. Proibido usar esta prévia como autorização de envio.'
  });
}
