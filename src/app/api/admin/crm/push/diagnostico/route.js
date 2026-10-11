import { NextResponse } from 'next/server';
import { exigirAdmin } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
export const dynamic='force-dynamic';
// Diagnostico de prontidao: sem endpoints, telefones ou chaves secretas.
export async function GET(){
 const user=await exigirAdmin();
 if(!user)return NextResponse.json({erro:'Acesso restrito.'},{status:403});
 const sb=supabaseAdmin();
 const [inscricoes,consentimentos]=await Promise.all([
  sb.from('crm_push_clientes').select('id',{count:'exact',head:true}),
  sb.from('crm_consentimentos').select('cliente_chave',{count:'exact',head:true}).eq('status','autorizado').like('cliente_chave','auth:%')
 ]);
 if(inscricoes.error||consentimentos.error)return NextResponse.json({erro:'Diagnóstico indisponível.'},{status:503});
 return NextResponse.json({
  vapid_publica:!!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||process.env.VAPID_PUBLIC_KEY),
  vapid_privada:!!process.env.VAPID_PRIVATE_KEY,
  aparelhos_cadastrados:inscricoes.count||0,
  consentimentos_autorizados:consentimentos.count||0,
  envio_promocional_ativo:false,
  proxima_etapa:'Validar VAPID e teste em aparelho real antes de liberar envios.'
 });
}
