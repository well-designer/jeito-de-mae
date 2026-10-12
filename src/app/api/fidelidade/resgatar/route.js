import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { limitar,ipDe } from '@/lib/rateLimit';
import crypto from 'crypto';
export const runtime='nodejs';
async function usuario(request){
 const auth=request.headers.get('authorization')||'';const token=auth.startsWith('Bearer ')?auth.slice(7):'';if(!token)return null;
 const verifier=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user}}=await verifier.auth.getUser(token);return user||null;
}
export async function POST(request){
 if(!limitar('resgate:'+ipDe(request),5,60000))return NextResponse.json({erro:'Muitas tentativas. Aguarde um minuto.'},{status:429});
 const user=await usuario(request);if(!user)return NextResponse.json({erro:'Valide seu e-mail para resgatar.'},{status:401});
 const b=await request.json().catch(()=>({}));const recompensa=String(b.recompensaId||'');
 if(!/^[0-9a-f-]{36}$/i.test(recompensa))return NextResponse.json({erro:'Recompensa inválida.'},{status:400});
 const sb=supabaseAdmin();const {data:cliente}=await sb.from('fidelidade_clientes').select('id').eq('auth_user_id',user.id).maybeSingle();
 if(!cliente)return NextResponse.json({erro:'Fidelidade não vinculada a esta conta.'},{status:404});
 const codigo='JM-'+crypto.randomBytes(4).toString('hex').toUpperCase();
 const {data:id,error}=await sb.rpc('resgatar_recompensa_fidelidade',{p_cliente_id:cliente.id,p_recompensa_id:recompensa,p_codigo:codigo});
 if(error){const m=String(error.message||'');if(m.includes('saldo_insuficiente'))return NextResponse.json({erro:'Você não tem pontos suficientes.'},{status:409});if(m.includes('recompensa_indisponivel'))return NextResponse.json({erro:'Esta recompensa não está disponível.'},{status:409});console.error('[fidelidade] resgate:',error);return NextResponse.json({erro:'Não foi possível concluir o resgate.'},{status:500})}
 return NextResponse.json({ok:true,resgate:{id,codigo}});
}
