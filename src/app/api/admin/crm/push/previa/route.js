import {NextResponse} from 'next/server';
import {exigirAdmin} from '@/lib/supabaseServer';
import {supabaseAdmin} from '@/lib/supabaseAdmin';
export const dynamic='force-dynamic';
// Contagem conservadora: apenas público Todos. Nunca expõe IDs, endpoints ou contatos.
export async function GET(request){
 const admin=await exigirAdmin();
 if(!admin)return NextResponse.json({erro:'Acesso restrito.'},{status:403});
 const segmento=new URL(request.url).searchParams.get('segmento')||'Todos';
 if(segmento!=='Todos')return NextResponse.json({erro:'Prévia para este segmento ainda não está disponível. Nenhum envio será permitido.'},{status:422});
 const sb=supabaseAdmin();
 const {data:devices,error:deviceError}=await sb.from('crm_push_clientes').select('auth_user_id').eq('promocional',true).limit(1001);
 if(deviceError)return NextResponse.json({erro:'Não foi possível consultar os aparelhos.'},{status:503});
 if(devices.length>1000)return NextResponse.json({erro:'Prévia indisponível para mais de 1000 aparelhos. Nenhum envio autorizado.'},{status:503});
 const ids=[...new Set(devices.map(x=>x.auth_user_id).filter(Boolean))];
 if(!ids.length)return NextResponse.json({segmento,clientes_aptos:0,aparelhos_com_opt_in:0,envio_ativo:false});
 const keys=ids.map(id=>'auth:'+id);
 const {data:consents,error:consentError}=await sb.from('crm_consentimentos').select('cliente_chave').in('cliente_chave',keys).eq('status','autorizado');
 if(consentError)return NextResponse.json({erro:'Não foi possível verificar autorizações.'},{status:503});
 const allowed=new Set((consents||[]).map(x=>x.cliente_chave.slice(5)));
 const clientes=ids.filter(id=>allowed.has(id)).length;
 const aparelhos=devices.filter(x=>allowed.has(x.auth_user_id)).length;
 return NextResponse.json({segmento,clientes_aptos:clientes,aparelhos_com_opt_in:aparelhos,envio_ativo:false,observacao:'Prévia informativa. Nenhuma campanha será enviada.'});
}
