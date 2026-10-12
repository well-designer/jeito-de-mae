import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
const estados = new Set(['nao_informado','autorizado','revogado']);
export async function GET(request) {
  const user = await exigirAdmin();
  if (!user) return NextResponse.json({erro:'Acesso restrito.'},{status:403});
  const chave = new URL(request.url).searchParams.get('cliente') || '';
  if (chave.length < 5 || chave.length > 120) return NextResponse.json({erro:'Cliente inválido.'},{status:400});
  const {data,error} = await supabaseAdmin().from('crm_consentimentos')
    .select('cliente_chave,cliente_nome,status,origem,observacao,atualizado_em')
    .eq('cliente_chave',chave).maybeSingle();
  if (error) return NextResponse.json({erro:'Preferências indisponíveis.'},{status:503});
  const {data:historico,error:erroHistorico}=await supabaseAdmin().from('crm_consentimentos_historico')
    .select('id,status_anterior,status_novo,observacao,alterado_em')
    .eq('cliente_chave',chave).order('alterado_em',{ascending:false}).limit(30);
  if(erroHistorico)return NextResponse.json({erro:'Auditoria de preferências indisponível.'},{status:503});
  return NextResponse.json({consentimento:data || {cliente_chave:chave,status:'nao_informado'},historico:historico||[]});
}
export async function POST(request) {
  const user = await exigirAdmin();
  if (!user) return NextResponse.json({erro:'Acesso restrito.'},{status:403});
  let body;
  try { body=await request.json(); } catch { return NextResponse.json({erro:'Dados inválidos.'},{status:400}); }
  const chave=String(body?.cliente_chave||'');
  const nome=String(body?.cliente_nome||'').trim();
  const status=String(body?.status||'');
  const observacao=String(body?.observacao||'').trim();
  if (chave.length<5 || chave.length>120 || !nome || nome.length>120 || !estados.has(status) || observacao.length>1000)
    return NextResponse.json({erro:'Dados inválidos.'},{status:400});
  // Nunca transforma ausência de resposta em autorização automaticamente.
  // Reautorizar apos revogacao exige registro explicito de uma nova manifestacao.
  if (status==='autorizado' && !observacao)
    return NextResponse.json({erro:'Descreva a autorização fornecida pelo cliente.'},{status:400});
  // A validacao e a gravacao sao atomicas no banco, inclusive em requisicoes concorrentes.
  const {data,error}=await supabaseAdmin().rpc('crm_atualizar_consentimento',{
    p_chave:chave,p_nome:nome,p_status:status,p_observacao:observacao,p_usuario:user.id
  });
  if(error)return NextResponse.json({erro:'Não foi possível salvar a preferência.'},{status:503});
  return NextResponse.json({consentimento:data});
}
