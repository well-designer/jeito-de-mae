import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { soDigitos } from '@/lib/validation';
import { limitar,ipDe } from '@/lib/rateLimit';
import { enviarCodigoFidelidade } from '@/lib/whatsapp';
import crypto from 'crypto';
export const runtime='nodejs';
const hash=v=>crypto.createHash('sha256').update(String(v)+String(process.env.SUPABASE_SERVICE_ROLE_KEY||'')).digest('hex');
export async function POST(request){
 if(!limitar('otp-fid:'+ipDe(request),5,60000))return NextResponse.json({erro:'Aguarde antes de solicitar outro código.'},{status:429});
 const b=await request.json().catch(()=>({}));const telefone=soDigitos(b.telefone||'');if(telefone.length<10||telefone.length>13)return NextResponse.json({erro:'WhatsApp inválido.'},{status:400});
 const sb=supabaseAdmin();const {data:cliente}=await sb.from('fidelidade_clientes').select('id,auth_user_id').eq('telefone',telefone).maybeSingle();if(!cliente)return NextResponse.json({erro:'Nenhum cadastro de fidelidade encontrado.'},{status:404});
 if(cliente.auth_user_id)return NextResponse.json({erro:'Esta fidelidade já está associada a uma conta. Entre na conta original para consultar seus pontos.'},{status:409});
 if(!limitar('otp-fid-telefone:'+telefone,3,10*60*1000))return NextResponse.json({erro:'Aguarde alguns minutos antes de solicitar outro código para este número.'},{status:429});
 const codigo=String(crypto.randomInt(100000,1000000));const exp=new Date(Date.now()+10*60*1000).toISOString();
 const {error}=await sb.from('fidelidade_verificacoes').insert({telefone,codigo_hash:hash(codigo),expira_em:exp});if(error)return NextResponse.json({erro:'Não foi possível gerar o código.'},{status:500});
 const envio=await enviarCodigoFidelidade(telefone,codigo);if(!envio.enviado)return NextResponse.json({erro:'Não foi possível enviar o código pelo WhatsApp.'},{status:503});
 return NextResponse.json({ok:true,expiraEm:exp});
}
export async function PATCH(request){
 if(!limitar('otp-check:'+ipDe(request),10,60000))return NextResponse.json({erro:'Muitas tentativas.'},{status:429});
 const b=await request.json().catch(()=>({}));const telefone=soDigitos(b.telefone||'');const codigo=String(b.codigo||'').trim();
 if(!/^\d{6}$/.test(codigo))return NextResponse.json({erro:'Código inválido.'},{status:400});
 const sb=supabaseAdmin();if(!limitar('otp-check-telefone:'+telefone,10,10*60*1000))return NextResponse.json({erro:'Muitas tentativas para este número. Aguarde alguns minutos.'},{status:429});const {data:v}=await sb.from('fidelidade_verificacoes').select('*').eq('telefone',telefone).is('verificado_em',null).order('criado_em',{ascending:false}).limit(1).maybeSingle();
 if(!v||new Date(v.expira_em)<=new Date()||v.tentativas>=5)return NextResponse.json({erro:'Código expirado. Solicite outro.'},{status:400});
 if(v.codigo_hash!==hash(codigo)){await sb.from('fidelidade_verificacoes').update({tentativas:v.tentativas+1}).eq('id',v.id);return NextResponse.json({erro:'Código incorreto.'},{status:400})}
 await sb.from('fidelidade_verificacoes').update({verificado_em:new Date().toISOString()}).eq('id',v.id);
 const token=crypto.createHmac('sha256',String(process.env.SUPABASE_SERVICE_ROLE_KEY||'')).update(telefone+'|'+v.id).digest('hex');
 return NextResponse.json({ok:true,verificacao:v.id+'.'+token});
}
