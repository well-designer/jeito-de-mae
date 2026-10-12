import {NextResponse} from 'next/server';
import {exigirAdmin} from '@/lib/supabaseServer';
import {supabaseAdmin} from '@/lib/supabaseAdmin';
import webpush from 'web-push';
export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
export async function POST(request){
 const admin=await exigirAdmin();
 if(!admin)return NextResponse.json({erro:'Acesso restrito.'},{status:403});
 let body;try{body=await request.json()}catch{return NextResponse.json({erro:'Dados inválidos.'},{status:400})}
 const id=String(body?.id||'');
 if(!UUID.test(id)||body?.confirmacao!=='ENVIAR CAMPANHA')return NextResponse.json({erro:'Confirmação inválida.'},{status:400});
 const sb=supabaseAdmin();
 const {data:campanha,error:erroCampanha}=await sb.from('crm_campanhas').select('id,titulo,mensagem,segmento,status').eq('id',id).maybeSingle();
 if(erroCampanha||!campanha)return NextResponse.json({erro:'Campanha não encontrada.'},{status:404});
 if(campanha.status!=='rascunho')return NextResponse.json({erro:'Campanha já utilizada ou indisponível. Crie outro rascunho.'},{status:409});
 if(campanha.segmento!=='Todos')return NextResponse.json({erro:'Envio disponível somente para Todos.'},{status:422});
 const titulo=campanha.titulo.trim(),mensagem=campanha.mensagem.trim();
 if(titulo.length<3||titulo.length>80||mensagem.length<3||mensagem.length>180)return NextResponse.json({erro:'Notificação exige título até 80 e mensagem até 180 caracteres.'},{status:422});
 const {data:devices,error:erroDevices}=await sb.from('crm_push_clientes').select('id,auth_user_id,endpoint,p256dh,auth').eq('promocional',true).limit(26);
 if(erroDevices)return NextResponse.json({erro:'Não foi possível verificar aparelhos.'},{status:503});
 if(devices.length>25)return NextResponse.json({erro:'Limite inicial de segurança: 25 aparelhos por campanha.'},{status:422});
 const ids=[...new Set(devices.map(d=>d.auth_user_id).filter(Boolean))];
 if(!ids.length)return NextResponse.json({erro:'Não há destinatários autorizados.'},{status:422});
 const {data:consents,error:erroConsent}=await sb.from('crm_consentimentos').select('cliente_chave').in('cliente_chave',ids.map(x=>'auth:'+x)).eq('status','autorizado');
 if(erroConsent)return NextResponse.json({erro:'Não foi possível verificar consentimentos.'},{status:503});
 const allowed=new Set((consents||[]).map(x=>x.cliente_chave.slice(5)));
 const targets=devices.filter(d=>allowed.has(d.auth_user_id)&&d.endpoint&&d.p256dh&&d.auth);
 if(!targets.length)return NextResponse.json({erro:'Não há aparelhos com autorização válida.'},{status:422});
 if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)return NextResponse.json({erro:'Notificações não configuradas.'},{status:503});
 // Reserva atômica antes de enviar: uma campanha só pode ser consumida uma vez.
 const {data:claimed,error:claimError}=await sb.from('crm_campanhas').update({status:'arquivada',atualizado_em:new Date().toISOString()}).eq('id',id).eq('status','rascunho').select('id');
 if(claimError)return NextResponse.json({erro:'Não foi possível reservar a campanha.'},{status:503});
 if(claimed?.length!==1)return NextResponse.json({erro:'Campanha já processada. Nenhum reenvio permitido.'},{status:409});
 webpush.setVapidDetails('mailto:contato@jeitodemae.app',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
 let aceitos=0,falhas=0,revogados=0;
 for(const d of targets){
  const {data:device,error:deviceError}=await sb.from('crm_push_clientes').select('promocional').eq('id',d.id).maybeSingle();
  const {data:consent,error:consentError}=await sb.from('crm_consentimentos').select('status').eq('cliente_chave','auth:'+d.auth_user_id).maybeSingle();
  if(deviceError||consentError||device?.promocional!==true||consent?.status!=='autorizado'){revogados++;continue}
  try{await webpush.sendNotification({endpoint:d.endpoint,keys:{p256dh:d.p256dh,auth:d.auth}},JSON.stringify({title:titulo,body:mensagem,url:'/',tag:'crm-campanha-'+id}),{TTL:3600});aceitos++}
  catch(e){falhas++;console.error('[crm-campanha]',JSON.stringify({campanha_id:id,dispositivo_id:d.id,codigo:e?.statusCode||null}));}
 }
 console.info('[crm-campanha]',JSON.stringify({campanha_id:id,admin_id:admin.id,aceitos,falhas,revogados,concluido_em:new Date().toISOString()}));
 return NextResponse.json({ok:true,aceitos,falhas,revogados,observacao:'Campanha encerrada, sem reenvio. Aceite do serviço não garante recebimento.'});
}
