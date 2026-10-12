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
  // O registro global sozinho não autoriza envio push: exigimos também opt-in por aparelho.
  const {data:devices,error:devicesError}=await supabaseAdmin().from('crm_push_clientes').select('id,promocional').eq('auth_user_id',user.id);
  if(devicesError)return NextResponse.json({erro:'Preferência push indisponível.'},{status:503});
  const autorizado=data?.status==='autorizado'&&devices?.some(d=>d.promocional===true);
  return NextResponse.json({status:autorizado?'autorizado':data?.status==='revogado'?'revogado':'nao_informado',atualizado_em:data?.atualizado_em||null});
}

export async function POST(request) {
  const user = await usuario(request);
  if (!user) return NextResponse.json({erro:'Entre na sua conta para alterar a preferência.'},{status:401});
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({erro:'Dados inválidos.'},{status:400}); }
  // Consentimento novo e explicito, com finalidade/canal registrados.
  if (!['revogar','autorizar_push'].includes(body?.acao)) return NextResponse.json({erro:'Operação não permitida.'},{status:400});
  if(body.acao==='autorizar_push' && body.confirmacao!==true)
    return NextResponse.json({erro:'Confirme explicitamente a autorização.'},{status:400});
  const chave = 'auth:'+user.id;
  const nome = String(user.user_metadata?.nome||user.user_metadata?.name||user.email||'Cliente').slice(0,120);
  const autorizar=body.acao==='autorizar_push';
  const {data,error} = await supabaseAdmin().from('crm_consentimentos').upsert({
    cliente_chave:chave,cliente_nome:nome,status:autorizar?'autorizado':'revogado',
    origem:'cliente_autenticado',observacao:autorizar?'Opt-in expresso do cliente autenticado para ofertas via push, marcado voluntariamente na pagina de notificacoes.':'Descadastro solicitado pelo próprio cliente na conta.',
    atualizado_por:user.id,atualizado_em:new Date().toISOString()
  },{onConflict:'cliente_chave'}).select('status,atualizado_em').single();
  if (error) return NextResponse.json({erro:'Não foi possível registrar o descadastro.'},{status:503});
  // Inscrição push e consentimento são independentes. Só aparelhos do próprio usuário
  // recebem o sinal de opt-in; revogação desliga todos imediatamente.
  const {error:erroAparelhos}=await supabaseAdmin().from('crm_push_clientes')
    .update({promocional:autorizar,atualizado_em:new Date().toISOString()}).eq('auth_user_id',user.id);
  if(erroAparelhos)return NextResponse.json({erro:'Preferência registrada, mas não foi possível atualizar os aparelhos. Os envios continuam bloqueados até a reconciliação.'},{status:503});
  return NextResponse.json({status:data.status,atualizado_em:data.atualizado_em,canal:autorizar?'push':null,envio_ativo:false});
}
