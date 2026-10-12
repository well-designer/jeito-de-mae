import {NextResponse} from 'next/server';
import {exigirAdmin} from '@/lib/supabaseServer';
import {supabaseAdmin} from '@/lib/supabaseAdmin';
import webpush from 'web-push';
export const dynamic='force-dynamic';
const ultimo=new Map();
export async function POST(request){
 const admin=await exigirAdmin();
 if(!admin)return NextResponse.json({erro:'Acesso restrito.'},{status:403});
 let body;try{body=await request.json()}catch{return NextResponse.json({erro:'Dados inválidos.'},{status:400})}
 if(body?.confirmacao!=='TESTE INDIVIDUAL')return NextResponse.json({erro:'Confirmação obrigatória.'},{status:400});
 const titulo=String(body?.titulo||'').trim(),mensagem=String(body?.mensagem||'').trim();
 if(titulo.length<3||titulo.length>80||mensagem.length<3||mensagem.length>180)return NextResponse.json({erro:'Título ou mensagem fora do limite.'},{status:400});
 const now=Date.now(),last=ultimo.get(admin.id)||0;
 if(now-last<120000)return NextResponse.json({erro:'Aguarde dois minutos antes de outro teste.'},{status:429});
 const sb=supabaseAdmin();
 const {data:devices,error}=await sb.from('crm_push_clientes').select('id,auth_user_id,endpoint,p256dh,auth').eq('promocional',true).limit(3);
 if(error)return NextResponse.json({erro:'Não foi possível validar destinatários.'},{status:503});
 if(devices?.length!==1)return NextResponse.json({erro:'Teste bloqueado: é necessário exatamente 1 aparelho com autorização promocional. Consulte a prévia.'},{status:409});
 const sub=devices[0];
 const {data:consent,error:consentError}=await sb.from('crm_consentimentos').select('status').eq('cliente_chave','auth:'+sub.auth_user_id).eq('status','autorizado').maybeSingle();
 if(consentError||!consent)return NextResponse.json({erro:'Teste bloqueado: consentimento promocional não confirmado.'},{status:409});
 const publicKey=process.env.VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY;
 if(!publicKey||!privateKey)return NextResponse.json({erro:'Notificações indisponíveis.'},{status:503});
 ultimo.set(admin.id,now);
 try{
  webpush.setVapidDetails('mailto:contato@jeitodemae.app',publicKey,privateKey);
  await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({title:titulo,body:mensagem,url:'/',tag:'crm-teste-'+now}));
  console.info('[crm-push-teste]',JSON.stringify({admin_id:admin.id,dispositivo_id:sub.id,resultado:'aceito',instante:new Date(now).toISOString()}));
  return NextResponse.json({ok:true,aparelhos:1,observacao:'Serviço aceitou o envio; confirme o recebimento no iPhone. Campanhas em massa seguem bloqueadas.'});
 }catch(e){
  console.error('[crm-push-teste]',JSON.stringify({admin_id:admin.id,dispositivo_id:sub.id,resultado:'falha',codigo:e?.statusCode||null}));
  return NextResponse.json({erro:'Falha ao enviar o teste individual.'},{status:502});
 }
}
