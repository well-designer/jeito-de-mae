import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
export const dynamic='force-dynamic';
async function usuario(request){
 const h=request.headers.get('authorization')||'';
 if(!h.startsWith('Bearer '))return null;
 const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await sb.auth.getUser(h.slice(7));
 return error?null:data.user;
}
export async function GET(request){
 const user=await usuario(request);
 if(!user)return NextResponse.json({erro:'Faça login.'},{status:401});
 const {data,error}=await supabaseAdmin().from('crm_push_clientes').select('id,endpoint,criado_em,promocional').eq('auth_user_id',user.id).order('criado_em',{ascending:false}).limit(20);
 if(error)return NextResponse.json({erro:'Inscrições indisponíveis.'},{status:503});
 return NextResponse.json({inscricoes:(data||[]).map(({endpoint,...item})=>({...item,atual:!!endpoint&&endpoint===new URL(request.url).searchParams.get('endpoint')})),envio_promocional_ativo:false});
}
export async function POST(request){
 const user=await usuario(request);
 if(!user)return NextResponse.json({erro:'Faça login.'},{status:401});
 let body;try{body=await request.json()}catch{return NextResponse.json({erro:'Dados inválidos.'},{status:400})}
 const sub=body?.subscription;
 const endpoint=String(sub?.endpoint||''),p256dh=String(sub?.keys?.p256dh||''),auth=String(sub?.keys?.auth||'');
 if(!endpoint.startsWith('https://')||endpoint.length>2048||p256dh.length<20||p256dh.length>512||auth.length<8||auth.length>256)
  return NextResponse.json({erro:'Inscrição inválida.'},{status:400});
 // A inscricao no aparelho nao constitui autorizacao promocional.
 const sb=supabaseAdmin();
 const {data:existente,error:erroBusca}=await sb.from('crm_push_clientes').select('auth_user_id,promocional').eq('endpoint',endpoint).maybeSingle();
 if(erroBusca)return NextResponse.json({erro:'Inscrição indisponível.'},{status:503});
 if(existente&&existente.auth_user_id!==user.id)return NextResponse.json({erro:'Este aparelho já está associado a outra conta.'},{status:409});
 const {error}=await sb.from('crm_push_clientes').upsert({auth_user_id:user.id,endpoint,p256dh,auth,promocional:existente?.promocional===true,atualizado_em:new Date().toISOString()},{onConflict:'endpoint'});
 if(error)return NextResponse.json({erro:'Não foi possível salvar a inscrição.'},{status:503});
 return NextResponse.json({ok:true,promocional:existente?.promocional===true,envio_ativo:false});
}
export async function DELETE(request){
 const user=await usuario(request);
 if(!user)return NextResponse.json({erro:'Faça login.'},{status:401});
 let body;try{body=await request.json()}catch{return NextResponse.json({erro:'Dados inválidos.'},{status:400})}
 const endpoint=String(body?.endpoint||'');
 if(!endpoint||endpoint.length>2048)return NextResponse.json({erro:'Inscrição inválida.'},{status:400});
 const {error}=await supabaseAdmin().from('crm_push_clientes').delete().eq('auth_user_id',user.id).eq('endpoint',endpoint);
 if(error)return NextResponse.json({erro:'Não foi possível cancelar.'},{status:503});
 return NextResponse.json({ok:true});
}

export async function PATCH(request){
 const user=await usuario(request);
 if(!user)return NextResponse.json({erro:'Faça login.'},{status:401});
 let body;try{body=await request.json()}catch{return NextResponse.json({erro:'Dados inválidos.'},{status:400})}
 const id=String(body?.id||'');
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))return NextResponse.json({erro:'Cadastro inválido.'},{status:400});
 const sb=supabaseAdmin();
 const {data:registro,error:erro}=await sb.from('crm_push_clientes').select('id,endpoint').eq('id',id).eq('auth_user_id',user.id).maybeSingle();
 if(erro)return NextResponse.json({erro:'Não foi possível verificar o cadastro.'},{status:503});
 if(!registro)return NextResponse.json({erro:'Cadastro não encontrado.'},{status:404});
 const atual=String(body?.endpoint_atual||'');
 if(!atual.startsWith('https://')||atual.length>2048)return NextResponse.json({erro:'Confirme o aparelho atual antes de remover um cadastro antigo.'},{status:400});
 if(registro.endpoint===atual)return NextResponse.json({erro:'Este é o aparelho atual. Use Remover este aparelho para cancelar suas notificações.'},{status:409});
 const {data:ativo,error:erroAtivo}=await sb.from('crm_push_clientes').select('id').eq('endpoint',atual).eq('auth_user_id',user.id).maybeSingle();
 if(erroAtivo||!ativo)return NextResponse.json({erro:'O aparelho atual não está cadastrado. Nenhum registro foi removido.'},{status:409});
 const {error:erroDelete}=await sb.from('crm_push_clientes').delete().eq('id',id).eq('auth_user_id',user.id);
 if(erroDelete)return NextResponse.json({erro:'Não foi possível remover o cadastro antigo.'},{status:503});
 return NextResponse.json({ok:true});
}
