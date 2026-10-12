import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const MENSAGENS = {
 confirmado: ['Pedido confirmado', 'A loja confirmou seu pedido.'],
 preparo: ['Pedido em preparo', 'Estamos preparando seu pedido com carinho.'],
 entrega: ['Pedido saiu para entrega', 'Seu pedido está a caminho!'],
 pronto_retirada: ['Pedido pronto para retirada', 'Seu pedido está esperando por você.'],
 concluido: ['Pedido finalizado', 'Obrigado por escolher o Jeito de Mãe!'],
 cancelado: ['Pedido cancelado', 'Consulte o acompanhamento para mais informações.'],
};
export async function notificarClienteStatus(pedido) {
 try {
  if (!pedido?.auth_user_id || !MENSAGENS[pedido.status]) return;
  const chavePublica=process.env.VAPID_PUBLIC_KEY, chavePrivada=process.env.VAPID_PRIVATE_KEY;
  if (!chavePublica || !chavePrivada) return;
  const sb=supabaseAdmin();
  const {data:inscricoes,error}=await sb.from('crm_push_clientes').select('id,endpoint,p256dh,auth').eq('auth_user_id',pedido.auth_user_id).limit(20);
  if(error){console.error('[push-status] consulta:',error);return}
  if(!inscricoes?.length)return;
  webpush.setVapidDetails('mailto:contato@jeitodemae.app',chavePublica,chavePrivada);
  const [title,body]=MENSAGENS[pedido.status];
  const payload=JSON.stringify({title,body,url:'/meus-pedidos',tag:'status-pedido-'+pedido.id+'-'+pedido.status});
  await Promise.allSettled(inscricoes.map(async d=>{
   try {
    await webpush.sendNotification({endpoint:d.endpoint,keys:{p256dh:d.p256dh,auth:d.auth}},payload,{TTL:3600});
   } catch(e) {
    if([404,410].includes(e?.statusCode))await sb.from('crm_push_clientes').delete().eq('id',d.id);
    else console.error('[push-status] falha:',e?.statusCode||e?.message);
   }
  }));
 }catch(e){console.error('[push-status] geral:',e?.message||e)}
}
