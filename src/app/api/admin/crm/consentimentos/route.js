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
  return NextResponse.json({consentimento:data || {cliente_chave:chave,status:'nao_informado'}});
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
  if (status==='autorizado' && !observacao)
    return NextResponse.json({erro:'Descreva a autorização fornecida pelo cliente.'},{status:400});
  const {data,error}=await supabaseAdmin().from('crm_consentimentos').upsert({
    cliente_chave:chave,cliente_nome:nome,status,observacao,
    origem:'registro_administrativo',atualizado_por:user.id,atualizado_em:new Date().toISOString()
  },{onConflict:'cliente_chave'}).select('cliente_chave,cliente_nome,status,origem,observacao,atualizado_em').single();
  if(error)return NextResponse.json({erro:'Não foi possível salvar a preferência.'},{status:503});
  return NextResponse.json({consentimento:data});
}
