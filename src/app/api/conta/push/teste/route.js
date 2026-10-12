import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';
const tentativas = new Map();
async function usuario(request) {
 const header=request.headers.get('authorization')||'';
 if(!header.startsWith('Bearer '))return null;
 const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await sb.auth.getUser(header.slice(7));
 return error?null:data.user;
}
export async function POST(request) {
 const user=await usuario(request);
 if(!user)return NextResponse.json({erro:'Faça login.'},{status:401});
 const now=Date.now(), last=tentativas.get(user.id)||0;
 if(now-last<60000)return NextResponse.json({erro:'Aguarde um minuto antes de testar novamente.'},{status:429});
 let body;try{body=await request.json()}catch{return NextResponse.json({erro:'Dados inválidos.'},{status:400})}
 const endpoint=String(body?.endpoint||'');
 if(!endpoint.startsWith('https://')||endpoint.length>2048)return NextResponse.json({erro:'Aparelho inválido.'},{status:400});
 const sb=supabaseAdmin();
 const {data:sub,error}=await sb.from('crm_push_clientes').select('id,endpoint,p256dh,auth').eq('auth_user_id',user.id).eq('endpoint',endpoint).maybeSingle();
 if(error)return NextResponse.json({erro:'Cadastro indisponível.'},{status:503});
 if(!sub)return NextResponse.json({erro:'Este aparelho não está cadastrado nesta conta.'},{status:404});
 const publicKey=process.env.VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY;
 if(!publicKey||!privateKey)return NextResponse.json({erro:'Notificações indisponíveis.'},{status:503});
 tentativas.set(user.id,now);
 if(tentativas.size>1000){for(const [id,t] of tentativas){if(now-t>120000)tentativas.delete(id)}}
 try {
  webpush.setVapidDetails('mailto:contato@jeitodemae.app',publicKey,privateKey);
  await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({
   title:'🔔 Teste Jeito de Mãe',body:'Seu celular está pronto para receber notificações!',url:'/conta/notificacoes',tag:'teste-cliente-'+Date.now()
  }));
  return NextResponse.json({ok:true});
 }catch(e){
  if(e?.statusCode===404||e?.statusCode===410){
   await sb.from('crm_push_clientes').delete().eq('id',sub.id);
   return NextResponse.json({erro:'Cadastro expirado. Remova e cadastre o aparelho novamente.'},{status:410});
  }
  console.error('[push-cliente-teste]',e?.statusCode||e?.message||'erro');
  return NextResponse.json({erro:'O serviço não conseguiu entregar o teste.'},{status:502});
 }
}
