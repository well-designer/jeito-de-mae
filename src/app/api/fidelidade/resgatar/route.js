import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { soDigitos } from '@/lib/validation';
import { limitar,ipDe } from '@/lib/rateLimit';
import crypto from 'crypto';
export const runtime='nodejs';
function validarToken(telefone,token){
 const [id,assinatura]=String(token||'').split('.');if(!/^[0-9a-f-]{36}$/i.test(id||'')||!assinatura)return null;
 const esperado=crypto.createHmac('sha256',String(process.env.SUPABASE_SERVICE_ROLE_KEY||'')).update(telefone+'|'+id).digest('hex');
 if(assinatura.length!==esperado.length||!crypto.timingSafeEqual(Buffer.from(assinatura),Buffer.from(esperado)))return null;return id;
}
export async function POST(request){
 if(!limitar('resgate:'+ipDe(request),5,60000))return NextResponse.json({erro:'Muitas tentativas. Aguarde um minuto.'},{status:429});
 const b=await request.json().catch(()=>({}));const telefone=soDigitos(b.telefone||'');const recompensa=String(b.recompensaId||'');const verificacaoId=validarToken(telefone,b.verificacao);
 if(telefone.length<10||!/^[0-9a-f-]{36}$/i.test(recompensa))return NextResponse.json({erro:'Dados inválidos.'},{status:400});
 if(!verificacaoId)return NextResponse.json({erro:'Confirme seu WhatsApp antes de resgatar.'},{status:403});
 const sb=supabaseAdmin();
 const {data:v}=await sb.from('fidelidade_verificacoes').select('id,telefone,verificado_em,criado_em').eq('id',verificacaoId).eq('telefone',telefone).maybeSingle();
 if(!v?.verificado_em||Date.now()-new Date(v.verificado_em).getTime()>30*60*1000)return NextResponse.json({erro:'Sua confirmação expirou. Confirme o WhatsApp novamente.'},{status:403});
 const {data:cliente}=await sb.from('fidelidade_clientes').select('id').eq('telefone',telefone).maybeSingle();if(!cliente)return NextResponse.json({erro:'Cliente não encontrado.'},{status:404});
 const codigo='JM-'+crypto.randomBytes(4).toString('hex').toUpperCase();
 const {data:id,error}=await sb.rpc('resgatar_recompensa_fidelidade',{p_cliente_id:cliente.id,p_recompensa_id:recompensa,p_codigo:codigo});
 if(error){const m=String(error.message||'');if(m.includes('saldo_insuficiente'))return NextResponse.json({erro:'Você não tem pontos suficientes.'},{status:409});if(m.includes('recompensa_indisponivel'))return NextResponse.json({erro:'Esta recompensa não está disponível.'},{status:409});console.error('[fidelidade] resgate:',error);return NextResponse.json({erro:'Não foi possível concluir o resgate.'},{status:500})}
 return NextResponse.json({ok:true,resgate:{id,codigo}});
}
