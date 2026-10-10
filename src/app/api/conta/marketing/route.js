import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

async function usuario(request) {
  const cabecalho = request.headers.get('authorization') || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '';
  if (!token) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:{user},error} = await client.auth.getUser(token);
  return error ? null : user;
}

export async function GET(request) {
  const user = await usuario(request);
  if (!user) return NextResponse.json({erro:'Entre na sua conta para consultar a preferência.'},{status:401});
  const {data,error} = await supabaseAdmin().from('crm_consentimentos')
    .select('status,atualizado_em').eq('cliente_chave','auth:'+user.id).maybeSingle();
  if (error) return NextResponse.json({erro:'Preferência indisponível.'},{status:503});
  return NextResponse.json({status:data?.status||'nao_informado',atualizado_em:data?.atualizado_em||null});
}

export async function POST(request) {
  const user = await usuario(request);
  if (!user) return NextResponse.json({erro:'Entre na sua conta para alterar a preferência.'},{status:401});
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({erro:'Dados inválidos.'},{status:400}); }
  // Endpoint exclusivo para descadastro: nunca concede autorização.
  if (body?.acao !== 'revogar') return NextResponse.json({erro:'Operação não permitida.'},{status:400});
  const chave = 'auth:'+user.id;
  const nome = String(user.user_metadata?.nome||user.user_metadata?.name||user.email||'Cliente').slice(0,120);
  const {data,error} = await supabaseAdmin().from('crm_consentimentos').upsert({
    cliente_chave:chave,cliente_nome:nome,status:'revogado',
    origem:'cliente_autenticado',observacao:'Descadastro solicitado pelo próprio cliente na conta.',
    atualizado_por:user.id,atualizado_em:new Date().toISOString()
  },{onConflict:'cliente_chave'}).select('status,atualizado_em').single();
  if (error) return NextResponse.json({erro:'Não foi possível registrar o descadastro.'},{status:503});
  return NextResponse.json({status:data.status,atualizado_em:data.atualizado_em});
}
